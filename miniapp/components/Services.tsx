"use client";

import { motion } from "framer-motion";
import { TASKS } from "@/lib/content";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/tg";
import { Em } from "./Em";
import { Reveal } from "./Reveal";

export const TASK_EVENT = "ar:task";

// Tapping a service preselects it in the brief and scrolls there.
function pick(value: string) {
  haptic.light();
  window.dispatchEvent(new CustomEvent(TASK_EVENT, { detail: value }));
  document.getElementById("brief")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Services() {
  const { t } = useI18n();
  return (
    <section id="services" className="px-6 py-20">
      <div className="shell !px-0">
        <Reveal>
          <p className="label mb-4">{t.services.tag}</p>
          <h2 className="text-[clamp(2rem,9vw,3rem)] leading-[1.05]">
            <Em text={t.services.title} />
          </h2>
          <p className="mt-3 text-[16px] text-sub">{t.services.lead}</p>
        </Reveal>

        <ul className="mt-10 divide-y divide-line/10 border-y hairline">
          {TASKS.map((value, i) => (
            <li key={value}>
              <motion.button
                type="button"
                onClick={() => pick(value)}
                whileTap={{ backgroundColor: "rgb(var(--em) / 0.06)" }}
                className="group flex w-full items-center gap-5 py-5 text-left"
              >
                <span className="label w-7 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1">
                  <span className="block text-[18px] font-semibold tracking-[-0.01em]">{t.services.tasks[value].label}</span>
                  <span className="mt-0.5 block text-[14px] text-sub">{t.services.tasks[value].hint}</span>
                </span>
                <span className="text-em transition-transform duration-300 group-active:translate-x-1" aria-hidden>
                  ↗
                </span>
              </motion.button>
            </li>
          ))}
        </ul>

        <Reveal className="mt-20">
          <p className="label mb-4">{t.process.tag}</p>
          <h2 className="text-[clamp(2rem,9vw,3rem)] leading-[1.05]">
            <Em text={t.process.title} />
          </h2>
        </Reveal>
        <ol className="mt-8 flex flex-col gap-3">
          {t.process.steps.map((s, i) => (
            <Reveal key={i}>
              <li className="plate brackets flex gap-5 px-5 py-5">
                <span className="label pt-0.5">0{i + 1}</span>
                <span>
                  <span className="block text-[16px] font-semibold">{s.t}</span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-sub">{s.d}</span>
                </span>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
