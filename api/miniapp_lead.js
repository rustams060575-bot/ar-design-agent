// Brief from the AR Design Telegram Mini App (app.withardesign.com) -> lead card in the owner's chat.
//
//   POST /api/miniapp_lead   { initData, task, budget, timeline, note?, contact? }
//
// The user's identity is NOT taken from the form: it comes from Telegram's signed initData, which is verified with
// HMAC-SHA256 (key = HMAC("WebAppData", bot token)) and must be fresh. A browser tab outside Telegram has no valid
// initData and is rejected, so the endpoint cannot be used to flood the owner's chat with forged leads.
//
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID / ADMIN_TELEGRAM_ID (owner), MINIAPP_URL (CORS origin, default
//      https://app.withardesign.com), MEMORY_REPO + GH_MEMORY_TOKEN (leads.json, optional: the card is sent anyway).

"use strict";

const crypto = require("crypto");
const env = require("./_lib/env");
const leads = require("./_lib/leads");
const { createStore } = require("./_lib/store");

const TASKS = ["Landing Page", "Corporate Redesign", "Interactive MVP", "Custom Web App"];
const BUDGETS = ["$3k–$5k", "$5k–$10k", "$10k+"];
const TIMELINES = ["As soon as possible", "Within a month", "In 2–3 months", "Flexible"];
const MAX_AGE_S = 24 * 3600;
const recent = new Map(); // warm-instance rate limit: one brief per user per 30 s

const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").trim().slice(0, n);
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Returns the Telegram user object, or null when the signature is wrong or the data is stale.
function verifyInitData(initData, botToken, now = Date.now()) {
  if (!initData || !botToken || initData.length > 4096) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = crypto.createHmac("sha256", secret).update(check).digest("hex");
  if (!/^[0-9a-f]{64}$/.test(hash) || !same(hash, expected)) return null;
  const age = Math.floor(now / 1000) - Number(params.get("auth_date") || 0);
  if (age < -60 || age > MAX_AGE_S) return null;
  try {
    const user = JSON.parse(params.get("user") || "null");
    return user && Number.isInteger(user.id) ? user : null;
  } catch (_) {
    return null;
  }
}

async function tg(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${env.get("TELEGRAM_BOT_TOKEN")}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) console.error(`telegram ${method} -> ${res.status}`);
  return res.ok;
}

function card(user, b) {
  const handle = user.username ? `@${esc(user.username)}` : "нет username";
  const name = esc([user.first_name, user.last_name].filter(Boolean).join(" ") || "без имени");
  return [
    "<b>Новая заявка из Mini App</b>",
    "",
    `<b>Имя:</b> ${name}`,
    `<b>Username:</b> ${handle}`,
    `<b>Задача:</b> ${esc(b.task)}`,
    `<b>Бюджет:</b> ${esc(b.budget)}`,
    `<b>Сроки:</b> ${esc(b.timeline)}`,
    b.contact ? `<b>Другой контакт:</b> ${esc(b.contact)}` : "",
    b.note ? `\n<b>Комментарий:</b>\n${esc(b.note)}` : "",
    `\n<code>id ${user.id}</code>`,
  ].filter((l) => l !== "").join("\n");
}

async function saveLead(user, b, now) {
  const store = createStore({ ...env.storeEnv(), MEMORY_PATH: process.env.LEADS_PATH || "leads.json" }, undefined, { empty: leads.emptyLeads, normalize: leads.normalizeLeads });
  if (!store.enabled) return;
  await store.update((db) => {
    const lead = getLeadFor(db, user, now);
    lead.profile.task = b.task;
    lead.profile.budget_note = b.budget;
    lead.profile.timeline = b.timeline;
    if (b.contact) lead.profile.contact = b.contact;
    lead.source = { code: "miniapp", label: "Telegram Mini App", at: new Date(now).toISOString() };
    lead.status = "handoff";
    lead.notified_new = true;
    lead.notified_handoff = true;
    lead.summary = clip(`${b.task} · ${b.budget} · ${b.timeline}${b.note ? " · " + b.note : ""}`, 300);
    leads.push(lead, "user", `[mini app] ${b.task} / ${b.budget} / ${b.timeline}${b.note ? " / " + b.note : ""}`, now);
  }, "leads: mini app brief [skip ci]");
}
const getLeadFor = (db, user, now) => leads.getLead(db, user, user.id, now);

module.exports = async function handler(req, res) {
  const origin = (process.env.MINIAPP_URL || "https://app.withardesign.com").replace(/\/+$/, "");
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const body = typeof req.body === "string" ? safeJson(req.body) : req.body || {};
  const user = verifyInitData(String(body.initData || ""), env.get("TELEGRAM_BOT_TOKEN"));
  if (!user) return res.status(401).json({ ok: false, error: "open this page from Telegram" });

  const b = {
    task: String(body.task || ""),
    budget: String(body.budget || ""),
    timeline: String(body.timeline || ""),
    note: clip(body.note, 500),
    contact: clip(body.contact, 120),
  };
  if (!TASKS.includes(b.task) || !BUDGETS.includes(b.budget) || !TIMELINES.includes(b.timeline)) {
    return res.status(400).json({ ok: false, error: "invalid brief" });
  }
  const now = Date.now();
  if (now - (recent.get(user.id) || 0) < 30000) return res.status(429).json({ ok: false, error: "already sent" });
  recent.set(user.id, now);
  if (recent.size > 500) recent.delete(recent.keys().next().value);

  const owner = /^-?\d+$/.test(env.get("ADMIN_TELEGRAM_ID")) ? env.get("ADMIN_TELEGRAM_ID") : env.get("TELEGRAM_CHAT_ID");
  if (!owner) return res.status(500).json({ ok: false, error: "owner chat is not configured" });

  // The button opens the client's dialog: t.me/<username> when there is one, otherwise a direct user link.
  const url = user.username ? `https://t.me/${user.username}` : `tg://user?id=${user.id}`;
  const delivered = await tg("sendMessage", {
    chat_id: owner,
    text: card(user, b),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [[{ text: "Открыть диалог с клиентом", url }]] },
  });
  if (!delivered) {
    recent.delete(user.id);
    return res.status(502).json({ ok: false, error: "could not deliver the brief" });
  }

  try {
    await saveLead(user, b, now);
  } catch (err) {
    console.error("miniapp lead store:", err && err.message); // the owner already has the card: the store is a bonus
  }
  // A short confirmation to the client, in the first person. Not critical: users who muted the bot still get the on-screen one.
  await tg("sendMessage", {
    chat_id: user.id,
    text: "Thanks, your brief reached me. I read every one myself and will reply here in this chat.\n\nRustam, AR Design\nhttps://withardesign.com",
    disable_web_page_preview: true,
  }).catch(() => {});
  return res.status(200).json({ ok: true });
};

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return {};
  }
}

module.exports.verifyInitData = verifyInitData;
module.exports.TASKS = TASKS;
module.exports.BUDGETS = BUDGETS;
module.exports.TIMELINES = TIMELINES;
