"use client";

import { useI18n } from "@/lib/i18n";
import { haptic, openLink } from "@/lib/tg";
import { Em } from "./Em";
import { Reveal } from "./Reveal";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer id="contact" className="px-6 pb-16 pt-10">
      <div className="shell !px-0">
        <Reveal>
          <p className="label mb-4">{t.footer.tag}</p>
          <h2 className="text-[clamp(1.8rem,8vw,2.6rem)] leading-[1.05]">
            <Em text={t.footer.title} />
          </h2>
          <p className="mt-4 max-w-[40ch] text-[14px] leading-relaxed text-sub">{t.footer.about}</p>
          <button
            type="button"
            onClick={() => {
              haptic.light();
              openLink(`mailto:${t.footer.email}`);
            }}
            className="btn-ghost mt-6"
          >
            {t.footer.email} <span aria-hidden>↗</span>
          </button>
          <p className="label mt-10">© 2026 AR Design</p>
        </Reveal>
      </div>
    </footer>
  );
}
