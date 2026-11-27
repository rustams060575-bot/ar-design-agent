"""james · ar02 autopilot: publishes the finished AR_Content_02 queue (Reels R09–R18, carousels C05–C10) at two fixed US-Eastern (Miami / New York) slots: carousels in the morning, reels in the evening.

    python agent/scraper.py --action autopilot        # started by the external trigger (cron-job.org -> /api/cron?action=autopilot)

Slots (America/New_York, daylight saving handled by the zone): morning 09:00 = carousel, evening 21:00 = reel. The run takes the NEXT unpublished
item OF THAT KIND from content-hub/ar02/queue.json (queue order inside each kind; a manual run takes the next item of any kind), publishes it to Instagram and the Facebook Page, logs it and reports to Telegram.

Guardrails:
  * old templates / concept bank / model-generated cards are NOT used in this mode;
  * at most one item per slot per New York day (a double trigger or a re-run does nothing);
  * kill switch: META_PUBLISH_LIVE != "1" is a dry run (nothing is published, state is not advanced);
  * a failed publish is reported and not retried in a loop; the item stays at the head of the queue for the next slot.
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

import meta_publisher as mp
from autopilot import load_state, raw_url, save_state, send_report

REPO = Path(__file__).resolve().parent.parent
QUEUE = REPO / "content-hub" / "ar02" / "queue.json"
TZ = "America/New_York"
SLOT_KIND = {"morning": "carousel", "evening": "reel"}
CAROUSEL_DAYS = {0, 2, 4}  # Mon/Wed/Fri mornings = carousel; other mornings = reel (audit 2026-11-27: reels reach non-followers, carousels barely do)


def slot_kind(slot: str, day=None) -> str | None:
    """Kind wanted for a slot on a New York date: evening = reel; morning = carousel on CAROUSEL_DAYS, otherwise reel."""
    if slot == "morning" and day is not None and day.weekday() not in CAROUSEL_DAYS:
        return "reel"
    return SLOT_KIND.get(slot)


WINDOWS = {"morning": ((9, 0), (10, 30)), "evening": ((21, 0), (22, 30))}  # America/New_York; GitHub cron may start late, never early


def slot_of(et: datetime) -> str | None:
    """Slot whose window contains this New York time, else None (the run then does nothing)."""
    t = (et.hour, et.minute)
    for name, (a, b) in WINDOWS.items():
        if a <= t < b:
            return name
    return None


def next_item(queue: list, state: dict, slot: str, kind: str | None = None, day=None):
    """Next unpublished queue item for the slot: carousel in the morning, reel in the evening, any kind for a manual run
    (a manual run may name the kind: SEARCH_QUERY "now carousel" / "now reel")."""
    done = {e.get("id") for e in state.get("log", []) if e.get("source") == "ar02" and e.get("ok")}
    want = slot_kind(slot, day) or kind
    iso = day.isoformat() if day is not None else None
    # an item may carry "date" (YYYY-MM-DD): it waits until that day, and on that day it takes the slot first (holiday posts)
    open_ = [(i, q) for i, q in enumerate(queue) if q["id"] not in done and not (iso and q.get("date") and q["date"] > iso)]
    if iso and slot in SLOT_KIND:
        due = [(i, q) for i, q in open_ if q.get("date") == iso]
        if due:
            return next(((i, q) for i, q in due if q["kind"] == want), due[0])
    for i, q in open_:
        if want is None or q["kind"] == want:
            return i, q
    if want and slot in SLOT_KIND and open_:  # that kind ran out: publish the other kind rather than skip the slot
        return open_[0]
    return None, None


def runway(queue: list, state: dict, day) -> tuple[str, int, int]:
    """Last New York date the queue still fills (simulated slot by slot), plus unpublished reels / carousels."""
    from datetime import timedelta
    log = list(state.get("log", []))
    done = {e.get("id") for e in log if e.get("source") == "ar02" and e.get("ok")}
    left = [q for q in queue if q["id"] not in done]
    last, d = None, day
    for _ in range(400):
        d = d + timedelta(days=1)
        for slot in ("morning", "evening"):
            _, q = next_item(queue, {"log": log}, slot, None, d)
            if q is None:
                return (last or "—"), sum(x["kind"] == "reel" for x in left), sum(x["kind"] == "carousel" for x in left)
            log.append({"source": "ar02", "ok": True, "id": q["id"]}); last = d.isoformat()
    return last, sum(x["kind"] == "reel" for x in left), sum(x["kind"] == "carousel" for x in left)


def _runway_note(queue, state, day) -> str:
    try:
        last, reels, cars = runway(queue, state, day)
    except Exception as exc:  # noqa: BLE001 - a report line must never break publishing
        return f" · запас: ошибка расчёта ({type(exc).__name__})"
    from datetime import date
    days = (date.fromisoformat(last) - day).days if last != "—" else 0
    warn = " ⚠️ меньше недели, нужен новый контент" if days < 7 else ""
    return f"\nВ очереди: {reels} рилсов, {cars} каруселей · хватит до {last}{warn}"


def media_ready(paths: list[str], wait: int = 90) -> bool:
    urls = [raw_url(REPO / p) for p in paths]
    deadline = time.time() + wait
    while urls and time.time() < deadline:
        urls = [u for u in urls if requests.head(u, timeout=15, allow_redirects=True).status_code != 200]
        if urls:
            time.sleep(5)
    return not urls


def make_item(q: dict) -> dict:
    ig = [raw_url(REPO / p) for p in q["files_ig"]]
    fb = [raw_url(REPO / p) for p in q["files_fb"]]
    item = {"kind": q["kind"], "platforms": list(mp.PLATFORMS), "caption": q["caption_ig"], "caption_fb": q["caption_fb"],
            "publish_at": datetime.now(timezone.utc).isoformat()}
    if q["kind"] == "carousel":
        item["media_urls"], item["media_urls_fb"] = ig, fb
    else:
        item["media_url"], item["media_url_fb"] = ig[0], fb[0]
    return item


def run(cfg: dict, now: datetime | None = None, force: bool | None = None) -> int:
    graph = mp.Graph()
    live = graph.live
    et = (now or datetime.now(timezone.utc)).astimezone(ZoneInfo(TZ))
    words = os.getenv("SEARCH_QUERY", "").strip().lower().split()
    force = (words[:1] == ["now"]) if force is None else force  # manual: "now" publishes the next item
    manual_kind = words[1] if len(words) > 1 and words[1] in ("carousel", "reel") else None  # "now carousel" / "now reel"
    slot = slot_of(et) or ("manual" if force else None)
    today = et.strftime("%Y-%m-%d")
    if slot is None:
        print(f"[ar02] {et.strftime('%Y-%m-%d %H:%M %Z')}: outside the 09:00 / 21:00 New York windows, nothing to do")
        # The exact-time external trigger (cron-job.org -> /api/cron) is a workflow_dispatch. If one lands outside both windows the
        # timezone of the trigger and of this script disagree: say so loudly instead of silently skipping the slot.
        if os.getenv("GITHUB_EVENT_NAME") == "workflow_dispatch" and words[:1] != ["now"]:
            send_report(f"⚠️ james ar02 · trigger arrived at {et.strftime('%H:%M %Z')} ({TZ}), outside the 09:00 / 21:00 windows: nothing published. "
                        f"If this was the cron-job.org slot job, its timezone must be {TZ}.")
        return 0
    state = load_state()
    queue = json.loads(QUEUE.read_text(encoding="utf-8"))
    if any(e.get("date") == today and e.get("slot") == slot and e.get("ok") and e.get("source") == "ar02" for e in state["log"]):
        print(f"[ar02] {today} {slot}: already published, nothing to do")
        return 0
    i, q = next_item(queue, state, slot, manual_kind if slot == "manual" else None, et.date())
    if q is None:
        kind = SLOT_KIND.get(slot, "item")
        print(f"[ar02] no unpublished {kind} left in the queue: nothing published (old templates are disabled)")
        send_report(f"james ar02 · {today} {slot}: no unpublished {kind} left, nothing published. Add new content to content-hub/ar02.")
        return 0
    item = make_item(q)
    print(f"[ar02] {today} {et.strftime('%H:%M %Z')} slot={slot} live={live} next={q['id']} ({q['kind']}, #{q['order']}/{len(queue)})")
    entry = {"date": today, "time": et.strftime("%H:%M"), "slot": slot, "kind": "post" if q["kind"] == "carousel" else "reel",
             "id": q["id"], "source": "ar02", "live": live, "ok": False}
    if not live:
        print(f"[ar02] DRY RUN: would publish {q['id']} to {', '.join(item['platforms'])}")
        send_report(f"james ar02 · dry run · {today} {slot}: next would be {q['id']}")
        return 0
    if not media_ready(sorted(set(q["files_ig"] + q["files_fb"]))):
        entry["result"] = {"error": "media not reachable by https"}
        state["log"].append(entry)
        save_state(state)
        send_report(f"⚠️ james ar02 · {q['id']}: media is not reachable, nothing published")
        return 0
    problems = mp.validate_item(item)
    if problems:
        entry["result"] = {"error": "; ".join(problems)}
        state["log"].append(entry)
        save_state(state)
        send_report(f"⚠️ james ar02 · {q['id']}: invalid ({'; '.join(problems)})")
        return 0
    # Per-platform bookkeeping: a platform already published for this item is never posted twice, and a failed one
    # (e.g. Instagram "API access blocked" / rate limit) is retried by the next trigger inside the window (cron every 10 min).
    prior = {}
    for e in state["log"]:
        if e.get("source") == "ar02" and e.get("id") == q["id"]:
            for k, v in (e.get("result") or {}).items():
                if isinstance(v, str) and v.startswith("published"):
                    prior[k] = v
    results = dict(prior)
    for platform in item["platforms"]:
        if platform in prior:
            continue
        if not graph.has(platform):
            results[platform] = "skipped: credentials not set"
            continue
        for attempt in range(1, 4):  # in-run retries for transient Meta errors (rate limit, temporary failure)
            try:
                results[platform] = "published:" + (graph.publish_instagram(item) if platform == "instagram" else graph.publish_facebook(item))
                break
            except (RuntimeError, requests.RequestException) as exc:
                results[platform] = f"failed: {exc}"
                if attempt < 3 and any(f"code {c})" in str(exc) for c in (1, 2, 4, 17, 32, 341, 368, 613)) or "network error" in str(exc):
                    time.sleep(30 * attempt)
                    continue
                break
    wanted = [p for p in item["platforms"] if graph.has(p)]
    entry["result"] = results
    entry["ok"] = bool(wanted) and all(results.get(p, "").startswith("published") for p in wanted)
    state["log"].append(entry)
    if entry["ok"]:
        state["ar02_i"] = max(state.get("ar02_i", 0), i + 1)
    save_state(state)
    failed = [p for p in wanted if not results.get(p, "").startswith("published")]
    send_report(f"{'✅' if entry['ok'] else '⚠️'} james ar02 · {today} {slot} · {q['id']} · " + ", ".join(f"{k}: {v.split(':')[0]}" for k, v in results.items())
                + (f" · повтор в следующем запуске окна: {', '.join(failed)}" if failed else "")
                + _runway_note(queue, state, et.date()))
    print(f"[ar02] {q['id']}: {results}")
    return 0
