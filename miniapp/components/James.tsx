"use client";

import { PORTFOLIO_URL } from "@/lib/content";
import { useI18n } from "@/lib/i18n";
import { getWebApp, haptic, openLink } from "@/lib/tg";
import { Em } from "./Em";
import { Reveal } from "./Reveal";

// James lives in the bot chat. Inside Telegram the button closes the Mini App and lands in that chat.
export function James() {
  const { t } = useI18n();
  const toChat = () => {
    haptic.light();
    const app = getWebApp();
    if (app) app.close();
    else openLink(PORTFOLIO_URL);
  };

  return (
    <section id="james" className="px-6 py-16">
      <div className="shell !px-0">
        <Reveal>
          <div className="plate brackets relative overflow-hidden px-6 py-8">
            <div className="glow -right-16 -top-16 h-40 w-40 bg-accent/25" aria-hidden />
            <div className="relative">
              <p className="label mb-4 flex items-center gap-2">
                <i className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden /> {t.james.tag}
              </p>
              <h2 className="text-[clamp(1.8rem,8vw,2.6rem)] leading-[1.05]">
                <Em text={t.james.title} />
              </h2>
              <p className="mt-3 max-w-[38ch] text-[15px] leading-relaxed text-sub">{t.james.lead}</p>
              <button type="button" onClick={toChat} className="btn-ghost mt-6">
                {t.cta.chatJames} <span aria-hidden>↗</span>
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
