// Autonomous channel notes: three times a week a draft lands in the owner's chat for a one-tap approval.
//
// Scheduler: Vercel Cron (vercel.json -> "crons"), Mon/Wed/Fri 15:00 UTC (10:00 New York in winter, 11:00 in summer).
// Vercel sends "Authorization: Bearer <CRON_SECRET>" when the CRON_SECRET variable is set in the project.
// A backup trigger (cron-job.org) can call GET /api/channel_cron?key=<CRON_URL_KEY or the key from agent/cron_key.py>.
// The endpoint only creates a DRAFT and messages the owner; publishing needs the "Опубликовать" button.

"use strict";

const crypto = require("crypto");
const env = require("./_lib/env");
const channel = require("./_lib/channel");
const { cronKey } = require("./cron");

const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

module.exports = async function handler(req, res) {
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const given = String((req.query && req.query.key) || "");
  const secret = env.get("CRON_SECRET");
  const keys = [env.get("CRON_URL_KEY"), cronKey(env.get("TELEGRAM_BOT_TOKEN"))].filter((k) => k && k.length >= 24);
  const ok = (secret && bearer && same(secret, bearer)) || (given && keys.some((k) => same(k, given)));
  if (!ok) return res.status(401).end();

  try {
    const result = await channel.autopost({ manual: false });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error("channel_cron:", err && err.message);
    return res.status(500).json({ ok: false });
  }
};
