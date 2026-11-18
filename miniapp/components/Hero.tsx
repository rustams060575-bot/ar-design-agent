"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { PORTFOLIO_URL } from "@/lib/content";
import { useI18n } from "@/lib/i18n";
import { haptic, openLink } from "@/lib/tg";

const ease = [0.16, 1, 0.3, 1] as const;

// Real clocks for the two places the studio works between (New York and Alicante).
function useClocks() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => {
      try {
        const f = (tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
        setT(`nyc ${f("America/New_York")} · alc ${f("Europe/Madrid")}`);
      } catch {
        setT("");
      }
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  return t;
}

export function Hero({ onStart }: { onStart: () => void }) {
  const { t } = useI18n();
  const hero = t.hero;
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const clocks = useClocks();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -60]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, reduce ? 1 : 0.2]);

  // "I design and build *interactive* websites." -> words, the starred one gets the serif accent
  let inEm = false;
  const words = hero.title.split(" ").map((w) => {
    if (w.startsWith("*")) inEm = true;
    const word = { text: w.replace(/\*/g, ""), em: inEm };
    if (w.endsWith("*")) inEm = false;
    return word;
  });

  return (
    <section ref={ref} className="safe-top relative flex min-h-[100svh] flex-col overflow-hidden px-6 pb-28">
      {/* ambient field */}
      <div className="pointer-events-none absolute inset-0 -z-0" aria-hidden>
        <div className="field-grid absolute inset-0" />
        <div className="glow -right-24 top-8 h-72 w-72 bg-accent/30" />
        <div className="glow -left-28 top-[48%] h-64 w-64 bg-em/10" style={{ animationDelay: "-6s" }} />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[560px] flex-1 flex-col">
        {/* status strip; the language pill is fixed at the right, so the strip leaves that corner free */}
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, ease }}
          className="flex min-h-[44px] items-center gap-3 border-b hairline pb-4 pr-[120px] pt-5"
        >
          <span className="label shrink-0">[ ar design ]</span>
          <span className="label flex min-w-0 items-center gap-2 truncate" dir="ltr">
            <i className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok" aria-hidden />
            {clocks || "online"}
          </span>
        </motion.div>

        <motion.div style={{ y, opacity }} className="flex flex-1 flex-col justify-center py-14">
          <h1 className="text-[clamp(1.9rem,8.6vw,4rem)] leading-[1.02]" aria-label={hero.title.replace(/\*/g, "")}>
            {words.map((w, i) => (
              <span key={`${i}-${w.text}`} className="mr-[0.2em] inline-block overflow-hidden align-top" aria-hidden>
                <motion.span
                  className={`inline-block ${w.em ? "serif-em" : ""}`}
                  initial={reduce ? false : { y: "112%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 1.05, delay: 0.1 + i * 0.07, ease }}
                >
                  {w.text}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.7, ease }}
            className="mt-7 max-w-[38ch] text-[16px] leading-relaxed text-sub"
          >
            {hero.lead}
          </motion.p>
          <p className="label mt-5">{hero.badge}</p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.95, ease }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <button type="button" onClick={onStart} className="btn-solid">
              {t.cta.start} <span aria-hidden>↗</span>
            </button>
            <button
              type="button"
              onClick={() => {
                haptic.light();
                openLink(PORTFOLIO_URL);
              }}
              className="btn-ghost"
            >
              {t.cta.teardown} <span aria-hidden>↗</span>
            </button>
          </motion.div>
        </motion.div>

        {/* focus tiles */}
        <motion.ul
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.2, ease }}
          className="grid grid-cols-3 gap-2"
        >
          {hero.focus.map((f, i) => (
            <li key={i} className="plate brackets px-3 py-3">
              <span className="label block">0{i + 1}</span>
              <span className="mt-2 block text-[12px] leading-snug text-sub">{f}</span>
            </li>
          ))}
        </motion.ul>
        <ul className="mt-2 grid grid-cols-3 gap-2">
          {hero.stats.map((st) => (
            <li key={st.label} className="plate px-3 py-3">
              <span className="block text-[18px] font-semibold tracking-[-0.01em]">{st.value}</span>
              <span className="label mt-1 block">{st.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
