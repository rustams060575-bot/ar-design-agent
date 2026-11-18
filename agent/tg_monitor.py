"""Telegram chat monitor: finds people looking for a web designer and sends Rustam a lead card with a reply draft.

Runs in the cloud (GitHub Actions, .github/workflows/tg_leads.yml), so no computer has to be on. One run lasts about
nine minutes and the next one starts right after it:
  1. catch-up: messages that arrived since the previous run (last id per chat is kept in the Actions cache);
  2. live: new messages are handled the moment Telegram delivers them, until the run ends.

The user account only READS. It never writes, joins or leaves a chat. It must already be a member of the chats listed in
agent/tg_chats.json (or set "include_all_joined": true there to watch every group and channel the account is in).

Env (GitHub secrets / agent/.env): TG_API_ID, TG_API_HASH, TG_SESSION (from agent/tg_login.py),
TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ANTHROPIC_API_KEY (or OPENAI_API_KEY).
Optional: TG_RUN_SECONDS (default 540), TG_STATE_PATH.

    python agent/tg_monitor.py             # normal run
    python agent/tg_monitor.py --once      # catch-up only, then exit
    python agent/tg_monitor.py --dry-run   # print cards instead of sending them
    python agent/tg_monitor.py --verbose   # explain why messages were rejected
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import html
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

import lead_filter  # noqa: E402

CONFIG_PATH = ROOT / "config.json"
CHATS_PATH = ROOT / "tg_chats.json"
STATE_PATH = Path(os.getenv("TG_STATE_PATH") or ROOT / "tg_state.json")
MAX_HASHES = 600


def log(msg: str) -> None:
    print(f"[tg_monitor] {msg}", flush=True)


# ---------------------------------------------------------------- state and config

def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


class State:
    """last_id per chat, hashes of handled texts (cross-posts), alerts already sent. Lives in the Actions cache."""

    def __init__(self):
        raw = load_json(STATE_PATH, {})
        self.chats: dict[str, dict] = raw.get("chats", {})
        self.hashes: list[str] = raw.get("hashes", [])[-MAX_HASHES:]
        self.alerts: dict[str, float] = raw.get("alerts", {})
        self.discovered: dict[str, dict] = raw.get("discovered", {})  # chats found by tg_discover.py
        self.rejected: dict[str, float] = raw.get("rejected", {})
        self.last_discovery: float = raw.get("last_discovery", 0)
        self.joins_done: list[int] = raw.get("joins_done", [])[-100:]  # tg_join.yml run ids already handled
        self.join_log: list[float] = raw.get("join_log", [])  # timestamps of joins (daily cap)
        self.dirty = False

    def reject(self, key: str, why: str = "") -> None:
        self.rejected[key] = time.time()
        self.dirty = True

    def last_id(self, chat_id: int) -> int | None:
        return self.chats.get(str(chat_id), {}).get("last_id")

    def advance(self, chat_id: int, msg_id: int) -> None:
        cur = self.chats.setdefault(str(chat_id), {})
        if msg_id > cur.get("last_id", 0):
            cur["last_id"] = msg_id
            self.dirty = True

    def seen_text(self, text: str) -> bool:
        h = hashlib.sha1(re.sub(r"\W+", " ", text.lower()).strip()[:300].encode()).hexdigest()[:16]
        if h in self.hashes:
            return True
        self.hashes = (self.hashes + [h])[-MAX_HASHES:]
        self.dirty = True
        return False

    def alert_due(self, key: str, every_s: float = 12 * 3600) -> bool:
        if time.time() - self.alerts.get(key, 0) < every_s:
            return False
        self.alerts[key] = time.time()
        self.dirty = True
        return True

    def save(self) -> None:
        if not self.dirty:
            return
        cutoff = time.time() - 30 * 86400
        self.rejected = {k: v for k, v in self.rejected.items() if v > cutoff}  # old rejections are forgotten
        STATE_PATH.write_text(
            json.dumps({"chats": self.chats, "hashes": self.hashes, "alerts": self.alerts, "discovered": self.discovered,
                        "rejected": self.rejected, "last_discovery": self.last_discovery,
                        "joins_done": self.joins_done[-100:], "join_log": self.join_log}),
            encoding="utf-8",
        )
        self.dirty = False


# ---------------------------------------------------------------- Bot API (notifications to the owner)

def bot_send(text: str, buttons: list[dict] | None = None, dry: bool = False) -> bool:
    if dry:
        print("-" * 60 + "\n" + re.sub(r"</?[a-z]+>", "", html.unescape(text)) + "\n" + (json.dumps(buttons, ensure_ascii=False) if buttons else ""))
        return True
    token, chat = os.getenv("TELEGRAM_BOT_TOKEN"), os.getenv("TELEGRAM_CHAT_ID")
    if not (token and chat):
        log("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not set: nothing can be delivered")
        return False
    payload = {"chat_id": chat, "text": text[:4000], "parse_mode": "HTML", "disable_web_page_preview": True}
    for attempt_buttons in ([buttons, None] if buttons else [None]):
        body = dict(payload)
        if attempt_buttons:
            body["reply_markup"] = {"inline_keyboard": [attempt_buttons]}
        try:
            r = requests.post(f"https://api.telegram.org/bot{token}/sendMessage", json=body, timeout=15)
        except requests.RequestException as exc:
            log(f"bot send failed: {type(exc).__name__}")
            return False
        if r.ok:
            return True
        log(f"bot send HTTP {r.status_code}: {r.json().get('description', '') if r.headers.get('content-type', '').startswith('application/json') else ''}")
        # a rejected button (for example a privacy-restricted tg://user link): retry without the buttons
    return False


# ---------------------------------------------------------------- the monitor

def normalize_ref(ref: str):
    ref = str(ref).strip()
    m = re.match(r"^(?:https?://)?t\.me/(?!\+|joinchat)([A-Za-z0-9_]{4,})(?:/\d+)?/?$", ref)
    if m:
        return m.group(1)
    if re.fullmatch(r"-?\d{5,}", ref):
        return int(ref)
    if ref.startswith("@"):
        return ref[1:]
    if re.fullmatch(r"[A-Za-z0-9_]{4,}", ref):
        return ref
    return None  # invite links (t.me/+...) cannot be resolved without joining: the account must already be in the chat


class Monitor:
    def __init__(self, client, cfg: dict, state: State, args):
        self.client, self.cfg, self.state, self.args = client, cfg, state, args
        self.filter = lead_filter.Prefilter(cfg)
        self.sent = 0
        self.limit = int(cfg["tg_leads"].get("max_notifications_per_run", 12))
        self.chats: dict[int, dict] = {}

    # -- chats
    async def resolve_chats(self) -> None:
        from telethon import utils

        conf = load_json(CHATS_PATH, {"chats": []})
        for item in conf.get("chats", []):
            if isinstance(item, str):
                item = {"ref": item}
            if item.get("enabled", True) is False or not item.get("ref"):
                continue
            ref = normalize_ref(item["ref"])
            if ref is None:
                log(f"skipped {item['ref']!r}: invite links cannot be used, give @username or the numeric id")
                continue
            try:
                ent = await self.client.get_entity(ref)
            except Exception as exc:  # noqa: BLE001 - a bad entry must not stop the others
                log(f"cannot open {item['ref']!r}: {type(exc).__name__}")
                if self.state.alert_due(f"chat:{item['ref']}", 7 * 24 * 3600):
                    bot_send(f"⚠️ Мониторинг: не удалось открыть чат {html.escape(str(item['ref']))} ({type(exc).__name__}). Проверьте имя и что аккаунт состоит в чате.", dry=self.args.dry_run)
                continue
            self._add(utils.get_peer_id(ent), ent, item.get("title"))
        self.load_discovered()
        if conf.get("include_all_joined"):
            async for d in self.client.iter_dialogs():
                if d.is_group or d.is_channel:
                    self._add(d.id, d.entity, d.name)
        log(f"watching {len(self.chats)} chats")

    def load_discovered(self) -> None:
        """Chats found by tg_discover.py: rebuilt from id + access hash, so no username lookups are needed."""
        from telethon import utils
        from telethon.tl.types import InputPeerChannel

        for rec in self.state.discovered.values():
            peer = InputPeerChannel(rec["id"], rec["access_hash"])
            marked = utils.get_peer_id(peer)
            self._add(marked, peer, rec.get("title"), rec.get("username"))
            if rec.get("last_id") and not self.state.last_id(marked):
                self.state.advance(marked, rec["last_id"])  # history that was checked at discovery time never raises alerts

    # -- join requests from the owner (voice / text in the bot -> workflow tg_join.yml -> here)
    def _pending_join_runs(self) -> list[tuple[int, list[str]]]:
        import tg_join

        repo, token = os.getenv("GITHUB_REPOSITORY"), os.getenv("GITHUB_TOKEN")
        if not (repo and token):
            return []
        try:
            r = requests.get(
                f"https://api.github.com/repos/{repo}/actions/workflows/tg_join.yml/runs?per_page=15",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
                timeout=10,
            )
            runs = r.json().get("workflow_runs", []) if r.ok else []
        except (requests.RequestException, ValueError):
            return []
        out = []
        cutoff = datetime.now(timezone.utc) - timedelta(hours=6)
        for run in runs:
            created = datetime.fromisoformat(run["created_at"].replace("Z", "+00:00"))
            if run["id"] in self.state.joins_done or created < cutoff:
                continue
            refs = tg_join.parse_refs(run.get("display_title", ""))  # the run name carries the links
            if refs:
                out.append((run["id"], refs))
        return list(reversed(out))  # oldest first

    async def process_joins(self) -> None:
        import tg_join

        loop = asyncio.get_running_loop()
        for run_id, refs in await loop.run_in_executor(None, self._pending_join_runs):
            self.state.joins_done.append(run_id)  # marked first: a crash must never repeat a join
            self.state.dirty = True
            log(f"join request {run_id}: {refs}")
            results = await tg_join.join_refs(self.client, refs, self.state, log)
            lines = []
            for ref, res in results:
                if res.get("rec"):
                    self.state.discovered[res["key"]] = res["rec"]
                    self.state.dirty = True
                lines.append(("✅ " if res["ok"] else "⚠️ ") + html.escape(ref) + " — " + html.escape(res["text"]))
            if any(r.get("rec") for _, r in results):
                self.load_discovered()
            bot_send("👀 <b>Джеймс: чаты добавлены в мониторинг (только чтение, без вступления)</b>\n\n" + "\n".join(lines), dry=self.args.dry_run)
            self.state.save()

    async def discover_new(self) -> None:
        """Daily search for new public chats (tg_discover.py). The owner is told what was added; nothing is joined."""
        import tg_discover

        disc = tg_discover.Discovery(self.cfg, self.filter)
        force = self.args.discover
        if not force and (self.args.once or not disc.due(self.state)):
            return
        new = await disc.run(self.client, self.state, set(self.chats), log)
        if not new:
            return
        from telethon import utils
        from telethon.tl.types import InputPeerChannel

        for rec in new:
            self.state.discovered[str(utils.get_peer_id(InputPeerChannel(rec["id"], rec["access_hash"])))] = rec
        self.state.dirty = True
        self.load_discovered()
        lines = [f"• @{html.escape(r['username'])} · {html.escape(str(r['title']))}" + (f" · {r['members']} уч." if r.get("members") else "") for r in new]
        bot_send("🔎 <b>Джеймс нашёл новые чаты и добавил в мониторинг</b>\n(только чтение, никуда не вступаю)\n\n" + "\n".join(lines[:15]), dry=self.args.dry_run)
        self.state.save()

    def _add(self, chat_id: int, ent, title: str | None, username: str | None = None) -> None:
        self.chats[chat_id] = {
            "entity": ent,
            "title": title or getattr(ent, "title", None) or getattr(ent, "username", None) or str(chat_id),
            "username": username or getattr(ent, "username", None),
        }

    def message_link(self, chat_id: int, msg) -> str:
        info = self.chats[chat_id]
        if info["username"]:
            return f"https://t.me/{info['username']}/{msg.id}"
        s = str(chat_id)
        return f"https://t.me/c/{s[4:] if s.startswith('-100') else s.lstrip('-')}/{msg.id}"

    # -- messages
    async def handle(self, chat_id: int, msg) -> None:
        self.state.advance(chat_id, msg.id)
        text = (getattr(msg, "message", "") or "").strip()
        if getattr(msg, "out", False) or not text:
            return
        ok, why, hits = self.filter.check(text)
        if not ok:
            if self.args.verbose:
                log(f"reject ({why}): {text[:70]!r}")
            return
        if self.state.seen_text(text):
            return
        if self.sent >= self.limit:
            log("notification limit for this run reached")
            return
        info = self.chats[chat_id]
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, lead_filter.analyze, text, info["title"], self.cfg)
        if result is None:
            # The lead is never dropped because the model failed: the owner still gets a card with a template reply.
            log("no usable model answer: sending a rule-based card instead")
            result = lead_filter.fallback(text, self.cfg)
        if not result["relevant"]:
            if self.args.verbose:
                log(f"model rejected: {result['reason']}")
            return
        sender = await msg.get_sender()
        if getattr(sender, "bot", False):
            return
        card, buttons = self.card(chat_id, msg, sender, hits, result)
        if bot_send(card, buttons, dry=self.args.dry_run):
            self.sent += 1
            log(f"lead sent from {info['title']}")

    def card(self, chat_id: int, msg, sender, hits: list[str], r: dict) -> tuple[str, list[dict]]:
        info = self.chats[chat_id]
        esc = html.escape
        username = getattr(sender, "username", None)
        name = " ".join(x for x in (getattr(sender, "first_name", None), getattr(sender, "last_name", None)) if x) or getattr(sender, "title", None) or "автор скрыт"
        author = esc(name) + (f" @{esc(username)}" if username else "")
        link = self.message_link(chat_id, msg)
        lines = [f"<b>Новый заказ</b> · {esc(info['title'])}", "", f"<b>Суть:</b> {esc(r['summary'] or '—')}"]
        lines.append(f"<b>Бюджет:</b> {esc(r['budget'] or 'не указан')}")
        lines.append(f"<b>Вердикт:</b> {esc(r.get('verdict') or 'уточнить')}")
        lines += [f"<b>Автор:</b> {author}", f"<b>Совпало:</b> {esc(', '.join(hits[:5]))}", ""]
        if r.get("warnings"):
            lines.append(f"<i>проверьте черновик: {esc('; '.join(r['warnings']))}</i>")
        lines += ["<b>Черновик отклика</b> (нажмите, чтобы скопировать):", f"<pre>{esc(r['reply'][:1800])}</pre>"]
        buttons = [{"text": "Открыть сообщение", "url": link}]
        if username:
            buttons.append({"text": "Написать автору", "url": f"https://t.me/{username}"})
        elif getattr(sender, "id", None) and not getattr(sender, "broadcast", False):
            buttons.append({"text": "Написать автору", "url": f"tg://user?id={sender.id}"})
        return "\n".join(lines), buttons

    # -- catch-up and live
    async def catch_up(self) -> None:
        window = timedelta(minutes=int(self.cfg["tg_leads"].get("first_run_window_min", 60)))
        cutoff = datetime.now(timezone.utc) - window
        for chat_id, info in self.chats.items():
            try:
                last = self.state.last_id(chat_id)
                if last:
                    msgs = [m async for m in self.client.iter_messages(info["entity"], min_id=last, limit=200)]
                else:
                    msgs = []
                    async for m in self.client.iter_messages(info["entity"], limit=200):
                        if m.date < cutoff:
                            break
                        msgs.append(m)
                    if not msgs:  # nothing recent: remember where the chat is now
                        latest = await self.client.get_messages(info["entity"], limit=1)
                        if latest:
                            self.state.advance(chat_id, latest[0].id)
                for m in reversed(msgs):  # oldest first
                    await self.handle(chat_id, m)
                await asyncio.sleep(0.4)  # gentle on Telegram's rate limits
            except Exception as exc:  # noqa: BLE001
                from telethon import errors

                if isinstance(exc, errors.FloodWaitError) and exc.seconds <= 60:
                    await asyncio.sleep(exc.seconds + 1)
                else:
                    log(f"catch-up failed for {info['title']}: {type(exc).__name__}")
        self.state.save()

    async def live(self, deadline: float) -> None:
        from telethon import events

        async def on_new(event):
            cid = event.chat_id
            if cid not in self.chats:
                return
            try:
                await self.handle(cid, event.message)
            except Exception as exc:  # noqa: BLE001 - one bad message must not end the run
                log(f"handler error: {type(exc).__name__}")

        self.client.add_event_handler(on_new, events.NewMessage(incoming=True))
        # Chats the account has not joined (found by tg_discover.py) push no updates: they are polled instead.
        poll_every, last_poll = int(os.getenv("TG_POLL_SECONDS", "90")), time.time()
        while time.time() < deadline and self.client.is_connected():
            await asyncio.sleep(min(20, max(1, deadline - time.time())))
            await self.process_joins()  # owner's join requests are served within ~20 seconds
            if time.time() - last_poll >= poll_every:
                last_poll = time.time()
                await self.catch_up()
            self.state.save()


async def run(args) -> int:
    from telethon import TelegramClient, errors
    from telethon.sessions import StringSession

    need = [k for k in ("TG_API_ID", "TG_API_HASH", "TG_SESSION") if not os.getenv(k)]
    if need:
        log(f"missing: {', '.join(need)}")
        return 2
    cfg = load_json(CONFIG_PATH, None)
    if not cfg or "tg_leads" not in cfg:
        log("config.json has no tg_leads block")
        return 2
    manual = os.getenv("TG_FORCE_DISCOVER", "").lower() == "true"
    topic = os.getenv("TG_QUERY", "").strip()[:100]
    if topic:  # a topic from "найди заказы по react" joins the chat search keywords for this run
        cfg["tg_leads"].setdefault("discovery", {}).setdefault("keywords", []).insert(0, topic)
        args.discover = True
    if manual:
        args.discover = True
    import llm

    if not llm.available(cfg):
        log("no ANTHROPIC_API_KEY or OPENAI_API_KEY: leads cannot be analysed")
        return 2

    state = State()
    client = TelegramClient(StringSession(os.environ["TG_SESSION"]), int(os.environ["TG_API_ID"]), os.environ["TG_API_HASH"], receive_updates=True)
    try:
        await client.connect()
        if not await client.is_user_authorized():
            raise errors.AuthKeyUnregisteredError(request=None)
        mon = Monitor(client, cfg, state, args)
        await mon.resolve_chats()
        await mon.process_joins()
        await mon.discover_new()
        if not mon.chats:
            log("no chats to watch yet: discovery found nothing and tg_chats.json is empty")
            if manual:
                bot_send("🔎 Сканирование Telegram: подходящих публичных чатов пока не нашёл. Пришлите ссылки командой /join или напишите «вступи в @имя», и я начну читать их сразу.", dry=args.dry_run)
            return 0
        await mon.catch_up()
        if manual:
            bot_send(f"🔎 Сканирование Telegram завершено: под наблюдением чатов и каналов — {len(mon.chats)}, новых карточек в эту проверку — {mon.sent}. Дальше мониторинг идёт сам, карточки приходят по мере появления заказов.", dry=args.dry_run)
        if not args.once:
            await mon.live(time.time() + int(os.getenv("TG_RUN_SECONDS", "540")))
        state.save()
        return 0
    except (errors.AuthKeyDuplicatedError, errors.AuthKeyUnregisteredError, errors.SessionRevokedError, errors.SessionExpiredError,
            errors.UserDeactivatedError, errors.UserDeactivatedBanError) as exc:
        print(f"::error::Telegram session is not usable ({type(exc).__name__}). Run agent/tg_login.py and update the TG_SESSION secret.")
        if state.alert_due("session"):
            bot_send(f"⚠️ Мониторинг чатов остановлен: сессия Telegram недействительна ({type(exc).__name__}). Создайте новую командой python agent/tg_login.py и обновите секрет TG_SESSION в GitHub.", dry=args.dry_run)
        state.save()
        return 0  # reported once; failing the workflow every ten minutes would only produce noise
    finally:
        state.save()
        if client.is_connected():
            await client.disconnect()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--once", action="store_true", help="catch-up only")
    ap.add_argument("--dry-run", action="store_true", help="print cards instead of sending")
    ap.add_argument("--verbose", action="store_true", help="log rejections")
    ap.add_argument("--discover", action="store_true", help="run the chat search now, even with --once")
    sys.exit(asyncio.run(run(ap.parse_args())))


if __name__ == "__main__":
    main()
