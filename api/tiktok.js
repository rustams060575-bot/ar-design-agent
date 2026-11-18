// TikTok connection for AR Design's own account: Login Kit (OAuth) + Content Posting API (Direct Post, FILE_UPLOAD).
//
//   /api/tiktok?action=login      -> redirects to TikTok's authorization page
//   /api/tiktok?action=callback   -> TikTok redirects here with ?code; the access token is kept in an httpOnly cookie
//   /api/tiktok?action=status     -> JSON: connected account name + creator info (privacy options)
//   /api/tiktok?action=publish    -> POST JSON {title, privacy_level}: uploads the sample reel and posts it
//   /api/tiktok?action=logout     -> clears the cookie
//
// Env (Vercel, Production): TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET. Secrets never reach the browser or the logs.
// Until TikTok audits the app, every post is private (SELF_ONLY): that is TikTok's rule, not a choice made here.
"use strict";

const crypto = require("crypto");

const SITE = "https://ar-design-agent.vercel.app";
const REDIRECT = `${SITE}/api/tiktok-callback`;  // TikTok forbids query parameters in a redirect URI; vercel.json rewrites this to ?action=callback
const SCOPES = "user.info.basic,video.publish,video.upload";
const API = "https://open.tiktokapis.com";
const SAMPLE = "https://raw.githubusercontent.com/rustams060575-bot/ar-design-agent/main/content-hub/ar02/R01/R01_five-second-question.mp4";

const cookies = (req) => Object.fromEntries((req.headers.cookie || "").split(/;\s*/).filter(Boolean).map((c) => {
  const i = c.indexOf("=");
  return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
}));
const setCookie = (res, name, value, maxAge) =>
  res.setHeader("Set-Cookie", [...(res.getHeader("Set-Cookie") || []), `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`]);
const json = (res, code, body) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); };

async function tt(path, token, body) {
  const r = await fetch(API + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body || {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || (data.error && data.error.code && data.error.code !== "ok")) {
    throw new Error(`${path}: ${(data.error && (data.error.message || data.error.code)) || r.status}`);
  }
  return data.data || {};
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, SITE);
  const action = url.searchParams.get("action") || "status";
  const key = process.env.TIKTOK_CLIENT_KEY, secret = process.env.TIKTOK_CLIENT_SECRET;
  if (!key || !secret) return json(res, 500, { error: "TikTok keys are not configured" });
  const c = cookies(req);

  try {
    if (action === "login") {
      const state = crypto.randomBytes(16).toString("hex");
      setCookie(res, "tt_state", state, 600);
      const q = new URLSearchParams({ client_key: key, scope: SCOPES, response_type: "code", redirect_uri: REDIRECT, state });
      res.statusCode = 302;
      res.setHeader("Location", `https://www.tiktok.com/v2/auth/authorize/?${q}`);
      return res.end();
    }

    if (action === "callback") {
      const code = url.searchParams.get("code");
      if (!code || !c.tt_state || url.searchParams.get("state") !== c.tt_state) {
        res.statusCode = 302; res.setHeader("Location", "/tiktok?error=auth"); return res.end();
      }
      const r = await fetch(`${API}/v2/oauth/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_key: key, client_secret: secret, code, grant_type: "authorization_code", redirect_uri: REDIRECT }),
      });
      const t = await r.json().catch(() => ({}));
      if (!t.access_token) { res.statusCode = 302; res.setHeader("Location", "/tiktok?error=token"); return res.end(); }
      setCookie(res, "tt_access", t.access_token, 3600);
      res.statusCode = 302; res.setHeader("Location", "/tiktok"); return res.end();
    }

    if (action === "logout") {
      setCookie(res, "tt_access", "", 0);
      res.statusCode = 302; res.setHeader("Location", "/tiktok"); return res.end();
    }

    const token = c.tt_access;
    if (!token) return json(res, 200, { connected: false });

    if (action === "status") {
      const u = await fetch(`${API}/v2/user/info/?fields=display_name,avatar_url`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
      const creator = await tt("/v2/post/publish/creator_info/query/", token);
      return json(res, 200, { connected: true, name: u.data && u.data.user && u.data.user.display_name, creator });
    }

    if (action === "publish" && req.method === "POST") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const { title = "", privacy_level } = JSON.parse(raw || "{}");
      const creator = await tt("/v2/post/publish/creator_info/query/", token);
      if (!(creator.privacy_level_options || []).includes(privacy_level)) return json(res, 400, { error: "privacy level not allowed for this account" });
      const video = Buffer.from(await (await fetch(SAMPLE)).arrayBuffer());
      const init = await tt("/v2/post/publish/video/init/", token, {
        post_info: { title: String(title).slice(0, 150), privacy_level, disable_comment: false, disable_duet: false, disable_stitch: false },
        source_info: { source: "FILE_UPLOAD", video_size: video.length, chunk_size: video.length, total_chunk_count: 1 },
      });
      const put = await fetch(init.upload_url, {
        method: "PUT",
        headers: { "Content-Type": "video/mp4", "Content-Length": String(video.length), "Content-Range": `bytes 0-${video.length - 1}/${video.length}` },
        body: video,
      });
      if (!put.ok) throw new Error(`upload failed (${put.status})`);
      const st = await tt("/v2/post/publish/status/fetch/", token, { publish_id: init.publish_id });
      return json(res, 200, { publish_id: init.publish_id, status: st.status });
    }

    return json(res, 400, { error: "unknown action" });
  } catch (e) {
    return json(res, 502, { error: String(e.message || e).slice(0, 300) });  // TikTok's message only; no request data, no tokens
  }
};
