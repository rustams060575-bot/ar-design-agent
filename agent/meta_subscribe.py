"""One-off: subscribe the app behind the token to comments/messages of the Instagram account. Never prints tokens."""
import json
import os
import urllib.error
import urllib.parse
import urllib.request

V = os.getenv("IG_API_VERSION") or "v21.0"
G = f"https://graph.facebook.com/{V}"
TOKEN = os.environ["IG_ACCESS_TOKEN"]
IG = os.environ["IG_USER_ID"]


def call(method, path, **params):
    params["access_token"] = TOKEN
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


print("app behind token:", call("GET", "app", fields="id,name"))
print("ig account:", call("GET", IG, fields="username"))
print("subscribe:", call("POST", f"{IG}/subscribed_apps", subscribed_fields="comments,messages"))
print("current:", call("GET", f"{IG}/subscribed_apps"))
