"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getWebApp, type TgWebApp } from "@/lib/tg";

type Scheme = "light" | "dark";
interface TgContext {
  app: TgWebApp | null;
  mounted: boolean;
  scheme: Scheme;
}

const Ctx = createContext<TgContext>({ app: null, mounted: false, scheme: "light" });
export const useTg = () => useContext(Ctx);

export const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Header, page background and bottom bar take the page's own colours, so Telegram's chrome melts into the design.
function paintChrome(app: TgWebApp) {
  const bg = cssVar("--bg");
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
  const [state, setState] = useState<TgContext>({ app: null, mounted: false, scheme: "light" });

  useEffect(() => {
    const app = getWebApp();
    const system: Scheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const apply = () => {
      const scheme: Scheme = app ? app.colorScheme : system;
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
