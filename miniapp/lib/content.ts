// All copy and options live here. First person singular, quiet tone, no all-caps.
// The option strings for task / budget / timeline are validated by api/miniapp_lead.js: keep them identical.

export const PORTFOLIO_URL = "https://withardesign.com";

export const hero = {
  eyebrow: "AR Design",
  title: "I design and build interactive websites.",
  lead: "I'm Rustam, a solo designer and AI engineer. My work is scroll choreography, typography and Next.js builds, made with Claude Code and Cursor.",
};

export interface Work {
  id: string;
  title: string;
  kind: string;
  note: string;
  /** Replace the placeholder with real media: put files in public/works and set the paths. Keep videos light (under ~600 KB, muted, looping). */
  video?: string;
  poster?: string;
  url?: string;
}

// Visual placeholders: replace title / kind / note and add video + poster per case.
export const works: Work[] = [
  { id: "w1", title: "Work 01", kind: "Scroll-driven launch page", note: "Case study in progress." },
  { id: "w2", title: "Work 02", kind: "Corporate redesign", note: "Case study in progress." },
  { id: "w3", title: "Work 03", kind: "Interactive MVP", note: "Case study in progress." },
  { id: "w4", title: "Work 04", kind: "Custom web app", note: "Case study in progress." },
];

export const tasks = [
  { value: "Landing Page", hint: "One page, built to be remembered" },
  { value: "Corporate Redesign", hint: "A considered new face for an existing site" },
  { value: "Interactive MVP", hint: "A working product, designed and built end to end" },
  { value: "Custom Web App", hint: "Bespoke interface and logic" },
] as const;

export const budgets = [
  { value: "$3k–$5k", hint: "Focused scope" },
  { value: "$5k–$10k", hint: "Full design and build" },
  { value: "$10k+", hint: "Ambitious, multi-part work" },
] as const;

export const timelines = [
  { value: "As soon as possible", hint: "" },
  { value: "Within a month", hint: "" },
  { value: "In 2–3 months", hint: "" },
  { value: "Flexible", hint: "" },
] as const;

export const copy = {
  worksTitle: "Selected work",
  worksLead: "A few projects, shown in motion.",
  briefTitle: "Tell me about your project",
  briefLead: "Three quick steps. I read every brief myself.",
  steps: ["What do you need?", "Budget range", "Timing and contact"],
  doneTitle: "Brief received",
  doneLead: "Thank you. I'll reply to you here in Telegram.",
};
