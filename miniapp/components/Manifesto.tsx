"use client";

import { useI18n } from "@/lib/i18n";
import { Em } from "./Em";
import { Reveal } from "./Reveal";

export function Manifesto() {
  const { t } = useI18n();
  return (
    <section id="manifesto" className="px-6 py-20">
      <div className="shell !px-0">
        <Reveal>
          <p className="label mb-4">{t.manifesto.tag}</p>
          <p className="text-[clamp(1.5rem,6.6vw,2.1rem)] font-semibold leading-[1.2] tracking-[-0.02em]">
            <Em text={t.manifesto.text} />
          </p>
        </Reveal>
      </div>
    </section>
  );
}
