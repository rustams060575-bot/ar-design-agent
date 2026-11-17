"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { hero, PORTFOLIO_URL } from "@/lib/content";
import { haptic, openLink } from "@/lib/tg";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -70]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, reduce ? 1 : 0.15]);
  const words = hero.title.split(" ");

  return (
    <section ref={ref} className="safe-top relative flex min-h-[100svh] flex-col justify-between px-6 pb-10">
      <motion.div style={{ y, opacity }} className="flex flex-1 flex-col justify-center pt-16">
        <motion.p
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease }}
          className="mb-8 text-[15px] text-muted"
        >
          {hero.eyebrow}
        </motion.p>

        <h1 className="text-[clamp(2.6rem,12.5vw,4.6rem)] leading-[1.02]" aria-label={hero.title}>
          {words.map((w, i) => (
            <span key={i} className="mr-[0.22em] inline-block overflow-hidden align-top" aria-hidden>
              <motion.span
                className="inline-block"
                initial={reduce ? false : { y: "110%" }}
                animate={{ y: 0 }}
                transition={{ duration: 1.05, delay: 0.12 + i * 0.07, ease }}
              >
                {w}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.7, ease }}
          className="mt-8 max-w-[34ch] text-[17px] leading-relaxed text-muted"
        >
          {hero.lead}
        </motion.p>

        <motion.button
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1, ease }}
          onClick={() => {
            haptic.light();
            openLink(PORTFOLIO_URL);
          }}
          className="mt-8 self-start border-b border-line pb-1 text-[15px] text-fg"
        >
          withardesign.com
        </motion.button>
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.3 }}
        className="flex items-center gap-3 text-[13px] text-muted"
        aria-hidden
      >
        <span className="relative block h-9 w-px overflow-hidden bg-line">
          <motion.span
            className="absolute left-0 top-0 block h-3 w-px bg-fg"
            animate={reduce ? undefined : { y: [-12, 36] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </span>
        Scroll
      </motion.div>
    </section>
  );
}
