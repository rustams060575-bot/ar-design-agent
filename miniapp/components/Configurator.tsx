"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { budgets, copy, PORTFOLIO_URL, tasks, timelines } from "@/lib/content";
import { submitBrief } from "@/lib/submit";
import { getWebApp, haptic, openLink } from "@/lib/tg";
import { cssVar, useTg } from "./TelegramProvider";
import { Reveal } from "./Reveal";

type Step = 0 | 1 | 2 | 3; // 3 = confirmation
type HomeStatus = "unsupported" | "unknown" | "added" | "missed" | null;

const ease = [0.22, 1, 0.36, 1] as const;

// Line-drawing props for the confirmation mark. Typed loosely: framer-motion's SVG pathLength typing clashes with
// some @types/react versions even though it works at runtime.
const draw = (reduce: boolean, duration: number, delay: number) =>
  ({
    initial: reduce ? false : { pathLength: 0 },
    animate: { pathLength: 1 },
    transition: { duration, delay, ease },
  }) as unknown as { initial: never; animate: never; transition: never };

function Option({ label, hint, selected, onSelect }: { label: string; hint?: string; selected: boolean; onSelect: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.985 }}
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition-colors duration-300 ${
        selected ? "border-fg bg-surface" : "border-line"
      }`}
    >
      <span>
        <span className="block text-[17px] leading-snug">{label}</span>
        {hint ? <span className="mt-0.5 block text-[14px] text-muted">{hint}</span> : null}
      </span>
      <span className={`h-[18px] w-[18px] shrink-0 rounded-full border transition-colors duration-300 ${selected ? "border-fg bg-fg" : "border-line"}`} aria-hidden />
    </motion.button>
  );
}

export function Configurator() {
  const { app, mounted, scheme } = useTg();
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [task, setTask] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [note, setNote] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [home, setHome] = useState<HomeStatus>(null);

  const user = app?.initDataUnsafe?.user;
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  const started = !!(task || budget || timeline);

  // Is the brief on screen? Outside of it the native button leads the visitor to it.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const goTo = useCallback((next: Step) => {
    haptic.light();
    setError("");
    setStep(next);
  }, []);

  const send = useCallback(async () => {
    if (sending) return;
    setSending(true);
    setError("");
    const result = await submitBrief({ task, budget, timeline, note: note.trim(), contact: contact.trim() });
    setSending(false);
    if (result.ok || (!result.ok && result.reason === "rate")) {
      haptic.success();
      setStep(3);
      return;
    }
    haptic.error();
    setError(result.reason === "not-telegram" ? "Please open this page from Telegram to send your brief." : "Something went wrong. Please try again in a moment.");
  }, [sending, task, budget, timeline, note, contact]);

  const canContinue = step === 0 ? !!task : step === 1 ? !!budget : step === 2 ? !!timeline && !sending : false;
  const label = !inView ? (started ? "Continue brief" : "Start a brief") : step === 2 ? "Send brief" : "Continue";

  const onMain = useCallback(() => {
    if (!inView) {
      haptic.light();
      sectionRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      return;
    }
    if (!canContinue) return;
    if (step === 2) {
      haptic.light();
      void send();
    } else {
      goTo((step + 1) as Step);
    }
  }, [inView, canContinue, step, send, goTo, reduce]);

  // Native MainButton: label, state and colours follow the flow; colours follow the theme.
  useEffect(() => {
    if (!app) return;
    const mb = app.MainButton;
    mb.onClick(onMain);
    return () => mb.offClick(onMain);
  }, [app, onMain]);
  useEffect(() => {
    if (!app) return;
    const mb = app.MainButton;
    if (step === 3) {
      mb.hide();
      return;
    }
    mb.setParams({ text: label, color: cssVar("--fg"), text_color: cssVar("--bg"), is_active: !inView || canContinue, is_visible: true });
    if (sending) mb.showProgress(false);
    else mb.hideProgress();
  }, [app, label, inView, canContinue, sending, step, scheme]);

  // Native BackButton: one step back inside the brief.
  useEffect(() => {
    if (!app) return;
    const bb = app.BackButton;
    const back = () => goTo((step - 1) as Step);
    if (inView && step > 0 && step < 3) {
      bb.show();
      bb.onClick(back);
      return () => bb.offClick(back);
    }
    bb.hide();
  }, [app, inView, step, goTo]);

  // Home screen shortcut on the confirmation screen.
  useEffect(() => {
    if (step !== 3 || !app || !app.isVersionAtLeast("8.0") || !app.checkHomeScreenStatus) return;
    app.checkHomeScreenStatus((s) => setHome(s));
    const added = () => setHome("added");
    app.onEvent("homeScreenAdded", added);
    return () => app.offEvent("homeScreenAdded", added);
  }, [step, app]);

  const slide = (dir: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, x: 28 * dir },
    animate: { opacity: 1, x: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, x: -28 * dir },
    transition: { duration: 0.45, ease },
  });

  return (
    <section ref={sectionRef} id="brief" className="min-h-[100svh] px-6 pb-40 pt-24">
      {step < 3 && (
        <>
          <Reveal>
            <h2 className="text-[clamp(2.1rem,9vw,3.2rem)] leading-[1.05]">{copy.briefTitle}</h2>
            <p className="mt-3 text-[17px] text-muted">{copy.briefLead}</p>
          </Reveal>

          <div className="mt-10 flex items-center gap-3 text-[14px] text-muted">
            <span>
              {step + 1} / 3
            </span>
            <span className="relative h-px flex-1 bg-line">
              <motion.span className="absolute left-0 top-0 h-px bg-fg" initial={false} animate={{ width: `${((step + 1) / 3) * 100}%` }} transition={{ duration: 0.6, ease }} />
            </span>
          </div>
        </>
      )}

      <div className="mt-8">
        <AnimatePresence mode="wait" initial={false}>
          {step === 0 && (
            <motion.div key="s0" {...slide(1)}>
              <h3 className="mb-5 text-[26px] leading-tight">{copy.steps[0]}</h3>
              <div className="flex flex-col gap-3">
                {tasks.map((t) => (
                  <Option key={t.value} label={t.value} hint={t.hint} selected={task === t.value} onSelect={() => { haptic.light(); setTask(t.value); }} />
                ))}
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s1" {...slide(1)}>
              <h3 className="mb-5 text-[26px] leading-tight">{copy.steps[1]}</h3>
              <div className="flex flex-col gap-3">
                {budgets.map((b) => (
                  <Option key={b.value} label={b.value} hint={b.hint} selected={budget === b.value} onSelect={() => { haptic.light(); setBudget(b.value); }} />
                ))}
              </div>
              <p className="mt-4 text-[14px] text-muted">A rough range is enough. I can refine it with you once I have read the brief.</p>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" {...slide(1)}>
              <h3 className="mb-5 text-[26px] leading-tight">{copy.steps[2]}</h3>
              <div className="flex flex-col gap-3">
                {timelines.map((t) => (
                  <Option key={t.value} label={t.value} selected={timeline === t.value} onSelect={() => { haptic.light(); setTimeline(t.value); }} />
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-line px-5 py-4">
                <p className="text-[13px] text-muted">I will reply to</p>
                {user ? (
                  <p className="mt-1 text-[17px]">
                    {fullName || "Your Telegram account"}
                    {user.username ? <span className="text-muted"> @{user.username}</span> : null}
                  </p>
                ) : (
                  <p className="mt-1 text-[15px] text-muted">{mounted ? "Open this page from Telegram so I can see who to reply to." : " "}</p>
                )}
              </div>

              {user && !user.username && (
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={120}
                  placeholder="Email or phone, if you prefer (optional)"
                  className="mt-3 w-full rounded-2xl border border-line bg-transparent px-5 py-4 text-[16px] outline-none placeholder:text-muted focus:border-fg"
                />
              )}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Anything I should know? (optional)"
                className="mt-3 w-full resize-none rounded-2xl border border-line bg-transparent px-5 py-4 text-[16px] outline-none placeholder:text-muted focus:border-fg"
              />
              {error ? <p className="mt-3 text-[14px] text-fg" role="alert">{error}</p> : null}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="done" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease }} className="pt-10">
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden>
                <motion.circle cx="22" cy="22" r="20.5" stroke="currentColor" strokeWidth="1" {...draw(!!reduce, 1, 0)} />
                <motion.path d="M13 22.5l6 6 12-13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...draw(!!reduce, 0.8, 0.5)} />
              </svg>
              <h2 className="mt-8 text-[clamp(2.1rem,9vw,3.2rem)] leading-[1.05]">{copy.doneTitle}</h2>
              <p className="mt-3 max-w-[32ch] text-[17px] text-muted">{copy.doneLead}</p>

              <dl className="mt-10 divide-y divide-line border-y border-line text-[15px]">
                {[
                  ["Project", task],
                  ["Budget", budget],
                  ["Timing", timeline],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-6 py-3">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-10 flex flex-col items-start gap-5">
                {app && home !== "unsupported" && home !== null && (
                  <button
                    type="button"
                    disabled={home === "added"}
                    onClick={() => {
                      haptic.light();
                      app.addToHomeScreen?.();
                    }}
                    className="rounded-full border border-fg px-6 py-3 text-[16px] transition-opacity disabled:border-line disabled:text-muted"
                  >
                    {home === "added" ? "AR Design is on your home screen" : "Add AR Design to your home screen"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    haptic.light();
                    openLink(PORTFOLIO_URL);
                  }}
                  className="border-b border-line pb-1 text-[15px]"
                >
                  See the portfolio at withardesign.com
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Outside Telegram there is no native button: a plain one keeps the flow usable for preview. */}
      {mounted && !getWebApp() && step < 3 && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 bg-bg/90 px-6 pt-3 backdrop-blur">
          <button
            type="button"
            onClick={onMain}
            disabled={inView && !canContinue}
            className="mb-3 w-full rounded-2xl bg-fg py-4 text-[16px] text-bg transition-opacity disabled:opacity-40"
          >
            {label}
          </button>
        </div>
      )}
    </section>
  );
}
