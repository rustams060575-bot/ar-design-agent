// Language-independent data. All visible text lives in lib/i18n.tsx (English / Russian / Spanish).
// The TASKS / BUDGETS / TIMELINES values are validated by api/miniapp_lead.js: keep them identical.

export const PORTFOLIO_URL = "https://withardesign.com";

export const TASKS = ["Landing Page", "Corporate Redesign", "Interactive MVP", "Custom Web App"] as const;
export const BUDGETS = ["$3k–$5k", "$5k–$10k", "$10k+"] as const;
export const TIMELINES = ["As soon as possible", "Within a month", "In 2–3 months", "Flexible"] as const;

export interface Work {
  id: string;
  title: string;
  /** Replace the placeholder with real media: put files in public/works and set the paths. Keep videos light (under ~600 KB, muted, looping). */
  video?: string;
  poster?: string;
  url?: string;
}

// Visual placeholders: replace the titles and add video + poster per case.
export const works: Work[] = [
  { id: "w1", title: "Work 01" },
  { id: "w2", title: "Work 02" },
  { id: "w3", title: "Work 03" },
  { id: "w4", title: "Work 04" },
];
