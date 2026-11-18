// The owner asks James to look for orders in plain words ("найди заказы", "поищи лиды по react", "scan for leads"):
// this must START the scan, never end up as a chat answer. Same effect as /search. Pure function, no I/O.

"use strict";

const VERB = /(?:найд\w*|най(?:ти|ди)|ищ\w*|поищ\w*|поиск\w*|собер\w*|сканир\w*|просканир\w*|мониторь|проверь|запуст\w*|начни|вкл\w*|find|search|scan|look\s+for|hunt|monitor|check)/i;
const OBJECT = /(?:заказ[а-яёa-z]*|лид[а-яёa-z]*|клиент[а-яёa-z]*|проект[а-яёa-z]*|задач[а-яёa-z]*|работ[а-яёa-z]*|вакан[а-яёa-z]*|чат[а-яёa-z]*|канал[а-яёa-z]*|orders?|leads?|clients?|projects?|gigs?|jobs?|requests?)/i;
const SEARCH_VERB = /(?:найд[а-яё]*|най(?:ти|ди)|ищ[а-яё]*|поищ[а-яё]*|поиск[а-яё]*|сканир[а-яё]*|просканир[а-яё]*|find|search|scan|hunt|look\s+for)/i;
const LEAD_WORD = /(?:заказ[а-яё]*|лид[а-яё]*|клиент[а-яё]*|вакан[а-яё]*|чат[а-яё]*|канал[а-яё]*|orders?|leads?|clients?|gigs?)/i;
const NOT_A_SCAN = /(?:вступи|join\b|памят|remember|запомни|забудь|рилс|карусел|пост\b|reel|carousel)/i;

/** -> null when the text is not a scan request, otherwise { query } (the optional focus, e.g. "react"). */
function scanIntent(text) {
  const t = String(text || "").trim();
  if (!t || t.startsWith("/") || t.length > 300 || NOT_A_SCAN.test(t)) return null;
  if (!OBJECT.test(t)) return null;
  // "check / run / enable / monitor" are only a scan request next to a lead-like word; "проверь проект клуба" is not.
  if (!SEARCH_VERB.test(t) && !(VERB.test(t) && LEAD_WORD.test(t))) return null;
  const m = t.match(new RegExp(OBJECT.source + String.raw`\s+(?:по|про|на|для|for|about|in|on)\s+([^,!?\n]{2,60})$`, "i"));
  const query = m ? m[1].replace(/^(?:запрос\w*|теме|тему)\s+/i, "").trim().slice(0, 100) : "";
  return { query };
}

module.exports = { scanIntent };
