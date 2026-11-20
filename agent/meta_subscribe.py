"""One-off: subscribe the app to webhook events for the Instagram account and the Facebook Page. Never prints tokens."""
import json
import os
import urllib.error
import urllib.parse
import urllib.request

V = os.getenv("IG_API_VERSION") or "v21.0"
G = f"https://graph.facebook.com/{V}"
TOKEN = os.environ["IG_ACCESS_TOKEN"]
IG = os.environ["IG_USER_ID"]
PAGE = os.environ["FB_PAGE_ID"]


def call(method, path, token, **params):
    params["access_token"] = token
    data = urllib.parse.urlencode(params).encode() if method == "POST" else None
    url = f"{G}/{path}" + ("" if method == "POST" else "?" + urllib.parse.urlencode(params))
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data, method=method), timeout=30) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read().decode()).get("error", {})
        except Exception:
            err = {}
        return e.code, {"error": f"{err.get('message', 'unknown')} (code {err.get('code')})"}


print("== Instagram account: subscribe comments + messages ==")
print(call("POST", f"{IG}/subscribed_apps", TOKEN, subscribed_fields="comments,messages"))
print("current:", call("GET", f"{IG}/subscribed_apps", TOKEN))

print("== Facebook Page: page token + subscribe messages ==")
s, d = call("GET", PAGE, TOKEN, fields="access_token")
page_token = d.get("access_token") if s == 200 else None
print("page token:", "obtained" if page_token else d)
if page_token:
    print(call("POST", f"{PAGE}/subscribed_apps", page_token, subscribed_fields="messages,feed"))
    print("current:", call("GET", f"{PAGE}/subscribed_apps", page_token))
