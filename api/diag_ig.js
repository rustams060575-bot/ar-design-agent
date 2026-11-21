// TEMPORARY: self-signed fake Meta comment webhook to /api/instagram. Delete after use.
"use strict";
const crypto = require("crypto");
const env = require("./_lib/env");
module.exports = async (req, res) => {
  const k = String((req.query && req.query.k) || "");
  if (crypto.createHash("sha256").update(k).digest("hex") !== "f9c9335e1b7bdc86b4c0f1a066f4ea3f01e39051d183b3922c9693856ae247c9") return res.status(404).end();
  const secret = env.get("IG_APP_SECRET");
  const body = JSON.stringify({ object: "instagram", entry: [{ id: env.get("IG_USER_ID"), time: Math.floor(Date.now() / 1000), changes: [{ field: "comments", value: {
    id: "17999999999999999", text: "Motion", from: { id: "17841400000000000", username: "diag_test_user" }, media: { id: "17888888888888888" } } }] }] });
  const sig = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  const r = await fetch("https://ar-design-agent.vercel.app/api/instagram", { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": sig }, body });
  res.status(200).json({ status: r.status });
};
