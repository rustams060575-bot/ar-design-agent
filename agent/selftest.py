"""Delivery self-test: which bot does the token belong to, and can it message the owner chat? No secrets are printed."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

token, chat = os.getenv("TELEGRAM_BOT_TOKEN", ""), os.getenv("TELEGRAM_CHAT_ID", "")
print(f"token set: {bool(token)} | chat id set: {bool(chat)} | chat id shape: {'numeric' if chat.lstrip('-').isdigit() else 'NOT numeric'} ({len(chat)} chars)")
if not (token and chat):
    sys.exit(1)


def api(method: str, payload: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=json.dumps(payload or {}).encode(),
        headers={"content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    except urllib.error.HTTPError as exc:
        try:
            return json.load(exc)
        except Exception:  # noqa: BLE001
            return {"ok": False, "description": f"HTTP {exc.code}"}


me = api("getMe")
uname = me.get("result", {}).get("username")
print(f"getMe: ok={me.get('ok')} bot=@{uname}")
wh = api("getWebhookInfo").get("result", {})
print(f"webhook: {wh.get('url')} | pending={wh.get('pending_update_count')} | last_error={wh.get('last_error_message')}")
res = api("sendMessage", {
    "chat_id": chat,
    "text": f"✅ Джеймс на связи: тест доставки из GitHub Actions.\nБот: @{uname}. Режим: только чтение публичных чатов и каналов.\nЕсли вы видите это сообщение, карточки лидов до вас дойдут.",
})
print(f"sendMessage: ok={res.get('ok')} description={res.get('description', '')}")
sys.exit(0 if res.get("ok") else 2)
