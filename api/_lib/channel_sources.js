// Fresh material for the autonomous channel notes: public RSS/Atom feeds and the Hacker News search API.
// No logins and no scraping of walled sites. Everything fetched here is untrusted text: it is passed to the model
// as data inside <material> tags and never as instructions.

"use strict";

const FEEDS = [
  { name: "smashing magazine", url: "https://www.smashingmagazine.com/feed/" },
  { name: "css-tricks", url: "https://css-tricks.com/feed/" },
  { name: "web.dev", url: "https://web.dev/feed.xml" },
  { name: "vercel", url: "https://vercel.com/atom" },
  { name: "awwwards", url: "https://www.awwwards.com/blog/feed/" },
];

// Hacker News search terms (Algolia API): UI/UX, interactive web, AI-assisted engineering.
const HN_QUERIES = ["scroll animation", "typography web", "next.js", "claude code", "cursor editor", "design system"];

// Topics used when no feed is reachable: the note then comes from my own expertise, with no source link.
const EVERGREEN_TOPICS = [
  "scroll choreography: why easing and pacing matter more than the effect itself",
  "typography on the web: one typeface, three sizes, real hierarchy",
  "motion restraint: when an animation should not exist",
  "next.js app router: keeping an animated page fast on a mid-range phone",
  "working with claude code and cursor: what i delegate and what i keep for myself",
  "spacing and rhythm: the invisible part of quiet interfaces",
];

const MAX_AGE_DAYS = 21;
const FEED_TIMEOUT_MS = 8000;
const FEED_BYTES = 250000; // Smashing's feed is 1.4 MB: only the newest entries at the top are needed

const decode = (s) =>
  String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, "&");
const stripTags = (s) => decode(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const pick = (block, tag) => {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  return m ? m[1] : "";
};

function parseFeed(xml, source) {
  const out = [];
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks.slice(0, 12)) {
    const title = stripTags(pick(b, "title"));
    let url = stripTags(pick(b, "link"));
    if (!url) {
      const m = /<link[^>]*href=["']([^"']+)["']/i.exec(b); // Atom: the link is an attribute
      url = m ? m[1] : "";
    }
    const snippet = stripTags(pick(b, "description") || pick(b, "summary") || pick(b, "content:encoded") || pick(b, "content")).slice(0, 400);
    const date = Date.parse(stripTags(pick(b, "pubDate") || pick(b, "updated") || pick(b, "published")));
    if (title && /^https?:\/\//.test(url)) out.push({ title, url, snippet, source, date: Number.isFinite(date) ? date : 0 });
  }
  return out;
}

async function fetchFeed(feed) {
  const res = await fetch(feed.url, { signal: AbortSignal.timeout(FEED_TIMEOUT_MS), headers: { "user-agent": "Mozilla/5.0 (compatible; ar-design-bot)" } });
  if (!res.ok) throw new Error(`${feed.name} HTTP ${res.status}`);
  return parseFeed((await res.text()).slice(0, FEED_BYTES), feed.name);
}

async function fetchHn() {
  const since = Math.floor(Date.now() / 1000) - MAX_AGE_DAYS * 86400;
  const jobs = HN_QUERIES.map(async (q) => {
    const url =
      "https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=5&query=" + encodeURIComponent(q) +
      "&numericFilters=" + encodeURIComponent(`points>60,created_at_i>${since}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`hn HTTP ${res.status}`);
    const data = await res.json();
    return (data.hits || [])
      .filter((h) => h.title && h.url)
      .map((h) => ({ title: String(h.title), url: String(h.url), snippet: `hacker news discussion, ${h.points} points`, source: "hacker news", date: Date.parse(h.created_at) || 0 }));
  });
  const settled = await Promise.allSettled(jobs);
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

// Returns up to `limit` fresh candidates not yet used (seenUrls), newest first, with at most 4 per source so that
// one prolific feed cannot crowd out the rest.
async function fetchCandidates(seenUrls = [], limit = 14) {
  const seen = new Set(seenUrls);
  const settled = await Promise.allSettled([...FEEDS.map(fetchFeed), fetchHn()]);
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  const all = settled
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter((c) => !seen.has(c.url) && (!c.date || c.date >= cutoff))
    .sort((a, b) => b.date - a.date);
  const perSource = {};
  const out = [];
  for (const c of all) {
    perSource[c.source] = (perSource[c.source] || 0) + 1;
    if (perSource[c.source] <= 4) out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

const randomTopic = () => EVERGREEN_TOPICS[Math.floor(Math.random() * EVERGREEN_TOPICS.length)];

module.exports = { fetchCandidates, randomTopic, parseFeed, FEEDS };
