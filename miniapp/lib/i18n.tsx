"use client";

// English / Russian / Spanish. First person singular everywhere, quiet tone, no all-caps headlines.
// *word* in a heading is rendered as the italic serif accent. The task / budget / timeline VALUES sent to the bot stay
// English (api/miniapp_lead.js validates them): only their display text is translated here.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTg } from "@/components/TelegramProvider";

export type Lang = "en" | "ru" | "es";
export const LANGS: Lang[] = ["en", "ru", "es"];
const KEY = "ar-lang";

export interface Dict {
  hero: { title: string; lead: string; focus: [string, string, string] };
  cta: { start: string; cont: string; send: string; next: string; chatJames: string; homeAdd: string; homeAdded: string; portfolio: string };
  works: { tag: string; title: string; lead: string; kinds: [string, string, string, string]; note: string; tap: string };
  services: { tag: string; title: string; lead: string; tasks: Record<string, { label: string; hint: string }> };
  process: { tag: string; title: string; steps: [{ t: string; d: string }, { t: string; d: string }, { t: string; d: string }] };
  james: { tag: string; title: string; lead: string };
  brief: {
    tag: string; title: string; lead: string; steps: [string, string, string];
    budgets: Record<string, string>; timelines: Record<string, string>;
    budgetNote: string; replyTo: string; account: string; openInTg: string;
    notePh: string; contactPh: string; notTelegram: string; failed: string;
  };
  done: { status: string; received: string; title: string; lead: string; project: string; budget: string; timing: string };
}

const en: Dict = {
  hero: {
    title: "I design and build *interactive* websites.",
    lead: "I'm Rustam, a solo designer and AI engineer. My work is scroll choreography, typography and Next.js builds, made with Claude Code and Cursor.",
    focus: ["scroll choreography", "typography", "next.js + ai engineering"],
  },
  cta: { start: "start a brief", cont: "continue brief", send: "send brief", next: "continue", chatJames: "chat with james", homeAdd: "add to home screen", homeAdded: "on your home screen", portfolio: "see the portfolio" },
  works: { tag: "[ selected work ]", title: "Selected *work*", lead: "A few projects, shown in motion.", kinds: ["scroll-driven launch page", "corporate redesign", "interactive mvp", "custom web app"], note: "Case study in progress.", tap: "tap" },
  services: {
    tag: "[ services ]", title: "What I *build*", lead: "Tap one to start your brief with it.",
    tasks: {
      "Landing Page": { label: "Landing Page", hint: "One page, built to be remembered" },
      "Corporate Redesign": { label: "Corporate Redesign", hint: "A considered new face for an existing site" },
      "Interactive MVP": { label: "Interactive MVP", hint: "A working product, designed and built end to end" },
      "Custom Web App": { label: "Custom Web App", hint: "Bespoke interface and logic" },
    },
  },
  process: {
    tag: "[ process ]", title: "How it *works*",
    steps: [
      { t: "You send a short brief", d: "Three taps here. Task, budget range and timing." },
      { t: "I read it myself", d: "I reply in this chat with questions or a proposal for a call." },
      { t: "Design and build", d: "Scroll choreography, typography and a production Next.js build." },
    ],
  },
  james: { tag: "[ ai assistant ]", title: "Meet *James*", lead: "James is my AI assistant in this chat. Ask him about scope, process or fit. When you are ready, I step in myself." },
  brief: {
    tag: "[ brief ]", title: "Tell me about your *project*", lead: "Three quick steps. I read every brief myself.",
    steps: ["What do you need?", "Budget range", "Timing and contact"],
    budgets: { "$3k–$5k": "Focused scope", "$5k–$10k": "Full design and build", "$10k+": "Ambitious, multi-part work" },
    timelines: { "As soon as possible": "As soon as possible", "Within a month": "Within a month", "In 2–3 months": "In 2–3 months", Flexible: "Flexible" },
    budgetNote: "A rough range is enough. I can refine it with you once I have read the brief.",
    replyTo: "[ i will reply to ]", account: "Your Telegram account", openInTg: "Open this page from Telegram so I can see who to reply to.",
    notePh: "Anything I should know? (optional)", contactPh: "Email or phone, if you prefer (optional)",
    notTelegram: "Please open this page from Telegram to send your brief.", failed: "Something went wrong. Please try again in a moment.",
  },
  done: { status: "[ status ]", received: "received", title: "Brief *received*", lead: "Thank you. I'll reply to you here in Telegram.", project: "project", budget: "budget", timing: "timing" },
};

