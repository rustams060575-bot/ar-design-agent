"""Daily Meta token watch: checks that the publishing token works and warns in Telegram when it is invalid or about to expire.

Read-only. Never prints or sends a token. Silent when everything is fine (WARN_DAYS = days left that trigger a warning).
Env: ACCESS_TOKEN (checked), IG_USER_ID, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID. Set ALWAYS_REPORT=1 to get a status message even when healthy.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

import meta_check as m

WARN_DAYS = 14


def tg(text: str) -> None:
    tok, chat = os.getenv("TELEGRAM_BOT_TOKEN"), os.getenv("TELEGRAM_CHAT_ID")
    if not (tok and chat):
        print("[token_watch] telegram not configured")
        return
    data = urllib.parse.urlencode({"chat_id": chat, "text": text}).encode()
    try:
        urllib.request.urlopen(f"https://api.telegram.org/bot{tok}/sendMessage", data=data, timeout=15)
    except Exception as exc:  # noqa: BLE001
        print(f"[token_watch] telegram failed ({type(exc).__name__})")


def main() -> int:
    t, ig = os.getenv("ACCESS_TOKEN", ""), os.getenv("IG_USER_ID", "")
    problems, notes = [], []
    if not t:
        problems.append("секрет ACCESS_TOKEN пуст")
    else:
        s, d = m.get(f"https://graph.facebook.com/{m.V}/debug_token", input_token=t, access_token=t)
        info = d.get("data", {}) if s == 200 else {}
        if s != 200 or not info.get("is_valid"):
            problems.append(f"токен недействителен: {d.get('error') or info.get('error', {}).get('message', 'is_valid=false')}")
        else:
            exp = info.get("expires_at") or 0
            left = (exp - time.time()) / 86400 if exp else None
            notes.append("срок: бессрочный" if left is None else f"осталось дней: {int(left)}")
            if left is not None and left < WARN_DAYS:
                problems.append(f"токен истекает через {max(0, int(left))} дн.")
            da = info.get("data_access_expires_at") or 0
            if da and (da - time.time()) / 86400 < WARN_DAYS:
                problems.append(f"доступ к данным истекает через {max(0, int((da - time.time()) / 86400))} дн.")
            if "instagram_content_publish" not in (info.get("scopes") or []):
                problems.append("нет права instagram_content_publish")
        if ig:
            s, d = m.get(f"https://graph.facebook.com/{m.V}/{ig}", fields="id,username", access_token=t)
            if s != 200:
                problems.append(f"Instagram-аккаунт недоступен: {d.get('error')}")
            else:
                notes.append(f"IG @{d.get('username')} ок")
    if problems:
        tg("⚠️ james · Meta токен: " + "; ".join(problems) + ". Обновите секрет ACCESS_TOKEN в GitHub (долгоживущий токен), иначе Instagram не опубликуется.")
        print("[token_watch] PROBLEMS:", problems)
    else:
        print("[token_watch] ok:", notes)
        if os.getenv("ALWAYS_REPORT") == "1":
            tg("✅ james · Meta токен в порядке: " + ", ".join(notes))
    return 0


if __name__ == "__main__":
    sys.exit(main())
