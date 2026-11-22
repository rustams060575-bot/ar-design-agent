"""Meta token check (read-only, writes nothing, never prints the token).

Run in your own terminal:   python agent/meta_check.py
It asks for the token with hidden input (and optionally App ID / App Secret), then reports:
token type, validity, expiry, granted scopes, Instagram user id + username, Facebook Pages (ids) behind it.
"""
import getpass
import json
import time
import urllib.error
import urllib.parse
import urllib.request

V = "v21.0"


def get(url, **params):
    q = urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(f"{url}?{q}", timeout=20) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode())
        except Exception:
            body = {}
        err = body.get("error", {})
        return e.code, {"error": f"{err.get('message', 'unknown')} (code {err.get('code')})"}
    except Exception as e:  # network
        return 0, {"error": type(e).__name__}


def mask(t):
    return f"{t[:6]}...{t[-4:]} (len={len(t)})"


def when(ts):
    if not ts:
        return "never / not reported"
    return time.strftime("%Y-%m-%d %H:%M", time.localtime(ts)) + f"  (in {max(0, int((ts - time.time()) / 86400))} days)"


def main():
    token = getpass.getpass("Paste token (hidden): ").strip()
    app_id = input("App ID (Enter to skip): ").strip()
    app_secret = getpass.getpass("App Secret (hidden, Enter to skip): ").strip() if app_id else ""
    print("\nToken:", mask(token))

    print("\n== A) Instagram Login style (graph.instagram.com) ==")
    s, d = get("https://graph.instagram.com/me", fields="user_id,username,account_type,media_count", access_token=token)
    print(s, d)

    print("\n== B) Facebook Login style (graph.facebook.com) ==")
    s, d = get(f"https://graph.facebook.com/{V}/me", fields="id,name", access_token=token)
    print(s, d)
    if s == 200:
        s2, d2 = get(f"https://graph.facebook.com/{V}/me/accounts",
                     fields="id,name,instagram_business_account{id,username}", access_token=token)
        pages = d2.get("data", []) if s2 == 200 else d2
        print("pages:", json.dumps(pages, ensure_ascii=False))
        s3, d3 = get(f"https://graph.facebook.com/{V}/me/permissions", access_token=token)
        if s3 == 200:
            print("granted:", sorted(p["permission"] for p in d3.get("data", []) if p.get("status") == "granted"))

    ig_id = input("\nInstagram user id to test (Enter to skip): ").strip()
    if ig_id:
        print("\n== D) Instagram account access (read-only) ==")
        print(get(f"https://graph.facebook.com/{V}/{ig_id}", fields="id,username,media_count", access_token=token))
        print("publishing limit:", get(f"https://graph.facebook.com/{V}/{ig_id}/content_publishing_limit",
                                       fields="quota_usage,config", access_token=token))

    if app_id and app_secret:
        print("\n== C) debug_token ==")
        s, d = get(f"https://graph.facebook.com/{V}/debug_token", input_token=token, access_token=f"{app_id}|{app_secret}")
        info = d.get("data", d)
        if isinstance(info, dict) and "error" not in info:
            print("type:", info.get("type"), "| valid:", info.get("is_valid"), "| app:", info.get("application"))
            print("expires:", when(info.get("expires_at")), "| data access until:", when(info.get("data_access_expires_at")))
            print("scopes:", info.get("scopes"))
        else:
            print(s, info)
    print("\nDone. Nothing was saved.")


if __name__ == "__main__":
    main()
