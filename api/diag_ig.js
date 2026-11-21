// TEMPORARY: sends a self-signed fake Meta comment webhook to /api/instagram. Delete after use.
"use strict";
const crypto = require("crypto");
const env = require("./_lib/env");
module.exports = async (req, res) => {
  const k = String((req.query && req.query.k) || "");
  if (crypto.createHash("sha256").update(k).digest("hex") !== "0e82c9190ccaa1d4b70636d548c280727d40061186bb3d64a885beb1c64aef69") return res.status(404).end();
  const secret = env.get("IG_APP_SECRET");
  const igId = env.get("IG_USER_ID");
  const text = String((req.query && req.query.t) || "Motion");
  const body = JSON.stringify({
    object: "instagram",
    entry: [{ id: igId, time: Math.floor(Date.now() / 1000), changes: [{ field: "comments", value: {
      id: "17999999999999999", text, from: { id: "17841400000000000", username: "diag_test_user" },
      media: { id: "17888888888888888", media_product_type: "REELS" } } }] }],
  });
  const sig = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  const r = await fetch("https://ar-design-agent.vercel.app/api/instagram", { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": sig }, body });
  res.status(200).json({ status: r.status, body: await r.text() });
};