const ru: Dict = {
  hero: {
    title: "Я проектирую и создаю *интерактивные* сайты.",
    lead: "Я Рустам, дизайнер и AI-инженер, работаю один. Моя работа: хореография скролла, типографика и сборка на Next.js с помощью Claude Code и Cursor.",
    focus: ["хореография скролла", "типографика", "next.js + ai-инженерия"],
  },
  cta: { start: "начать бриф", cont: "продолжить бриф", send: "отправить бриф", next: "продолжить", chatJames: "написать джеймсу", homeAdd: "добавить на главный экран", homeAdded: "уже на главном экране", portfolio: "открыть портфолио" },
  works: { tag: "[ избранные работы ]", title: "Избранные *работы*", lead: "Несколько проектов в движении.", kinds: ["лендинг со скролл-сценарием", "корпоративный редизайн", "интерактивный mvp", "веб-приложение на заказ"], note: "Кейс в работе.", tap: "открыть" },
  services: {
    tag: "[ услуги ]", title: "Что я *создаю*", lead: "Нажмите на одну, и бриф начнётся с неё.",
    tasks: {
      "Landing Page": { label: "Лендинг", hint: "Одна страница, которую запоминают" },
      "Corporate Redesign": { label: "Корпоративный редизайн", hint: "Продуманное новое лицо для действующего сайта" },
      "Interactive MVP": { label: "Интерактивный MVP", hint: "Рабочий продукт: от дизайна до запуска" },
      "Custom Web App": { label: "Веб-приложение на заказ", hint: "Индивидуальный интерфейс и логика" },
    },
  },
  process: {
    tag: "[ процесс ]", title: "Как это *устроено*",
    steps: [
      { t: "Вы отправляете короткий бриф", d: "Три касания здесь: задача, бюджет и сроки." },
      { t: "Я читаю его сам", d: "Отвечаю в этом чате: уточняю детали или предлагаю созвон." },
      { t: "Дизайн и разработка", d: "Хореография скролла, типографика и продакшн-сборка на Next.js." },
    ],
  },
  james: { tag: "[ ai-ассистент ]", title: "Знакомьтесь, *Джеймс*", lead: "Джеймс — мой AI-ассистент в этом чате. Спросите его про объём работ, процесс и подходит ли это вам. Когда будете готовы, подключусь я сам." },
  brief: {
    tag: "[ бриф ]", title: "Расскажите о вашем *проекте*", lead: "Три быстрых шага. Каждый бриф я читаю сам.",
    steps: ["Что вам нужно?", "Бюджет", "Сроки и контакт"],
    budgets: { "$3k–$5k": "Сфокусированный объём", "$5k–$10k": "Полный дизайн и разработка", "$10k+": "Масштабная работа из нескольких частей" },
    timelines: { "As soon as possible": "Как можно скорее", "Within a month": "В течение месяца", "In 2–3 months": "За 2–3 месяца", Flexible: "Гибко" },
    budgetNote: "Достаточно примерного диапазона. Уточним, когда я прочту бриф.",
    replyTo: "[ я отвечу ]", account: "Ваш аккаунт Telegram", openInTg: "Откройте страницу из Telegram, чтобы я увидел, кому отвечать.",
    notePh: "Что ещё мне стоит знать? (по желанию)", contactPh: "Почта или телефон, если удобнее (по желанию)",
    notTelegram: "Откройте эту страницу из Telegram, чтобы отправить бриф.", failed: "Что-то пошло не так. Попробуйте ещё раз через минуту.",
  },
  done: { status: "[ статус ]", received: "получено", title: "Бриф *получен*", lead: "Спасибо. Я отвечу вам здесь, в Telegram.", project: "проект", budget: "бюджет", timing: "сроки" },
};

