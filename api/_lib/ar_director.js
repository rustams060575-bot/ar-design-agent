// AR Design Remote Director: owner-only commands that queue production requests for the LOCAL Creative Engine.
//
// Isolated, additive module. The webhook calls it only inside the owner branch (admin id + private chat), and it
// returns false for anything that is not one of its own commands, so existing James behaviour is unchanged.
// Storage: director_queue.json in the same PRIVATE GitHub repo as James' memory (store.js refuses public repos).
// The local engine pulls this file over outbound HTTPS; nothing local is ever exposed. This module never runs
// shell commands and never starts GPU work: it only records requests and approvals.

"use strict";

const crypto = require("crypto");
const env = require("./env");
const { createStore } = require("./store");
const nl = require("./ar_nl");

const PATH = "director_queue.json";
const MAX_TEXT = 3500;
const ACTIVE = ["new", "proposed", "approved", "running"];
const QUEUE_CMDS = ["film", "revise", "regen", "brief", "preview", "report", "retry", "continue", "auto"];
// Production control (active local production, e.g. NUMERO_1): bare commands are forwarded to the local controller.
const PROD_CMDS = ["retry", "continue", "auto"];
const LOCAL_CMDS = ["status", "ar_queue", "approve", "reject", "pause", "ar_help"];
const ICON = { new: "📥", proposed: "📝", approved: "✅", running: "⚙️", done: "🎬", failed: "❌", rejected: "✖️" };

const HELP =
  "🎬 AR Remote Director (локальный Creative Engine)\n\n" +
  "/film <сценарий> [economy|professional] — заявка на фильм\n" +
  "/revise <сценарий> <шот|title>\nprompt: …\ncamera: Zoom In\nduration: 2.0\nfocus: 0.6\ntext: … (для title)\n" +
  "/regen <сценарий> <шот> — новый дубль шота\n" +
  "/brief <свободный многострочный бриф> — Claude Code составит сценарий\n" +
  "/preview <сценарий> [quality] — последний фильм и контактный лист\n" +
  "/report <сценарий> [quality] — отчёт о качестве\n" +
  "/approve <id> · /reject <id> — подтвердить или отклонить план\n" +
  "/status — состояние движка · /ar_queue — очередь производства\n" +
  "/pause on|off — пауза запуска новых задач\n\n" +
  "Управление текущим производством (без параметров):\n" +
  "/status — сцена, прогресс, ошибки · /preview — актуальное превью\n" +
  "/approve — утвердить дубль · /retry — повторить текущую сцену\n" +
  "/pause — безопасная пауза · /continue — продолжить · /auto — автономно до финала\n\n" +
  "GPU-работа начинается только после /approve. /queue остаётся командой контент-очереди James.";

const empty = () => ({ version: 1, seq: 0, paused: false, requests: [], worker: null });
const normalize = (d) => (d && Array.isArray(d.requests) ? d : empty());

function queueStore() {
  return createStore({ ...env.storeEnv(), MEMORY_PATH: env.get("DIRECTOR_QUEUE_PATH") || PATH }, undefined, { empty, normalize });
}

