"""One-time login of the Telegram USER account used by tg_monitor.py.

    pip install -r agent/requirements-monitor.txt
    python agent/tg_login.py

TG_API_ID and TG_API_HASH are read from agent/.env. The script asks for the phone number, shows how Telegram delivered
the code (app or SMS), asks for the code and, if needed, the two-step password, then prints TG_SESSION.

The session string is never written to a file in the repository. In a normal terminal it is printed once. When the
script runs without a terminal (answers supplied through files in the system temp folder), it is copied to the
clipboard instead of being printed. Put it into GitHub -> Settings -> Secrets and variables -> Actions as TG_SESSION.
Treat it like a password: revoke it in Telegram -> Settings -> Devices if it ever leaks.
"""
from __future__ import annotations

import asyncio
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError
from telethon.sessions import StringSession

load_dotenv(Path(__file__).resolve().parent / ".env")

ANSWER_DIR = Path(tempfile.gettempdir())
WAIT_SECONDS = 300
# TG_LOGIN_FILES=1 forces the file mode even when a console is attached (used when the script is driven by another program).
INTERACTIVE = sys.stdin.isatty() and not os.getenv("TG_LOGIN_FILES")


def ask(prompt: str, name: str, secret: bool = False) -> str:
    """Read an answer from the terminal, or from <temp>/tg_login_<name>.txt when there is no terminal."""
    if INTERACTIVE:
        if secret:
            import getpass

            return getpass.getpass(prompt).strip()
        return input(prompt).strip()

    path = ANSWER_DIR / f"tg_login_{name}.txt"
    print(f"{prompt}(waiting for {path.name}, up to {WAIT_SECONDS} s)", flush=True)
    deadline = time.time() + WAIT_SECONDS
    while time.time() < deadline:
        if path.exists():
            value = path.read_text(encoding="utf-8").strip()
            path.unlink(missing_ok=True)  # the answer is not kept on disk
            if value:
                return value
        time.sleep(1)
    raise SystemExit(f"Timed out waiting for {name}.")


def deliver_session(session: str) -> None:
    if INTERACTIVE:
        print("\n--- TG_SESSION (copy the whole line into a GitHub secret, then clear the terminal) ---\n")
        print(session)
        return
    subprocess.run(["clip"], input=session.encode("ascii"), check=True)
    print("\nTG_SESSION was copied to the clipboard. Paste it into the GitHub secret TG_SESSION.", flush=True)


async def main() -> None:
    api_id = os.environ.get("TG_API_ID", "").strip()
    api_hash = os.environ.get("TG_API_HASH", "").strip()
    if not api_id or not api_hash:
        raise SystemExit("TG_API_ID and TG_API_HASH must be set in agent/.env")

    client = TelegramClient(
        StringSession(),
        int(api_id),
        api_hash,
        device_model="Desktop",
        system_version="Windows 10",
        app_version="5.6.3 x64",
    )
    await client.connect()
    try:
        phone = ask("Phone number with country code (e.g. +34...): ", "phone")
        sent = await client.send_code_request(phone)
        print(f"Code delivery type: {type(sent.type).__name__}", flush=True)
        code = ask("Login code: ", "code")
        try:
            await client.sign_in(phone, code)
        except SessionPasswordNeededError:
            await client.sign_in(password=ask("Two-step verification password: ", "password", secret=True))

        me = await client.get_me()
        print(f"Signed in as {me.first_name} (@{me.username or 'no username'}).", flush=True)
        deliver_session(client.session.save())
    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
