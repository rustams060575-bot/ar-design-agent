// TEMPORARY diagnostic, to be deleted right after use. Prints only ids/names/URLs, never secrets.
"use strict";
const crypto = require("crypto");
const env = require("./_lib/env");
const APPS = { "997753093410243": "AR Design", "2357737865051942": "AR Design Agency" };
const g = async (url) => {
  try {
    const r = await fetch(url);
    const j = await r.json();
    return j.error ? { error: `${j.error.code}: ${j.error.message}` } : j;
  } catch (e) {
    return { error: String(e.message) };
  }
};
module.exports = async (req, res) => {
  const k = String((req.query && req.query.k) || "");
  if (crypto.createHash("sha256").update(k).digest("hex") !== "f00d72878bf14e3c6d3c00b69c101c129159e482bcc9a8fc2f598fbcc24d0700") return res.status(404).end();
  const V = env.get("IG_API_VERSION") || "v21.0";
  const host = env.get("IG_GRAPH_HOST") || "graph.facebook.com";
  const token = env.get("IG_ACCESS_TOKEN");
  const secret = env.get("IG_APP_SECRET");
  const out = { host, verifyTokenSet: !!env.get("IG_VERIFY_TOKEN"), verifyTokenLen: env.get("IG_VERIFY_TOKEN").length };
  out.tokenApp = await g(`https://graph.facebook.com/${V}/app?fields=id,name&access_token=${encodeURIComponent(token)}`);
  out.igUser = await g(`https://${host}/${V}/${env.get("IG_USER_ID")}?fields=username&access_token=${encodeURIComponent(token)}`);
  out.igSubscribedApps = await g(`https://graph.facebook.com/${V}/${env.get("IG_USER_ID")}/subscribed_apps?access_token=${encodeURIComponent(token)}`);
  out.secretMatches = {};
  out.webhookConfig = {};
  for (const id of Object.keys(APPS)) {
    const a = await g(`https://graph.facebook.com/${V}/${id}?fields=name&access_token=${id}|${encodeURIComponent(secret)}`);
    out.secretMatches[`${id} ${APPS[id]}`] = !a.error;
    if (!a.error) out.webhookConfig[`${id} ${APPS[id]}`] = await g(`https://graph.facebook.com/${V}/${id}/subscriptions?access_token=${id}|${encodeURIComponent(secret)}`);
  }
  res.status(200).json(out);
};
