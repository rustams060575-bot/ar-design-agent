// Language-independent data. All visible text lives in lib/i18n.tsx (English / Russian / Spanish).
// The TASKS / BUDGETS / TIMELINES values are validated by api/miniapp_lead.js: keep them identical.
// Source of truth for the content: https://withardesign.com (services, pricing, selected work).

export const PORTFOLIO_URL = "https://withardesign.com";

export const TASKS = ["Website", "Digital Product", "AI Agent", "Integrations"] as const;
export const BUDGETS = ["Teardown · $390", "Sprint · $12,500", "System · $18,500+"] as const;
export const TIMELINES = ["As soon as possible", "Within a month", "In 2–3 months", "Flexible"] as const;

export interface Work {
  id: string;
  title: string;
  /** Optional media: put files in public/works and set the paths. Keep videos light (under ~600 KB, muted, looping). */
  video?: string;
  poster?: string;
  url?: string;
}

// The three cases shown in "Selected work" on withardesign.com.
export const works: Work[] = [
  { id: "w1", title: "4Minds AI" },
  { id: "w2", title: "Veloce Pay" },
  { id: "w3", title: "Kinetix" },
];