// Full multiline argument (James' parseCommand flattens newlines and cuts at 400 chars, which briefs need).
function parse(text) {
  const m = /^\/([a-z_]+)(?:@\w+)?(?:[ \t]*\n|[ \t]+|$)([\s\S]*)$/i.exec(String(text || "").trim());
  return m ? { name: m[1].toLowerCase(), arg: m[2].replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").trim().slice(0, MAX_TEXT) } : null;
}

const age = (t) => (t ? Math.round((Date.now() / 1000 - t) / 60) : null);
const line = (r) => `${ICON[r.status] || "•"} #${r.id} ${r.cmd} ${String(r.text || "").split("\n")[0].slice(0, 60)} — ${r.status}`;

function statusText(doc) {
  const w = doc.worker || {};
  const mins = age(w.last_seen);
  const online = mins !== null && mins <= 10;
  const counts = {};
  for (const r of doc.requests) counts[r.status] = (counts[r.status] || 0) + 1;
  const running = doc.requests.find((r) => r.status === "running");
  return [
    "🎛 AR Creative Engine",
    `Локальный движок: ${online ? `🟢 на связи (${mins} мин назад)` : mins === null ? "⚪ ещё не подключался" : `🔴 нет связи ${mins} мин`}`,
    w.comfy ? `ComfyUI: ${w.comfy}` : null,
    `Пауза: ${doc.paused ? "⏸ включена" : "нет"}`,
    running ? `Сейчас: ⚙️ #${running.id} ${running.cmd}` : "Сейчас: простаивает",
    `Заявки: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ") || "нет"}`,
    productionText(doc.production),
  ].filter(Boolean).join("\n");
}

function productionText(p) {
  if (!p || !p.project) return null;
  const mins = age(p.updated);
  return [
    "",
    `🎬 Производство ${p.project}: ${p.state || "—"}${p.paused ? " · ⏸ пауза" : ""} · режим ${p.mode === "auto" ? "auto" : "по шагам"}`,
    p.scene ? `Сцена: ${p.scene}${p.take ? ` (дубль ${p.take})` : ""} · этап: ${p.stage || "—"}` : null,
    p.progress ? `Прогресс: ${p.progress}` : null,
    p.eta ? `Оценка: ${p.eta}` : null,
    p.error ? `⚠️ Ошибка: ${String(p.error).slice(0, 300)}` : "Ошибок нет",
    mins !== null ? `Обновлено ${mins} мин назад` : null,
  ].filter((x) => x !== null).join("\n");
}

async function handleOwnerMessage(message, { tg, updateId }) {
  const cmd = parse(message.text);
  if (!cmd || ![...QUEUE_CMDS, ...LOCAL_CMDS].includes(cmd.name)) return false;
  const chat = message.chat.id;
  const say = (text, extra = {}) => tg("sendMessage", { chat_id: chat, text: text.slice(0, 4000), disable_web_page_preview: true, ...extra });
  const done = async (text) => { await say(text); return true; };
  if (cmd.name === "ar_help") return done(HELP);

  const store = queueStore();
  if (!store.enabled) return done(`⚠️ Очередь режиссёра недоступна: ${store.reason}`);

  if (cmd.name === "status") return done(statusText(await store.read()));
  if (cmd.name === "ar_queue") {
    const doc = await store.read();
    const rows = doc.requests.slice(-12).reverse().map(line);
    return done(rows.length ? `🗂 Очередь производства:\n${rows.join("\n")}` : "🗂 Очередь производства пуста");
  }
  if (cmd.name === "pause") {
    const on = !/^(off|нет|выкл|0)$/i.test(cmd.arg);
    await store.update((doc) => { doc.paused = on; }, `director: pause ${on} [skip ci]`);
    return done(on ? "⏸ Пауза: новые задачи не запускаются; текущее производство остановится безопасно после текущего этапа. Продолжить: /continue" : "▶️ Пауза снята.");
  }
  // bare /approve and /preview address the active production; with an argument they keep their queue meaning
  const prod = PROD_CMDS.includes(cmd.name) || (!cmd.arg && (cmd.name === "approve" || cmd.name === "preview"));
  if (!prod && (cmd.name === "approve" || cmd.name === "reject")) return done(await decide(store, cmd.name, cmd.arg));
  if (!prod && !cmd.arg) return done(`Нужны параметры. /ar_help — формат команд.`);
  if (prod) {
    const { result } = await store.update((doc) => {
      const prev = typeof updateId === "number" && doc.requests.find((r) => r.update_id === updateId);
      if (prev) return { dup: prev.id };
      const id = ++doc.seq;
      if (cmd.name === "continue" || cmd.name === "auto") doc.paused = false;
      doc.requests.push({ id, key: `prod:${cmd.name}:${Date.now()}`, cmd: `prod_${cmd.name}`, text: cmd.arg || "", status: "new",
                          created: Math.floor(Date.now() / 1000), message_id: message.message_id,
                          update_id: typeof updateId === "number" ? updateId : null, history: [] });
      if (doc.requests.length > 200) doc.requests = doc.requests.filter((r, i, a) => ACTIVE.includes(r.status) || i >= a.length - 150);
      return { id, worker: doc.worker };
    }, `director: prod ${cmd.name} [skip ci]`);
    if (result.dup) return done(`↩️ Команда уже получена: #${result.dup}`);
    const mins = age(result.worker && result.worker.last_seen);
    return done(`📥 /${cmd.name} → локальное производство (#${result.id}). Ответ движка придёт в течение ~30 с.` +
                (mins === null || mins > 10 ? "\n⚠️ Локальный движок сейчас не на связи — команда выполнится при подключении." : ""));
  }
  const key = crypto.createHash("sha256").update(`${cmd.name}\n${cmd.arg}`).digest("hex").slice(0, 16);
  const { result } = await store.update((doc) => {
    const prev = typeof updateId === "number" && doc.requests.find((r) => r.update_id === updateId);
    if (prev) return { dup: prev.id };
    const same = doc.requests.find((r) => r.key === key && ACTIVE.includes(r.status));
    if (same) return { dup: same.id };
    const id = ++doc.seq;
    doc.requests.push({ id, key, cmd: cmd.name, text: cmd.arg, status: "new", created: Math.floor(Date.now() / 1000),
                        message_id: message.message_id, update_id: typeof updateId === "number" ? updateId : null, history: [] });
    if (doc.requests.length > 200) doc.requests = doc.requests.filter((r, i, a) => ACTIVE.includes(r.status) || i >= a.length - 150);
    return { id, worker: doc.worker };
  }, "director: new request [skip ci]");
  if (result.dup) return done(`↩️ Такая заявка уже в работе: #${result.dup}`);
  const mins = age(result.worker && result.worker.last_seen);
  const offline = mins === null || mins > 10;
  const nogpu = cmd.name === "preview" || cmd.name === "report";
  return done(`📥 Заявка #${result.id} принята (${cmd.name}).\n` +
             (nogpu ? "Локальный движок отправит материалы без рендера." : "Локальный движок пришлёт план и оценку времени; рендер — только после /approve " + result.id + ".") +
             (offline ? "\n⚠️ Локальный движок сейчас не на связи — заявка подождёт в очереди." : ""));
}

async function decide(store, action, arg) {
  const id = Number(String(arg).replace(/^#/, ""));
  if (!id) return `Укажите номер заявки: /${action} 12`;
  const { result } = await store.update((doc) => {
    const r = doc.requests.find((x) => x.id === id);
    if (!r) return "not_found";
    if (r.status !== "proposed") return `status:${r.status}`;
    r.status = action === "approve" ? "approved" : "rejected";
    r.history.push({ t: Math.floor(Date.now() / 1000), status: r.status, by: "owner" });
    return "ok";
  }, `director: ${action} #${id} [skip ci]`);
  if (result === "not_found") return `Заявка #${id} не найдена`;
  if (result.startsWith("status:")) return `Заявка #${id} сейчас в статусе «${result.slice(7)}» — подтверждать можно только план (proposed).`;
  return action === "approve" ? `✅ #${id} одобрена. Локальный движок запустит её по очереди.` : `✖️ #${id} отклонена.`;
}

// Inline buttons from the local engine's plan message: ard:approve:<id> / ard:reject:<id>.
async function handleCallback(cb, { tg }) {
  const nm = /^ard:nl:(auto|pause|continue|preview|status|approve|retry):(\d+)$/.exec(cb.data || "");
  if (nm) return handleNaturalCallback(cb, nm, { tg });
  const m = /^ard:(approve|reject):(\d+)$/.exec(cb.data || "");
  if (!m) return false;
  const store = queueStore();
  const text = store.enabled ? await decide(store, m[1], m[2]) : `Очередь недоступна: ${store.reason}`;
  try { await tg("answerCallbackQuery", { callback_query_id: cb.id, text: text.slice(0, 190) }); } catch (_) { /* expired callback */ }
  if (cb.message) {
    try { await tg("editMessageReplyMarkup", { chat_id: cb.message.chat.id, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } }); } catch (_) { /* already edited */ }
    await tg("sendMessage", { chat_id: cb.message.chat.id, text });
  }
  return true;
}

// ---------------------------------------------------------------- natural language (Russian) production control
// Local rules only (ar_nl.js): no LLM, no shell. Claims a plain message only when it is clearly about production:
// production words, or a live production / a recent production conversation and a short phrase. Everything else
// returns false and James answers as before. Each Telegram update / clarification is executed at most once.
const NL_HUMAN = { night: "запустить ночную смену", auto: "работать самостоятельно до финала", pause: "поставить на паузу", continue: "продолжить",
                   preview: "прислать превью", status: "рассказать о статусе", approve: "утвердить дубль", retry: "переделать дубль" };
const now = () => Math.floor(Date.now() / 1000);

function naturalStatus(doc) {
  const p = doc.production;
  if (!p || !p.project) return "Сейчас активного производства нет.";
  const mins = age(p.updated);
  return [
    `${p.project}: ${p.state || "—"}${p.paused ? " (на паузе)" : ""}, режим ${p.mode === "auto" ? "автономный" : "по шагам"}.`,
    p.scene ? `Сейчас ${p.scene}${p.take ? `, дубль ${p.take}` : ""} — ${p.stage || "—"}.` : null,
    p.progress ? `Прогресс: ${p.progress}.` : null,
    p.eta ? `До финала ${p.eta.replace(/^≈/, "примерно ").replace(" до финала", "")}.` : null,
    p.error ? `Есть ошибка: ${String(p.error).slice(0, 200)}` : "Ошибок нет.",
    mins !== null && mins > 10 ? `⚠️ Данные от движка ${mins} мин назад.` : null,
  ].filter(Boolean).join("\n");
}

async function nlExecute(store, action, { message, dedup, withStatus }) {
  const doc0 = await store.read();
  if (action === "status") {
    await store.update((doc) => { doc.nl_last = now(); }, "director: nl context [skip ci]");
    return naturalStatus(doc0);
  }
  const { result } = await store.update((doc) => {
    doc.nl_done = (doc.nl_done || []).slice(-80);
    if (doc.nl_done.includes(dedup)) return { dup: true };
    doc.nl_done.push(dedup);
    doc.nl_last = now();
    if (action === "pause") { doc.paused = true; return { paused: true, worker: doc.worker }; }
    if (action === "continue" || action === "auto" || action === "night") doc.paused = false;
    const id = ++doc.seq;
    doc.requests.push({ id, key: `nl:${dedup}`, cmd: `prod_${action}`, text: "", nl: true, status: "new", created: now(),
                        message_id: message ? message.message_id : null, update_id: null, history: [] });
    if (doc.requests.length > 200) doc.requests = doc.requests.filter((r, i, a) => ACTIVE.includes(r.status) || i >= a.length - 150);
    return { id, worker: doc.worker };
  }, `director: nl ${action} [skip ci]`);
  if (result.dup) return "Эту команду я уже выполнил — повторно не запускаю.";
  const mins = age(result.worker && result.worker.last_seen);
  const offline = mins === null || mins > 10 ? "\n⚠️ Локальный движок сейчас не на связи — выполнится, как только он подключится." : "";
  const p = doc0.production || {};
  const where = p.scene ? `${p.scene}${p.take ? `, дубль ${p.take}` : ""}` : "текущая сцена";
  const text = {
    night: `🌙 Принял. Проверяю компьютер и запускаю ночную смену (#${result.id}) — подтверждение придёт через полминуты.`,
    pause: `Готово — поставил производство на паузу. Текущий этап (${p.stage || "—"}) доработает, после этого движок безопасно остановится и подтвердит. Продолжить: «продолжай».`,
    auto: `Понял, дальше работаю самостоятельно до финального клипа — без промежуточных согласований. Команда #${result.id} передана движку, подтверждение придёт через полминуты.`,
    continue: `Хорошо, продолжаю производство (#${result.id}). Движок подтвердит через полминуты.`,
    preview: `Сейчас пришлю, что уже получилось (#${result.id}).`,
    approve: `Отлично, утверждаю: ${where} (#${result.id}). Движок подтвердит отдельным сообщением.`,
    retry: `Хорошо, переделаю: ${where} получит новый дубль, текущий сохраню (#${result.id}).`,
  }[action];
  return text + offline + (withStatus ? `\n\n${naturalStatus(doc0)}` : "");
}

// Never let natural-language handling break James: any error means "not mine" and James answers as usual.
async function handleNatural(message, text, opts) {
  try { return await naturalImpl(message, text, opts); }
  catch (err) { console.error("ar_director natural:", err && err.message); return false; }
}

async function naturalImpl(message, text, { tg, updateId, spoken = false }) {
  const c = nl.classify(text);
  if (!c.intents.length || c.words > 25) return false;
  const store = queueStore();
  if (!store.enabled) return false;
  const doc = await store.read();
  const p = doc.production;
  const live = !!(p && p.project && p.updated && now() - p.updated < 3 * 3600 && !/готово/.test(p.state || ""));
  const recent = !!(doc.nl_last && now() - doc.nl_last < 20 * 60);
  if (!(c.intents.includes("night") || c.prodWords || ((live || recent) && c.words <= 10))) return false;
  const r = nl.resolve(c.intents);
  if (!r) return false;
  const chat = message.chat.id;
  const echo = spoken ? `🎙 «${String(text).slice(0, 200)}»\n` : "";
  const say = (t, extra = {}) => tg("sendMessage", { chat_id: chat, text: (echo + t).slice(0, 4000), disable_web_page_preview: true,
                                                     reply_to_message_id: message.message_id, allow_sending_without_reply: true, ...extra });
  if (r.ask) {
    await store.update((d) => { d.nl_last = now(); }, "director: nl context [skip ci]");
    await say(`Уточните, пожалуйста: ${r.ask.map((a) => NL_HUMAN[a]).join(" или ")}?`, {
      reply_markup: { inline_keyboard: [r.ask.map((a) => ({ text: NL_HUMAN[a][0].toUpperCase() + NL_HUMAN[a].slice(1), callback_data: `ard:nl:${a}:${message.message_id}` }))] } });
    return true;
  }
  const dedup = typeof updateId === "number" ? `u:${updateId}` : `m:${message.message_id}`;
  await say(await nlExecute(store, r.action, { message, dedup, withStatus: r.withStatus }));
  return true;
}

async function handleNaturalCallback(cb, m, { tg }) {
  const store = queueStore();
  const text = store.enabled ? await nlExecute(store, m[1], { message: cb.message, dedup: `cb:${m[2]}` }) : `Очередь недоступна: ${store.reason}`;
  try { await tg("answerCallbackQuery", { callback_query_id: cb.id, text: text.slice(0, 190) }); } catch (_) { /* expired */ }
  if (cb.message) {
    try { await tg("editMessageReplyMarkup", { chat_id: cb.message.chat.id, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } }); } catch (_) { /* edited */ }
    await tg("sendMessage", { chat_id: cb.message.chat.id, text });
  }
  return true;
}

module.exports = { handleOwnerMessage, handleCallback, handleNatural, parse, statusText, HELP };
