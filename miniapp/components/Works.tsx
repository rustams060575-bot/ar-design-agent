"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { works, type Work } from "@/lib/content";
import { useI18n } from "@/lib/i18n";
import { haptic, openLink } from "@/lib/tg";
import { Em } from "./Em";
import { Reveal } from "./Reveal";
import { WorkVisual } from "./WorkVisual";

function WorkCard({ work, index }: { work: Work; index: number }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();
  const [live, setLive] = useState(false);
  const [open, setOpen] = useState(false);

  // Parallax inside the frame and a gentle scale of the whole card while it crosses the screen.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const mediaY = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-6%", "6%"]);
  const scale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], reduce ? [1, 1, 1, 1] : [0.95, 1, 1, 0.97]);

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
        type="button"
        onClick={onTap}
        whileTap={{ scale: 0.985 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        data-live={live}
        aria-expanded={work.url ? undefined : open}
        className="block w-full text-left"
      >
        <div className="brackets relative aspect-[4/5] w-full overflow-hidden border hairline bg-elevated">
          <motion.div style={{ y: mediaY }} className="absolute -inset-[8%]">
            {work.video ? (
              <video ref={videoRef} src={work.video} poster={work.poster} muted loop playsInline preload="metadata" className="h-full w-full object-cover" />
            ) : (
              <div className="ph"><WorkVisual id={work.id} /></div>
            )}
          </motion.div>
          <span className="label absolute left-4 top-4">
            [ {String(index + 1).padStart(2, "0")} / {String(works.length).padStart(2, "0")} ]
          </span>
          <span className="label absolute bottom-4 right-4 flex items-center gap-1.5 text-em">
            {t.works.tap} <span aria-hidden>↗</span>
          </span>
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-4">
          <h3 className="text-[24px] font-semibold leading-tight tracking-[-0.02em]">{work.title}</h3>
          <span className="label shrink-0 text-right">{t.works.kinds[index]}</span>
        </div>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.p
            key="note"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden pt-2 text-[14px] text-sub"
          >
            {t.works.notes[index]}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export function Works() {
  const { t } = useI18n();
  return (
    <section id="works" className="px-6 py-24">
      <div className="shell !px-0">
        <Reveal>
          <p className="label mb-4">{t.works.tag}</p>
          <h2 className="text-[clamp(2rem,9vw,3rem)] leading-[1.05]">
            <Em text={t.works.title} />
          </h2>
          <p className="mt-3 text-[16px] text-sub">{t.works.lead}</p>
        </Reveal>
        <div className="mt-12 flex flex-col gap-14">
          {works.map((w, i) => (
            <WorkCard key={w.id} work={w} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
