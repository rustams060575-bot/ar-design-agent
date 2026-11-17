"use client";

import { LANGS, useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/tg";

// Language pill, like the one in the studio site's header. Fixed, so it stays reachable while scrolling.
export function LangSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div
      className="safe-top pointer-events-none fixed inset-x-0 top-0 z-40"
      style={{ paddingTop: "calc(max(env(safe-area-inset-top, 0px), var(--tg-safe-area-inset-top, 0px)) + var(--tg-content-safe-area-inset-top, 0px) + 10px)" }}
    >
      <div className="mx-auto flex max-w-[560px] justify-end px-4">
        <div role="group" aria-label="Language" className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-line/15 bg-bg/70 p-0.5 backdrop-blur-xl">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => {
                if (l === lang) return;
                haptic.light();
                setLang(l);
              }}
              className={`h-7 min-w-[34px] rounded-full px-2 font-mono text-[11px] font-semibold tracking-wider transition-colors duration-300 ${
                lang === l ? "bg-accent text-accent-ink" : "text-dim"
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
