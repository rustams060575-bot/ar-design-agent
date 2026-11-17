"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { copy, works, type Work } from "@/lib/content";
import { haptic, openLink } from "@/lib/tg";
import { Reveal } from "./Reveal";

// Hue per placeholder, so the four cards read as a set but are not identical.
const HUES = [28, 200, 150, 340];

function WorkCard({ work, index }: { work: Work; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();
  const [live, setLive] = useState(false);
  const [open, setOpen] = useState(false);

  // Parallax inside the card and a gentle scale of the whole card while it crosses the screen.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const mediaY = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-7%", "7%"]);
  const scale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], reduce ? [1, 1, 1, 1] : [0.94, 1, 1, 0.96]);

  // Play and animate only while visible: keeps four cards cheap on a phone.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setLive(entry.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (live && !reduce) v.play().catch(() => undefined);
    else v.pause();
  }, [live, reduce]);

  const onTap = () => {
    haptic.light();
    if (work.url) openLink(work.url);
    else setOpen((o) => !o);
  };

  return (
    <motion.article ref={ref} style={{ scale }} className="will-change-transform">
      <motion.button
        onClick={onTap}
        whileTap={{ scale: 0.985 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        data-live={live}
        aria-expanded={work.url ? undefined : open}
        className="block w-full text-left"
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[22px] bg-surface">
          <motion.div style={{ y: mediaY }} className="absolute inset-0">
            {work.video ? (
              <video
                ref={videoRef}
                src={work.video}
                poster={work.poster}
                muted
                loop
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="placeholder" style={{ ["--h" as string]: HUES[index % HUES.length] }} />
            )}
          </motion.div>
          <span className="absolute left-5 top-5 text-[13px] text-fg/70">{String(index + 1).padStart(2, "0")}</span>
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-4 px-1">
          <h3 className="text-[26px] leading-tight">{work.title}</h3>
          <span className="shrink-0 text-[13px] text-muted">{work.kind}</span>
        </div>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.p
            key="note"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden px-1 pt-2 text-[15px] text-muted"
          >
            {work.note}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export function Works() {
  return (
    <section id="works" className="px-6 py-24">
      <Reveal>
        <h2 className="text-[clamp(2.1rem,9vw,3.2rem)] leading-[1.05]">{copy.worksTitle}</h2>
        <p className="mt-3 text-[17px] text-muted">{copy.worksLead}</p>
      </Reveal>
      <div className="mt-12 flex flex-col gap-14">
        {works.map((w, i) => (
          <WorkCard key={w.id} work={w} index={i} />
        ))}
      </div>
    </section>
  );
}
