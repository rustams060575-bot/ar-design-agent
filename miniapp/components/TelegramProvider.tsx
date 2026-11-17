"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getWebApp, type TgWebApp } from "@/lib/tg";

type Scheme = "dark" | "light";
interface TgContext {
  app: TgWebApp | null;
  mounted: boolean;
  scheme: Scheme;
}

const Ctx = createContext<TgContext>({ app: null, mounted: false, scheme: "dark" });
export const useTg = () => useContext(Ctx);

/** A colour token ("R G B" channels) as #rrggbb, the format Telegram's colour setters expect. */
export function hexVar(name: string): string {
  const channels = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/\s+/).map(Number);
  return "#" + channels.slice(0, 3).map((n) => Math.max(0, Math.min(255, n || 0)).toString(16).padStart(2, "0")).join("");
}

// Header, page background and bottom bar take the page's own colours, so Telegram's chrome melts into the design.
function paintChrome(app: TgWebApp) {
  const bg = hexVar("--bg");
  try {
    if (app.isVersionAtLeast("6.9")) {
      app.setHeaderColor?.(bg);
      app.setBackgroundColor?.(bg);
    }
    if (app.isVersionAtLeast("7.10")) app.setBottomBarColor?.(bg);
  } catch {
    /* an older client: the default chrome stays */
  }
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TgContext>({ app: null, mounted: false, scheme: "dark" });

  useEffect(() => {
    const app = getWebApp();
    // Dark is the studio's identity; the pearl variant is used only when the Telegram client itself is light.
    const apply = () => {
      const scheme: Scheme = app && app.colorScheme === "light" ? "light" : "dark";
      document.documentElement.dataset.theme = scheme;
      if (app) paintChrome(app);
      setState({ app, mounted: true, scheme });
    };
    apply();
    if (!app) return;

    app.ready();
    app.expand();
    try {
      // Full screen only on phones; on desktop the regular window is better.
      if ((app.platform === "ios" || app.platform === "android") && app.isVersionAtLeast("8.0")) app.requestFullscreen?.();
      // The page scrolls: a downward swipe at the top must not close the Mini App.
      if (app.isVersionAtLeast("7.7")) app.disableVerticalSwipes?.();
    } catch {
      /* optional features */
    }
    app.onEvent("themeChanged", apply);
    return () => app.offEvent("themeChanged", apply);
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
