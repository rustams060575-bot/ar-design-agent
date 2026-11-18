"use client";

import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/tg";
import { Em } from "./Em";
import { Reveal } from "./Reveal";

export function Tiers() {
  const { t } = useI18n();
  const toBrief = () => {
    haptic.light();
    document.getElementById("brief")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <section id="tiers" className="px-6 py-20">
      <div className="shell !px-0">
        <Reveal>
          <p className="label mb-4">{t.tiers.tag}</p>
          <h2 className="text-[clamp(2rem,9vw,3rem)] leading-[1.05]">
            <Em text={t.tiers.title} />
          </h2>
        </Reveal>
        <div className="mt-10 flex flex-col gap-4">
          {t.tiers.items.map((tier) => (
            <Reveal key={tier.label}>
              <div className="plate brackets px-5 py-6">
                <p className="label">{tier.label}</p>
                <p className="mt-3 text-[28px] font-semibold tracking-[-0.02em]">
                  {tier.price} <span className="label align-middle">{tier.unit} · {tier.duration}</span>
                </p>
                <h3 className="mt-2 text-[18px] font-semibold">{tier.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-sub">{tier.body}</p>
                <ul className="mt-4 flex flex-col gap-1.5 text-[14px] text-sub">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-em" aria-hidden>·</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={toBrief} className="btn-ghost mt-5">
                  {tier.cta} <span aria-hidden>↗</span>
                </button>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-[13px] text-dim">{t.tiers.footnote}</p>
      </div>
    </section>
  );
}
