import { getWebApp } from "./tg";

// Same-origin path: miniapp/vercel.json proxies it to the bot's /api/miniapp_lead, so no CORS and it works on any domain.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/miniapp_lead";

export interface Brief {
  task: string;
  budget: string;
  timeline: string;
  note?: string;
  contact?: string;
}

export type SubmitResult = { ok: true } | { ok: false; reason: "not-telegram" | "rate" | "failed" };

// The identity (name, @username, id) is NOT sent as form fields: the server reads it from the signed initData.
export async function submitBrief(brief: Brief): Promise<SubmitResult> {
  const app = getWebApp();
  if (!app) return { ok: false, reason: "not-telegram" };
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: app.initData, ...brief }),
    });
    if (res.ok) return { ok: true };
    return { ok: false, reason: res.status === 429 ? "rate" : "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
