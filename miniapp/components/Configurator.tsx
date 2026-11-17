"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BUDGETS, PORTFOLIO_URL, TASKS, TIMELINES } from "@/lib/content";
import { useI18n } from "@/lib/i18n";
import { submitBrief } from "@/lib/submit";
import { getWebApp, haptic, openLink } from "@/lib/tg";
import { hexVar, useTg } from "./TelegramProvider";
import { Em } from "./Em";
import { Reveal } from "./Reveal";
import { TASK_EVENT } from "./Services";

type Step = 0 | 1 | 2 | 3; // 3 = confirmation
type HomeStatus = "unsupported" | "unknown" | "added" | "missed" | null;

const ease = [0.16, 1, 0.3, 1] as const;

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
      className={`relative flex w-full items-center justify-between gap-4 border px-5 py-4 text-left transition-[border-color,background-color,box-shadow] duration-300 ${
        selected ? "border-em/70 bg-em/10 shadow-[0_0_24px_-10px_rgb(var(--em)/0.7)]" : "hairline bg-elevated/40"
      }`}
    >
      <span>
        <span className="block text-[16px] font-medium leading-snug">{label}</span>
        {hint ? <span className="mt-0.5 block text-[13px] text-sub">{hint}</span> : null}
      </span>
      <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${selected ? "border-em bg-em" : "border-line/30"}`} aria-hidden>
        {selected ? <i className="h-1.5 w-1.5 rounded-full bg-bg" /> : null}
      </span>
    </motion.button>
  );
}

export function Configurator() {
  const { app, mounted, scheme } = useTg();
  const { t } = useI18n();
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

  // A tap on a service above preselects the task and returns the brief to its first step.
  useEffect(() => {
    const on = (e: Event) => {
      const v = (e as CustomEvent<string>).detail;
      if ((TASKS as readonly string[]).includes(v)) {
        setTask(v);
        setStep((s) => (s === 3 ? s : 0));
      }
    };
    window.addEventListener(TASK_EVENT, on);
    return () => window.removeEventListener(TASK_EVENT, on);
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
    setError(result.reason === "not-telegram" ? t.brief.notTelegram : t.brief.failed);
  }, [sending, task, budget, timeline, note, contact, t]);

  const canContinue = step === 0 ? !!task : step === 1 ? !!budget : step === 2 ? !!timeline && !sending : false;
  const label = !inView ? (started ? t.cta.cont : t.cta.start) : step === 2 ? t.cta.send : t.cta.next;

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
    mb.setParams({ text: label, color: hexVar("--accent"), text_color: hexVar("--accent-ink"), is_active: !inView || canContinue, is_visible: true });
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

  const slide = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, x: -24 },
    transition: { duration: 0.45, ease },
  };

  return (
    <section ref={sectionRef} id="brief" className="min-h-[100svh] px-6 pb-44 pt-24">
      <div className="shell !px-0">
        {step < 3 && (
          <>
            <Reveal>
              <p className="label mb-4">{t.brief.tag}</p>
              <h2 className="text-[clamp(2rem,9vw,3rem)] leading-[1.05]">
                <Em text={t.brief.title} />
              </h2>
              <p className="mt-3 text-[16px] text-sub">{t.brief.lead}</p>
            </Reveal>

            {/* segmented progress */}
            <div className="mt-10 flex items-center gap-3">
              <span className="label shrink-0">[ 0{step + 1} / 03 ]</span>
              <div className="grid flex-1 grid-cols-3 gap-1.5" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="relative h-px bg-line/20">
                    <motion.span className="absolute inset-y-0 left-0 bg-em" initial={false} animate={{ width: i <= step ? "100%" : "0%" }} transition={{ duration: 0.6, ease }} />
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-8">
          <AnimatePresence mode="wait" initial={false}>
            {step === 0 && (
              <motion.div key="s0" {...slide}>
                <h3 className="mb-5 text-[22px] font-semibold leading-tight tracking-[-0.02em]">{t.brief.steps[0]}</h3>
                <div className="flex flex-col gap-2.5">
                  {TASKS.map((v) => (
                    <Option key={v} label={t.services.tasks[v].label} hint={t.services.tasks[v].hint} selected={task === v} onSelect={() => { haptic.light(); setTask(v); }} />
                  ))}
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="s1" {...slide}>
                <h3 className="mb-5 text-[22px] font-semibold leading-tight tracking-[-0.02em]">{t.brief.steps[1]}</h3>
                <div className="flex flex-col gap-2.5">
                  {BUDGETS.map((v) => (
                    <Option key={v} label={v} hint={t.brief.budgets[v]} selected={budget === v} onSelect={() => { haptic.light(); setBudget(v); }} />
                  ))}
                </div>
                <p className="mt-4 text-[13px] text-dim">{t.brief.budgetNote}</p>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" {...slide}>
                <h3 className="mb-5 text-[22px] font-semibold leading-tight tracking-[-0.02em]">{t.brief.steps[2]}</h3>
                <div className="flex flex-col gap-2.5">
                  {TIMELINES.map((v) => (
                    <Option key={v} label={t.brief.timelines[v]} selected={timeline === v} onSelect={() => { haptic.light(); setTimeline(v); }} />
                  ))}
                </div>

                <div className="plate brackets mt-6 px-5 py-4">
                  <p className="label">{t.brief.replyTo}</p>
                  {user ? (
                    <p className="mt-1.5 text-[16px]">
                      {fullName || t.brief.account}
                      {user.username ? <span className="text-em"> @{user.username}</span> : null}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[14px] text-sub">{mounted ? t.brief.openInTg : " "}</p>
                  )}
                  <p className="label mt-3 border-t hairline pt-3">
                    {task ? t.services.tasks[task]?.label : "—"} · {budget || "—"}
                  </p>
                </div>

                {user && !user.username && (
                  <input
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    maxLength={120}
                    placeholder={t.brief.contactPh}
                    className="mt-3 w-full border hairline bg-transparent px-5 py-4 text-[15px] outline-none placeholder:text-dim focus:border-em/60"
                  />
                )}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder={t.brief.notePh}
                  className="mt-3 w-full resize-none border hairline bg-transparent px-5 py-4 text-[15px] outline-none placeholder:text-dim focus:border-em/60"
                />
                {error ? <p className="mt-3 text-[14px] text-danger" role="alert">{error}</p> : null}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="done" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease }} className="pt-6">
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none" className="text-em" aria-hidden>
                  <motion.circle cx="22" cy="22" r="20.5" stroke="currentColor" strokeWidth="1" {...draw(!!reduce, 1, 0)} />
                  <motion.path d="M13 22.5l6 6 12-13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...draw(!!reduce, 0.8, 0.5)} />
                </svg>
                <p className="label mt-8">{t.done.status} <span className="text-ok">{t.done.received}</span></p>
                <h2 className="mt-3 text-[clamp(2rem,9vw,3rem)] leading-[1.05]">
                  <Em text={t.done.title} />
                </h2>
                <p className="mt-3 max-w-[32ch] text-[16px] text-sub">{t.done.lead}</p>

                <dl className="plate brackets mt-9 divide-y divide-line/10 text-[14px]">
                  {[
                    [t.done.project, task ? t.services.tasks[task]?.label : ""],
                    [t.done.budget, budget],
                    [t.done.timing, timeline ? t.brief.timelines[timeline] : ""],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-6 px-5 py-3.5">
                      <dt className="label">{k}</dt>
                      <dd className="text-right">{v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-9 flex flex-col items-start gap-4">
                  {app && home !== "unsupported" && home !== null && (
                    <button
                      type="button"
                      disabled={home === "added"}
                      onClick={() => {
                        haptic.light();
                        app.addToHomeScreen?.();
                      }}
                      className="btn-solid disabled:opacity-50"
                    >
                      {home === "added" ? t.cta.homeAdded : t.cta.homeAdd}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      haptic.light();
                      openLink(PORTFOLIO_URL);
                    }}
                    className="btn-ghost"
                  >
                    {t.cta.portfolio} ↗
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Outside Telegram there is no native button: a plain one keeps the flow usable for preview. */}
      {mounted && !getWebApp() && step < 3 && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 bg-bg/90 px-6 pt-3 backdrop-blur">
          <button type="button" onClick={onMain} disabled={inView && !canContinue} className="btn-solid mb-3 w-full disabled:opacity-40">
            {label}
          </button>
        </div>
      )}
    </section>
  );
}
