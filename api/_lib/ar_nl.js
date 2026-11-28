// AR Remote Director — natural-language (Russian) production control. Pure, local rules: no LLM, no tokens, no shell.
// classify(text) -> { intents: [...], prodWords: bool, words: n }. Tolerates casual phrasing, voice-transcription and
// keyboard typos (fuzzy word match), and simple negation ("не нравится" -> retry, "не останавливай" -> continue).
// Patterns run on " <normalized text> " — word edges are spaces (JS \b does not work with Cyrillic).
"use strict";

const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9\s]+/g, " ").replace(/\s+/g, " ").trim();

const PATTERNS = {
  night: [/ (пош(ел|ла)|иду|ухожу|ложусь) спать /],
  auto: [/автоном/, /самостоят/, / сам(а|и)? (дальше|до) /, / без меня /, / до (самого )?(конца|финал)/, / весь (фильм|ролик|клип)/,
         / не (жди|спрашивай)/, / на автомат/, / автомат/, / auto /],
  pause: [/ пауз/, /приостан/, / останов/, / стоп /, /притормоз/, / подожди/, / погоди/, / тормозни/, / замри/],
  continue: [/продолж/, /возобнов/, / сними (с )?пауз/, / поехали /, / работай дальше/, / дальше работ/, / жми дальше/, / запуска(й|ем) /, / запусти/],
  preview: [/ покаж/, / показ(ать|ывай)/, /превью/, / пришли/, / скинь/, / глян/, /посмотр/, / что (уже )?(получил|вышло|есть)/],
  status: [/ как (у нас |там |идут )?дела/, /статус/, / сколько (еще|осталось|времени|ждать)/, /прогресс/, / на каком (этапе|шаге)/,
           / что (сейчас|там) (идет|делаешь|происходит)/, / долго (еще )?/, / когда (будет|готов|закончи)/, / как (идет|продвига)/, / что происходит/],
  approve: [/утвержд/, /утверд/, /одобр/, / (мне )?нравит/, / приним/, /годится/, /подходит/, / беру /, / оставля(ем|й)/, / отлично /, / супер /, / класс /],
  retry: [/передел/, /перерендер/, / заново /, / еще раз/, / (другой|новый) дубль/, / не нравит/, / повтор/, / пересн/, / не то /],
};
// fuzzy keywords for typos / mis-transcriptions (Levenshtein <= 1, <= 2 for long words)
const FUZZY = {
  утверждаю: "approve", утверждаем: "approve", одобряю: "approve", переделай: "retry", переделать: "retry", повтори: "retry",
  приостанови: "pause", останови: "pause", пауза: "pause", паузу: "pause", продолжай: "continue", продолжить: "continue",
  продолжаем: "continue", покажи: "preview", превью: "preview", статус: "status", автономно: "auto", самостоятельно: "auto",
};
const PROD = /фильм|ролик|дубл|сцен|рендер|производств|кадр| шот|клип|numero|нумеро|превью|движ(ок|ка)|монтаж|генерац/;

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function classify(raw) {
  const t = norm(raw);
  const tp = ` ${t} `;
  const words = t ? t.split(" ") : [];
  const hits = new Set();
  for (const [intent, pats] of Object.entries(PATTERNS)) if (pats.some((p) => p.test(tp))) hits.add(intent);
  for (const w of words) for (const [k, intent] of Object.entries(FUZZY)) if (w.length >= 5 && lev(w, k) <= (k.length >= 8 ? 2 : 1)) hits.add(intent);
  // negation flips
  if (/ не нравит/.test(tp)) hits.delete("approve");
  if (/ не (утвержд|одобр|принима)/.test(tp)) { hits.delete("approve"); hits.add("retry"); }
  if (/ не (надо |нужно )?(останавлив|приостан|пауз|ставь на пауз)/.test(tp)) { hits.delete("pause"); hits.add("continue"); }
  if (/ не (надо |нужно )?(продолж|запуск)/.test(tp)) { hits.delete("continue"); hits.delete("auto"); hits.add("pause"); }
  return { intents: [...hits], prodWords: PROD.test(tp), words: words.length };
}

// Resolve several hits into one action (or an ambiguity to ask about). status may ride along with an action.
function resolve(intents) {
  const s = new Set(intents);
  const withStatus = s.has("status");
  s.delete("status");
  if (s.has("pause") && (s.has("continue") || s.has("auto"))) return { ask: ["pause", "continue"] };
  if (s.has("approve") && s.has("retry")) return { ask: ["approve", "retry"] };
  if (s.has("night")) return { action: "night", withStatus: false };
  for (const a of ["auto", "retry", "approve", "pause", "continue", "preview"]) if (s.has(a)) return { action: a, withStatus };
  return withStatus ? { action: "status" } : null;
}

module.exports = { classify, resolve, norm };