const es: Dict = {
  hero: {
    title: "Diseño y construyo sitios web *interactivos*.",
    lead: "Soy Rustam, diseñador e ingeniero de IA, trabajo en solitario. Mi trabajo es la coreografía del scroll, la tipografía y el desarrollo en Next.js con Claude Code y Cursor.",
    focus: ["coreografía del scroll", "tipografía", "next.js + ingeniería de ia"],
  },
  cta: { start: "empezar brief", cont: "continuar brief", send: "enviar brief", next: "continuar", chatJames: "hablar con james", homeAdd: "añadir a la pantalla de inicio", homeAdded: "ya está en tu pantalla de inicio", portfolio: "ver el portafolio" },
  works: { tag: "[ trabajos seleccionados ]", title: "Trabajos *seleccionados*", lead: "Algunos proyectos, en movimiento.", kinds: ["landing con scroll narrativo", "rediseño corporativo", "mvp interactivo", "aplicación web a medida"], note: "Caso de estudio en curso.", tap: "abrir" },
  services: {
    tag: "[ servicios ]", title: "Lo que *construyo*", lead: "Toca uno y empezamos tu brief con él.",
    tasks: {
      "Landing Page": { label: "Landing Page", hint: "Una página pensada para recordarse" },
      "Corporate Redesign": { label: "Rediseño corporativo", hint: "Una nueva cara cuidada para un sitio existente" },
      "Interactive MVP": { label: "MVP interactivo", hint: "Un producto funcional, del diseño al lanzamiento" },
      "Custom Web App": { label: "Aplicación web a medida", hint: "Interfaz y lógica a medida" },
    },
  },
  process: {
    tag: "[ proceso ]", title: "Cómo *funciona*",
    steps: [
      { t: "Envías un brief breve", d: "Tres toques aquí: tarea, presupuesto y plazos." },
      { t: "Lo leo yo mismo", d: "Respondo en este chat con preguntas o una propuesta de llamada." },
      { t: "Diseño y desarrollo", d: "Coreografía del scroll, tipografía y una build de Next.js lista para producción." },
    ],
  },
  james: { tag: "[ asistente de ia ]", title: "Conoce a *James*", lead: "James es mi asistente de IA en este chat. Pregúntale por el alcance, el proceso o si encaja contigo. Cuando estés listo, entro yo." },
  brief: {
    tag: "[ brief ]", title: "Cuéntame sobre tu *proyecto*", lead: "Tres pasos rápidos. Leo cada brief yo mismo.",
    steps: ["¿Qué necesitas?", "Rango de presupuesto", "Plazos y contacto"],
    budgets: { "$3k–$5k": "Alcance acotado", "$5k–$10k": "Diseño y desarrollo completos", "$10k+": "Trabajo ambicioso en varias partes" },
    timelines: { "As soon as possible": "Lo antes posible", "Within a month": "En un mes", "In 2–3 months": "En 2–3 meses", Flexible: "Flexible" },
    budgetNote: "Un rango aproximado es suficiente. Lo afinamos cuando haya leído el brief.",
    replyTo: "[ responderé a ]", account: "Tu cuenta de Telegram", openInTg: "Abre esta página desde Telegram para que vea a quién responder.",
    notePh: "¿Algo más que deba saber? (opcional)", contactPh: "Correo o teléfono, si lo prefieres (opcional)",
    notTelegram: "Abre esta página desde Telegram para enviar tu brief.", failed: "Algo salió mal. Inténtalo de nuevo en un momento.",
  },
  done: { status: "[ estado ]", received: "recibido", title: "Brief *recibido*", lead: "Gracias. Te responderé aquí, en Telegram.", project: "proyecto", budget: "presupuesto", timing: "plazos" },
};

const DICTS: Record<Lang, Dict> = { en, ru, es };

interface I18nCtx {
  lang: Lang;
  t: Dict;
  setLang: (l: Lang) => void;
}
const Ctx = createContext<I18nCtx>({ lang: "en", t: en, setLang: () => undefined });
export const useI18n = () => useContext(Ctx);

const fromCode = (code?: string): Lang => {
  const c = (code || "").toLowerCase().slice(0, 2);
  return c === "ru" || c === "es" ? c : "en";
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { app, mounted } = useTg();
  const [lang, setLangState] = useState<Lang>("en");

  // Saved choice > the Telegram interface language > the browser language > English.
  useEffect(() => {
    if (!mounted) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      /* private mode */
    }
    const next = (LANGS as string[]).includes(saved || "") ? (saved as Lang) : fromCode(app?.initDataUnsafe?.user?.language_code || navigator.language);
    setLangState(next);
  }, [mounted, app]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* private mode */
    }
  }, []);

  const value = useMemo(() => ({ lang, t: DICTS[lang], setLang }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
