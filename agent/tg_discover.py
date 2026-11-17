"""Finds public Telegram chats and channels where clients and agencies look for web designers, and adds them to the monitor.

How a chat gets in, without any manual list:
  1. Telegram's own search (contacts.Search) is run for each keyword in config.json -> tg_leads.discovery.keywords.
  2. Cheap filters on the result: public username, a real group/channel, enough members, not scam / fake / restricted,
     the title or username fits the topic, and no adult / casino / trading words.
  3. Quality check: the last messages of the chat are run through the same regex prefilter the monitor uses. A chat
     joins the watch list only if it really contains lead-like messages (a request for a designer / site / MVP ...).
  4. Accepted chats are stored in the monitor state (access hash included, so no username lookups at start-up).

The account never joins anything and never writes: public chats can be read without membership. A rejected chat is
not re-checked for `reject_recheck_days`. All limits live in config.json -> tg_leads.discovery.
"""
from __future__ import annotations

import asyncio
import re
import time

FLAGS = re.IGNORECASE | re.UNICODE


def _rx(patterns: list[str]):
    return re.compile("|".join(f"(?:{p})" for p in patterns), FLAGS) if patterns else None


class Discovery:
    def __init__(self, cfg: dict, prefilter):
        d = cfg["tg_leads"].get("discovery", {})
        self.keywords: list[str] = d.get("keywords", [])
        self.topic = _rx(d.get("topic_words", []))
        self.reject = _rx(d.get("reject_words", []))
        self.min_members = int(d.get("min_members", 500))
        self.max_total = int(d.get("max_total", 50))
        self.max_new = int(d.get("max_new_per_run", 10))
        self.every_h = float(d.get("rediscovery_hours", 24))
        self.sample = int(d.get("sample_size", 100))
        self.min_leads = int(d.get("min_leads_in_sample", 2))
        self.recheck_days = float(d.get("reject_recheck_days", 7))
        self.prefilter = prefilter

    def due(self, state) -> bool:
        return bool(self.keywords) and time.time() - state.last_discovery > self.every_h * 3600

    def candidate_ok(self, ch) -> tuple[bool, str]:
        """Cheap checks on the object returned by the search (no extra request)."""
        if not getattr(ch, "username", None):
            return False, "not public"
        if getattr(ch, "scam", False) or getattr(ch, "fake", False) or getattr(ch, "restricted", False):
            return False, "scam/fake/restricted"
        members = getattr(ch, "participants_count", None)
        if members is not None and members < self.min_members:
            return False, f"small ({members})"
        text = f"{getattr(ch, 'title', '')} {ch.username}"
        if self.reject and self.reject.search(text):
            return False, "reject word"
        if self.topic and not self.topic.search(text):
            return False, "off topic"
        return True, "ok"

    async def run(self, client, state, known_ids: set[int], log) -> list[dict]:
        """-> newly accepted chats: {id, access_hash, username, title, members}."""
        from telethon import errors, utils
        from telethon.tl.functions.contacts import SearchRequest
        from telethon.tl.types import Channel

        state.last_discovery = time.time()
        state.dirty = True
        room = max(0, self.max_total - len(state.discovered))
        quota = min(self.max_new, room)
        if quota <= 0:
            log(f"discovery: watch list is full ({len(state.discovered)}/{self.max_total})")
            return []

        found: dict[int, object] = {}
        for kw in self.keywords:
            try:
                res = await client(SearchRequest(q=kw, limit=25))
            except errors.FloodWaitError as exc:
                log(f"discovery: flood wait {exc.seconds}s, stopping the search early")
                break
            except Exception as exc:  # noqa: BLE001
                log(f"discovery: search '{kw}' failed: {type(exc).__name__}")
                continue
            for ch in res.chats:
                if isinstance(ch, Channel):
                    found.setdefault(ch.id, ch)
            await asyncio.sleep(1.2)

        accepted: list[dict] = []
        checked = 0
        for cid, ch in found.items():
            if len(accepted) >= quota or checked >= 40:
                break
            marked = utils.get_peer_id(ch)
            key = str(marked)
            if marked in known_ids or key in state.discovered:
                continue
            if time.time() - state.rejected.get(key, 0) < self.recheck_days * 86400:
                continue
            ok, why = self.candidate_ok(ch)
            if not ok:
                state.reject(key, why)
                continue
            checked += 1
            try:
                leads, newest = await self._sample(client, ch)
            except errors.FloodWaitError as exc:
                log(f"discovery: flood wait {exc.seconds}s while sampling, stopping")
                break
            except Exception as exc:  # noqa: BLE001 - private/removed/forbidden: just skip it
                state.reject(key, type(exc).__name__)
                continue
            await asyncio.sleep(1.0)
            if leads < self.min_leads:
                state.reject(key, f"few leads ({leads})")
                continue
            rec = {
                "id": ch.id,
                "access_hash": ch.access_hash,
                "username": ch.username,
                "title": getattr(ch, "title", ch.username),
                "members": getattr(ch, "participants_count", None),
                "added": int(time.time()),
                "last_id": newest,  # start from now: the history used for the check must not raise alerts
            }
            accepted.append(rec)
            log(f"discovery: + @{ch.username} ({rec['members']} members, {leads} lead-like messages)")
        return accepted

    async def _sample(self, client, ch) -> tuple[int, int]:
        leads, newest = 0, 0
        async for m in client.iter_messages(ch, limit=self.sample):
            newest = max(newest, m.id)
            text = (getattr(m, "message", "") or "").strip()
            if text and self.prefilter.check(text)[0]:
                leads += 1
        return leads, newest
