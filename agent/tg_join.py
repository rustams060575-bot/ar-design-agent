"""Joins Telegram chats on the owner's command (voice or text in the bot) and adds them to the monitor.

Flow:
  owner: "вступи в @name" / "join https://t.me/+AbC..." / /join <links>
    -> the bot (api/telegram.js) starts the workflow tg_join.yml, whose run name carries the links
    -> tg_monitor.py, which owns the ONE Telegram session, sees that run (GitHub API), joins the chats with this module,
       adds them to the watch list and tells the owner what happened.
Only one process ever uses the session, so there is no risk of Telegram revoking it for a duplicate login.

Safety: at most DAILY_CAP joins per 24 hours, a random pause between joins, never more than MAX_PER_REQUEST links in one
request. Joining many chats quickly is what gets accounts limited, so the caps are deliberate.
"""
from __future__ import annotations

import asyncio
import random
import re
import time

DAILY_CAP = 10
MAX_PER_REQUEST = 5

# @username, t.me/username, t.me/+hash, t.me/joinchat/hash
_RX = re.compile(
    r"(?:https?://)?(?:t|telegram)\.me/(?P<p>\+[\w-]{10,}|joinchat/[\w-]{10,}|[A-Za-z][\w]{3,31})(?:/\d+)?"
    r"|(?<![\w@/])@(?P<u>[A-Za-z][\w]{3,31})",
    re.I,
)


def parse_refs(text: str) -> list[str]:
    """-> normalized refs: '@name' or 'https://t.me/+hash'. Unique, in order, at most MAX_PER_REQUEST."""
    out: list[str] = []
    for m in _RX.finditer(text or ""):
        p, u = m.group("p"), m.group("u")
        if u:
            ref = "@" + u
        elif p.startswith("+"):
            ref = "https://t.me/" + p
        elif p.lower().startswith("joinchat/"):
            ref = "https://t.me/+" + p.split("/", 1)[1]
        else:
            ref = "@" + p
        if ref.lower() not in (x.lower() for x in out):
            out.append(ref)
    return out[:MAX_PER_REQUEST]


def cap_left(state) -> int:
    day_ago = time.time() - 86400
    state.join_log = [t for t in state.join_log if t > day_ago]
    return max(0, DAILY_CAP - len(state.join_log))


async def join_one(client, ref: str) -> dict:
    """-> {ok, text, rec?}. `rec` is the watch-list record (same shape as tg_discover) when the chat can be monitored."""
    from telethon import errors, utils
    from telethon.tl.functions.channels import JoinChannelRequest
    from telethon.tl.functions.messages import CheckChatInviteRequest, ImportChatInviteRequest
    from telethon.tl.types import Channel, ChatInviteAlready

    try:
        if ref.startswith("https://t.me/+"):
            h = ref.rsplit("+", 1)[1]
            info = await client(CheckChatInviteRequest(h))
            if isinstance(info, ChatInviteAlready):
                ent, joined = info.chat, "уже состоял"
            else:
                upd = await client(ImportChatInviteRequest(h))
                ent, joined = upd.chats[0], "вступил"
        else:
            ent = await client.get_entity(ref.lstrip("@"))
            if not isinstance(ent, Channel):
                return {"ok": False, "text": "это не чат и не канал (пользователь или бот)"}
            await client(JoinChannelRequest(ent))
            joined = "вступил"
    except errors.UserAlreadyParticipantError:
        return {"ok": True, "text": "уже состоял в чате"}
    except errors.InviteRequestSentError:
        return {"ok": False, "text": "чат принимает по заявке: заявка отправлена админам, после одобрения повторите команду"}
    except (errors.InviteHashExpiredError, errors.InviteHashInvalidError):
        return {"ok": False, "text": "ссылка-приглашение недействительна или истекла"}
    except (errors.UsernameNotOccupiedError, errors.UsernameInvalidError, ValueError):
        return {"ok": False, "text": "такого чата не нашёл, проверьте ссылку"}
    except errors.ChannelsTooMuchError:
        return {"ok": False, "text": "аккаунт достиг лимита чатов Telegram, нужно выйти из лишних"}
    except errors.ChannelPrivateError:
        return {"ok": False, "text": "чат закрытый: нужна ссылка-приглашение"}
    except errors.FloodWaitError as exc:
        return {"ok": False, "text": f"Telegram просит подождать {exc.seconds} с, попробую позже: повторите команду"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "text": f"не получилось ({type(exc).__name__})"}

    if not isinstance(ent, Channel):
        return {"ok": True, "text": f"{joined}, но это обычная группа: мониторинг для таких не поддерживается"}
    latest = await client.get_messages(ent, limit=1)
    rec = {
        "id": ent.id,
        "access_hash": ent.access_hash,
        "username": ent.username,
        "title": getattr(ent, "title", ent.username),
        "members": getattr(ent, "participants_count", None),
        "added": int(time.time()),
        "last_id": latest[0].id if latest else 0,  # old history never raises alerts
        "source": "owner",
    }
    return {"ok": True, "text": f"{joined} и добавил в мониторинг", "rec": rec, "key": str(utils.get_peer_id(ent))}


async def join_refs(client, refs: list[str], state, log) -> list[tuple[str, dict]]:
    results: list[tuple[str, dict]] = []
    for i, ref in enumerate(refs[:MAX_PER_REQUEST]):
        if cap_left(state) <= 0:
            results.append((ref, {"ok": False, "text": f"дневной лимит вступлений ({DAILY_CAP}) исчерпан, повторите завтра"}))
            continue
        res = await join_one(client, ref)
        if res["ok"] and "rec" in res:
            state.join_log.append(time.time())
            state.dirty = True
        results.append((ref, res))
        log(f"join {ref}: {res['text']}")
        if i < len(refs) - 1:
            await asyncio.sleep(random.uniform(20, 40))  # joining in a burst is what limits accounts
    return results
