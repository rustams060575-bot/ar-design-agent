// "Join this chat" commands from the owner, by text or by voice (the transcript arrives here as text).
//
//   "вступи в @name", "зайди в t.me/+AbCd...", "join https://t.me/name", /join <links>
//
// The bot only recognises the command and starts the GitHub workflow tg_join.yml with the links in its run name. The
// join itself is done by agent/tg_monitor.py, the single owner of the Telegram user session (see agent/tg_join.py).
// Env: GH_DISPATCH_TOKEN (Actions: write on the code repo), optional GITHUB_REPO / GITHUB_REF.

"use strict";

const env = require("./env");

const MAX_REFS = 5;
const REF = /(?:https?:\/\/)?(?:t|telegram)\.me\/(\+[\w-]{10,}|joinchat\/[\w-]{10,}|[A-Za-z][\w]{3,31})(?:\/\d+)?|(?<![\w@/])@([A-Za-z][\w]{3,31})/gi;
// verbs: вступи / зайди / присоединись / подпишись / добавь (в мониторинг|чат|канал) / join / subscribe
const VERB = /(вступ|зайд[иь]|заход|присоедин|подпиш|добав\w*\s+(?:в\s+)?(?:чат|канал|мониторинг|список)|\bjoin\b|subscribe|follow)/i;

function extractRefs(text) {
  const out = [];
  for (const m of String(text || "").matchAll(REF)) {
    let ref;
    if (m[2]) ref = "@" + m[2];
    else if (m[1].startsWith("+")) ref = "https://t.me/" + m[1];
    else if (/^joinchat\//i.test(m[1])) ref = "https://t.me/+" + m[1].split("/")[1];
    else ref = "@" + m[1];
    if (!out.some((x) => x.toLowerCase() === ref.toLowerCase())) out.push(ref);
  }
  return out.slice(0, MAX_REFS);
}

// A free-text message is a join command only when it has a join verb AND at least one link or @name.
function joinIntent(text) {
  const t = String(text || "");
  if (!VERB.test(t)) return null;
  const refs = extractRefs(t);
  return refs.length ? refs : null;
}

// "вступи в чат про фриланс" with no link or @name: clearly a join command, but there is nothing to join yet.
function looksLikeJoin(text) {
  return /(вступ|присоедин|\bjoin\b)/i.test(text) && /(чат|канал|групп|chat|channel|group)/i.test(text);
}

async function dispatchJoin(refs) {
  const repo = process.env.GITHUB_REPO || "rustams060575-bot/ar-design-agent";
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/tg_join.yml/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.get("GH_DISPATCH_TOKEN")}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ar-design-bot",
      "content-type": "application/json",
    },
    body: JSON.stringify({ ref: process.env.GITHUB_REF || "main", inputs: { chats: refs.join(" ") } }),
    signal: AbortSignal.timeout(10000),
  });
  if (res.status !== 204) console.error(`github join dispatch -> ${res.status}`);
  return res.status === 204;
}

const HOWTO =
  "Чтобы я вступил в чат, пришлите команду со ссылкой или @именем, например:\n" +
  "/join @название_чата\nвступи в t.me/+приглашение\n\nМожно голосом: назовите «вступи в» и продиктуйте @имя; " +
  "если распознаётся плохо, пришлите ссылку текстом. За раз до 5 чатов, в сутки до 10 вступлений.";

// Returns the text to send back to the owner.
async function handle(refsOrText) {
  const refs = Array.isArray(refsOrText) ? refsOrText : extractRefs(refsOrText);
  if (!refs.length) return HOWTO;
  const ok = await dispatchJoin(refs);
  if (!ok) return "⚠️ Не удалось передать запрос на вступление (GitHub Actions). Проверьте GH_DISPATCH_TOKEN в настройках Vercel.";
  return `🤝 Принял. Вступлю и добавлю в мониторинг:\n${refs.map((r) => "• " + r).join("\n")}\n\nОбычно это занимает до минуты, результат пришлю сообщением.`;
}

module.exports = { extractRefs, joinIntent, looksLikeJoin, handle, HOWTO };
