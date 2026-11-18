"use client";

// English / Russian / Spanish: the same three languages and the same copy as the live site (withardesign.com).
// *word* in a heading is rendered as the italic serif accent. The task / package / timeline VALUES sent to the bot stay
// English (api/miniapp_lead.js validates them): only their display text is translated here.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTg } from "@/components/TelegramProvider";

export type Lang = "en" | "ru" | "es";
export const LANGS: Lang[] = ["en", "ru", "es"];
const KEY = "ar-lang";

export interface Tier { label: string; duration: string; title: string; unit: string; price: string; body: string; features: [string, string, string, string]; cta: string }
export interface Phase { t: string; d: string }

export interface Dict {
  hero: { badge: string; title: string; lead: string; focus: [string, string, string]; stats: [{ value: string; label: string }, { value: string; label: string }, { value: string; label: string }] };
  manifesto: { tag: string; text: string };
  cta: { start: string; teardown: string; cont: string; send: string; next: string; chatJames: string; homeAdd: string; homeAdded: string; portfolio: string };
  works: { tag: string; title: string; lead: string; kinds: [string, string, string]; notes: [string, string, string]; tap: string };
  services: { tag: string; title: string; lead: string; tasks: Record<string, { label: string; hint: string }> };
  process: { tag: string; title: string; tagline: string; steps: [Phase, Phase, Phase, Phase] };
  tiers: { tag: string; title: string; items: [Tier, Tier, Tier]; footnote: string };
  james: { tag: string; title: string; lead: string };
  brief: {
    tag: string; title: string; lead: string; steps: [string, string, string];
    budgets: Record<string, string>; timelines: Record<string, string>;
    budgetNote: string; replyTo: string; account: string; openInTg: string;
    notePh: string; contactPh: string; notTelegram: string; failed: string;
  };
  done: { status: string; received: string; title: string; lead: string; project: string; budget: string; timing: string };
  footer: { tag: string; title: string; about: string; email: string };
}

const en: Dict = {
  hero: {
    badge: "Websites • Digital Products • AI Agents",
    title: "Design systems for a new era. *Aesthetics, clarity, and autonomous AI.*",
    lead: "Editorial craft meets product clarity. We design and build websites, digital products, AI agents and integrations in 14-day sprints, for teams of any size, anywhere.",
    focus: ["fintech systems", "ai interfaces", "conversion engineering"],
    stats: [{ value: "14 Days", label: "Sprint format" }, { value: "$390", label: "Teardown, fixed price" }, { value: "3", label: "Service directions" }],
  },
  manifesto: { tag: "[ manifesto ]", text: "Great products win on *architecture*: an interface that lets a buyer *feel* everything the product can do. We build that interface." },
  cta: { start: "start a brief", teardown: "run free url teardown", cont: "continue brief", send: "send brief", next: "continue", chatJames: "chat with james", homeAdd: "add to home screen", homeAdded: "on your home screen", portfolio: "see the portfolio" },
  works: {
    tag: "[ selected work ]", title: "Precision interfaces for *ambitious* products.", lead: "Panels are illustrative; results appear with client approval.",
    kinds: ["enterprise neural os", "institutional liquidity", "cloud telemetry and plg funnel"],
    notes: ["Enterprise AI: agent orchestration. Illustrative visual.", "Fintech treasury terminal. Demo data.", "Re-engineered a fragmented developer onboarding flow into a self-serve, product-led growth journey."],
    tap: "open",
  },
  services: {
    tag: "[ services ]", title: "Websites, products, agents, *integrations*.", lead: "Tap one to start your brief with it.",
    tasks: {
      "Website": { label: "Website design and development", hint: "Marketing and product sites, shipped as production Next.js" },
      "Digital Product": { label: "Digital product design and engineering", hint: "Dashboards, onboarding flows, design systems" },
      "AI Agent": { label: "AI agents for business", hint: "Agents that answer from approved facts and hand over to a person" },
      "Integrations": { label: "System integrations", hint: "CRM, Slack, Stripe, Telegram, analytics" },
    },
  },
  process: {
    tag: "[ engagement architecture ]", title: "14-day *sprint*", tagline: "Fixed price. Fixed scope. Fixed calendar.",
    steps: [
      { t: "Day 01–02 · Teardown & Telemetry", d: "Funnel forensics, Core Web Vitals trace, session reviews and a ranked list of the highest-leverage conversion leaks." },
      { t: "Day 03–06 · Architecture & Design", d: "Editorial type system, multi-theme tokens and hi-fi flagship screens in Figma. Daily async review with your founders." },
      { t: "Day 07–12 · Production Build", d: "Next.js + Tailwind + GSAP repository, interactive product sandbox, instrumentation and technical SEO. Preview URL from day 8." },
      { t: "Day 13–14 · Launch & Handoff", d: "Edge deploy, analytics wiring, Loom handoff and a 30-day post-launch optimisation window." },
    ],
  },
  tiers: {
    tag: "[ engagement ]", title: "Productized engineering sprints with *fixed* velocity.",
    items: [
      { label: "00 / architectural teardown", duration: "24h", title: "15-Page Teardown + Loom", unit: "/ one-time", price: "$390", body: "A founder-level forensic review of your flagship funnel. The fastest way to find out what is leaking pipeline.", features: ["15-page annotated architectural report", "8-minute Loom walkthrough from a founding engineer", "Redesigned hero in Figma", "Credited 100% against any sprint"], cta: "Get Teardown + Loom in 24h" },
      { label: "01 / conversion architecture sprint", duration: "14 days", title: "Flagship Web & Interactive Sandbox", unit: "/ fixed sprint", price: "$12,500", body: "Complete editorial & conversion overhaul of your marketing flagship, with an interactive live product demo and a performance-focused build.", features: ["Bespoke interactive product teardown / sandbox", "Editorial typography & tactile motion system", "Production Next.js + Tailwind + GSAP repository", "Technical SEO & telemetry lead capture"], cta: "Reserve 14-Day Sprint Slot" },
      { label: "02 / full-stack product & ai engineering", duration: "3–4 weeks", title: "Core Fintech / AI App & Design System", unit: "/ full system", price: "$18,500", body: "End-to-end re-architecture of your core SaaS dashboard, multi-agent AI workflows and self-serve onboarding funnel.", features: ["Full product UI overhaul & zero-friction onboarding", "Streaming AI copilot & data telemetry components", "Multi-theme Figma tokens + React component library", "Direct daily Slack channel with founding engineers"], cta: "Deploy Principal Engineering Pod" },
    ],
    footnote: "Every engagement includes a signed SOW, weekly Loom updates and one point of contact. Clients of any size, from any country.",
  },
  james: { tag: "[ ai assistant ]", title: "Meet *James*", lead: "James, AR Design Concierge & AI Architect. Ask him about scope, process or fit. When you are ready, a founding engineer steps in." },
  brief: {
    tag: "[ brief ]", title: "Let's build something *unforgettable.*", lead: "Three quick steps. We reply within one business day.",
    steps: ["What do you need?", "Package", "Timing and contact"],
    budgets: { "Teardown · $390": "15-page teardown + Loom, 24h", "Sprint · $12,500": "Fixed sprint, 14 days", "System · $18,500+": "Full system, 3–4 weeks" },
    timelines: { "As soon as possible": "As soon as possible", "Within a month": "Within a month", "In 2–3 months": "In 2–3 months", Flexible: "Flexible" },
    budgetNote: "Fixed price. Fixed scope. Fixed calendar. We can adjust the package once we read the brief.",
    replyTo: "[ we will reply to ]", account: "Your Telegram account", openInTg: "Open this page from Telegram so we can see who to reply to.",
    notePh: "Anything we should know? (optional)", contactPh: "Email, phone or site URL (optional)",
    notTelegram: "Please open this page from Telegram to send your brief.", failed: "Something went wrong. Please try again in a moment.",
  },
  done: { status: "[ status ]", received: "received", title: "Brief *received*", lead: "Thank you. A founding engineer will reply here in Telegram within one business day.", project: "project", budget: "package", timing: "timing" },
  footer: { tag: "[ initiate dialogue ]", title: "Let's build something *unforgettable.*", about: "AR Design is a digital studio for websites, digital products, AI agents and integrations. We work with clients of any size and from any country. Fixed-price sprints.", email: "hello@withardesign.com" },
};

const ru: Dict = {
  hero: {
    badge: "Сайты • цифровые продукты • AI-агенты",
    title: "Дизайн-системы новой эры. *Эстетика, смысл и автономный AI.*",
    lead: "Редакционная эстетика и ясность продукта. Проектируем и разрабатываем сайты, цифровые продукты, AI-агентов и интеграции в 14-дневных спринтах — для команд любого масштаба из любой страны.",
    focus: ["финтех", "ai-интерфейсы", "инжиниринг конверсии"],
    stats: [{ value: "14 дней", label: "Формат спринта" }, { value: "$390", label: "Разбор, фикс. цена" }, { value: "3", label: "Направления работы" }],
  },
  manifesto: { tag: "[ манифест ]", text: "Сильные продукты побеждают *архитектурой*: интерфейс даёт покупателю *почувствовать* всё, на что способен продукт. Мы создаём такой интерфейс." },
  cta: { start: "начать бриф", teardown: "бесплатный аудит url", cont: "продолжить бриф", send: "отправить бриф", next: "продолжить", chatJames: "написать джеймсу", homeAdd: "добавить на главный экран", homeAdded: "уже на главном экране", portfolio: "открыть портфолио" },
  works: {
    tag: "[ избранные проекты ]", title: "Точные интерфейсы для *амбициозных* продуктов.", lead: "Панели иллюстративны; результаты публикуются с согласия клиента.",
    kinds: ["enterprise neural os", "институциональная ликвидность", "облачная телеметрия и plg-воронка"],
    notes: ["Enterprise AI: оркестрация агентов. Иллюстративный визуал.", "Финтех-терминал казначейства. Демо-данные.", "Превратили разрозненный онбординг разработчиков в self-serve путь с упором на продукт (product-led growth)."],
    tap: "открыть",
  },
  services: {
    tag: "[ услуги ]", title: "Сайты, продукты, агенты, *интеграции*.", lead: "Нажмите на одну, и бриф начнётся с неё.",
    tasks: {
      "Website": { label: "Дизайн и разработка сайтов", hint: "Маркетинговые и продуктовые сайты на production Next.js" },
      "Digital Product": { label: "Дизайн и разработка цифровых продуктов", hint: "Дашборды, онбординг, дизайн-системы" },
      "AI Agent": { label: "AI-агенты для бизнеса", hint: "Агенты отвечают по проверенным фактам и передают диалог человеку" },
      "Integrations": { label: "Системные интеграции", hint: "CRM, Slack, Stripe, Telegram, аналитика" },
    },
  },
  process: {
    tag: "[ формат работы ]", title: "14-дневный *спринт*", tagline: "Фиксированная цена. Фиксированный объём. Фиксированный календарь.",
    steps: [
      { t: "День 01–02 · Аудит и телеметрия", d: "Разбор воронки, трассировка Core Web Vitals, анализ сессий и приоритизированный список главных потерь конверсии." },
      { t: "День 03–06 · Архитектура и дизайн", d: "Редакционная типографика, мультитемные токены и hi-fi экраны в Figma. Ежедневное асинхронное ревью с основателями." },
      { t: "День 07–12 · Production-сборка", d: "Репозиторий на Next.js + Tailwind + GSAP, интерактивная песочница продукта, аналитика и технический SEO. Превью-ссылка — с 8-го дня." },
      { t: "День 13–14 · Запуск и передача", d: "Деплой на edge, подключение аналитики, передача проекта в Loom и 30 дней оптимизации после запуска." },
    ],
  },
  tiers: {
    tag: "[ формат работы ]", title: "Инженерные спринты с *фиксированными* сроками и ценой.",
    items: [
      { label: "00 / архитектурный разбор", duration: "24 ч", title: "Разбор на 15 страниц + Loom", unit: "/ разово", price: "$390", body: "Глубокий разбор вашей флагманской воронки на уровне основателя. Самый быстрый способ понять, где вы теряете выручку.", features: ["Аннотированный отчёт на 15 страниц", "8-минутный Loom от ведущего инженера", "Переработанный первый экран в Figma", "Стоимость засчитывается в любой спринт"], cta: "Получить разбор + Loom за 24 часа" },
      { label: "01 / спринт конверсионной архитектуры", duration: "14 дней", title: "Флагманский сайт и интерактивная песочница", unit: "/ фикс. спринт", price: "$12,500", body: "Полная редакционная и конверсионная переработка маркетингового сайта: интерактивное демо продукта и сборка с упором на производительность.", features: ["Интерактивная песочница продукта под ваш кейс", "Редакционная типографика и система тактильной анимации", "Production-репозиторий Next.js + Tailwind + GSAP", "Технический SEO и сбор лидов с телеметрией"], cta: "Забронировать 14-дневный спринт" },
      { label: "02 / продукт full-stack и ai-инжиниринг", duration: "3–4 недели", title: "Ядро финтех/AI-продукта и дизайн-система", unit: "/ полный цикл", price: "$18,500", body: "Сквозная переархитектура SaaS-дашборда, мультиагентных AI-сценариев и self-serve воронки онбординга.", features: ["Полное обновление интерфейса и онбординг без трения", "Стриминговый AI-копилот и компоненты телеметрии", "Мультитемные токены Figma и библиотека React-компонентов", "Прямой ежедневный канал в Slack с ведущими инженерами"], cta: "Подключить инженерную команду" },
    ],
    footnote: "Каждый проект включает подписанный SOW, еженедельные Loom-отчёты и единую точку контакта. Клиенты любого масштаба из любой страны.",
  },
  james: { tag: "[ ai-ассистент ]", title: "Знакомьтесь, *James*", lead: "James, консьерж и AI-архитектор AR Design. Спросите про объём работ, процесс и подходит ли это вам. Когда будете готовы, подключится ведущий инженер." },
  brief: {
    tag: "[ бриф ]", title: "Создадим нечто *выдающееся.*", lead: "Три быстрых шага. Отвечаем в течение одного рабочего дня.",
    steps: ["Что вам нужно?", "Пакет", "Сроки и контакт"],
    budgets: { "Teardown · $390": "Разбор на 15 страниц + Loom, 24 ч", "Sprint · $12,500": "Фикс. спринт, 14 дней", "System · $18,500+": "Полный цикл, 3–4 недели" },
    timelines: { "As soon as possible": "Как можно скорее", "Within a month": "В течение месяца", "In 2–3 months": "За 2–3 месяца", Flexible: "Гибко" },
    budgetNote: "Фиксированная цена. Фиксированный объём. Фиксированный календарь. Пакет уточним после прочтения брифа.",
    replyTo: "[ мы ответим ]", account: "Ваш аккаунт Telegram", openInTg: "Откройте страницу из Telegram, чтобы мы увидели, кому отвечать.",
    notePh: "Что ещё нам стоит знать? (по желанию)", contactPh: "Почта, телефон или URL сайта (по желанию)",
    notTelegram: "Откройте эту страницу из Telegram, чтобы отправить бриф.", failed: "Что-то пошло не так. Попробуйте ещё раз через минуту.",
  },
  done: { status: "[ статус ]", received: "получено", title: "Бриф *получен*", lead: "Спасибо. Ведущий инженер ответит вам здесь, в Telegram, в течение одного рабочего дня.", project: "проект", budget: "пакет", timing: "сроки" },
  footer: { tag: "[ начнём разговор ]", title: "Создадим нечто *выдающееся.*", about: "AR Design — цифровая студия: сайты, цифровые продукты, AI-агенты и интеграции. Работаем с заказчиками любого масштаба из любой страны. Спринты с фиксированной ценой.", email: "hello@withardesign.com" },
};

const es: Dict = {
  hero: {
    badge: "Webs • Productos • Agentes de IA",
    title: "Sistemas de diseño de una nueva era. *Estética, sentido e IA autónoma.*",
    lead: "Artesanía editorial y claridad de producto. Diseñamos y desarrollamos sitios web, productos digitales, agentes de IA e integraciones en sprints de 14 días, para equipos de cualquier tamaño y país.",
    focus: ["fintech", "interfaces de ia", "ingeniería de conversión"],
    stats: [{ value: "14 días", label: "Formato de sprint" }, { value: "$390", label: "Teardown, precio fijo" }, { value: "3", label: "Líneas de servicio" }],
  },
  manifesto: { tag: "[ manifiesto ]", text: "Los grandes productos ganan por su *arquitectura*: una interfaz que permite al comprador *sentir* todo lo que el producto puede hacer. Construimos esa interfaz." },
  cta: { start: "empezar brief", teardown: "auditoría gratuita de url", cont: "continuar brief", send: "enviar brief", next: "continuar", chatJames: "hablar con james", homeAdd: "añadir a la pantalla de inicio", homeAdded: "ya está en tu pantalla de inicio", portfolio: "ver el portafolio" },
  works: {
    tag: "[ trabajos seleccionados ]", title: "Interfaces de precisión para productos *ambiciosos*.", lead: "Los paneles son ilustrativos; los resultados aparecen con la aprobación del cliente.",
    kinds: ["enterprise neural os", "liquidez institucional", "telemetría cloud y embudo plg"],
    notes: ["IA empresarial: orquestación de agentes. Visual ilustrativo.", "Terminal fintech de tesorería. Datos demo.", "Rediseñamos un onboarding fragmentado para desarrolladores como un recorrido self-serve orientado al producto (product-led growth)."],
    tap: "abrir",
  },
  services: {
    tag: "[ servicios ]", title: "Webs, productos, agentes, *integraciones*.", lead: "Toca uno y empezamos tu brief con él.",
    tasks: {
      "Website": { label: "Diseño y desarrollo de sitios web", hint: "Sitios de marketing y de producto en Next.js de producción" },
      "Digital Product": { label: "Diseño e ingeniería de productos digitales", hint: "Dashboards, onboarding, sistemas de diseño" },
      "AI Agent": { label: "Agentes de IA para empresas", hint: "Agentes que responden con hechos aprobados y pasan el caso a una persona" },
      "Integrations": { label: "Integraciones de sistemas", hint: "CRM, Slack, Stripe, Telegram, analítica" },
    },
  },
  process: {
    tag: "[ modelo de colaboración ]", title: "Sprint de *14 días*", tagline: "Precio fijo. Alcance fijo. Calendario fijo.",
    steps: [
      { t: "Día 01–02 · Auditoría y telemetría", d: "Análisis forense del embudo, trazado de Core Web Vitals, revisión de sesiones y una lista priorizada de las mayores fugas de conversión." },
      { t: "Día 03–06 · Arquitectura y diseño", d: "Sistema tipográfico editorial, tokens multitema y pantallas hi-fi en Figma. Revisión asíncrona diaria con los fundadores." },
      { t: "Día 07–12 · Desarrollo en producción", d: "Repositorio Next.js + Tailwind + GSAP, sandbox interactivo del producto, analítica y SEO técnico. Enlace de preview desde el día 8." },
      { t: "Día 13–14 · Lanzamiento y entrega", d: "Despliegue en edge, integración de analítica, entrega en Loom y 30 días de optimización posteriores al lanzamiento." },
    ],
  },
  tiers: {
    tag: "[ modelo de colaboración ]", title: "Sprints de ingeniería con plazo y precio *fijos*.",
    items: [
      { label: "00 / análisis arquitectónico", duration: "24 h", title: "Análisis de 15 páginas + Loom", unit: "/ pago único", price: "$390", body: "Una revisión en profundidad, a nivel de fundador, de tu embudo principal. La forma más rápida de saber dónde pierdes ingresos.", features: ["Informe anotado de 15 páginas", "Loom de 8 minutos de un ingeniero fundador", "Hero rediseñado en Figma", "El importe se descuenta de cualquier sprint"], cta: "Recibe análisis + Loom en 24 h" },
      { label: "01 / sprint de arquitectura de conversión", duration: "14 días", title: "Web principal y sandbox interactivo", unit: "/ sprint fijo", price: "$12,500", body: "Renovación editorial y de conversión completa de tu web principal, con una demo interactiva del producto y un desarrollo centrado en el rendimiento.", features: ["Sandbox interactivo del producto a medida", "Tipografía editorial y sistema de animación táctil", "Repositorio de producción en Next.js + Tailwind + GSAP", "SEO técnico y captación de leads con telemetría"], cta: "Reservar sprint de 14 días" },
      { label: "02 / producto full-stack e ingeniería de ia", duration: "3–4 semanas", title: "Núcleo del producto fintech/IA y sistema de diseño", unit: "/ ciclo completo", price: "$18,500", body: "Rearquitectura integral de tu dashboard SaaS, de los flujos de IA multiagente y del embudo de onboarding self-serve.", features: ["Renovación completa de la interfaz y onboarding sin fricción", "Copiloto de IA en streaming y componentes de telemetría", "Tokens de Figma multitema y librería de componentes React", "Canal directo y diario en Slack con los ingenieros fundadores"], cta: "Incorporar al equipo de ingeniería" },
    ],
    footnote: "Cada proyecto incluye un SOW firmado, informes semanales en Loom y un único interlocutor. Clientes de cualquier tamaño y país.",
  },
  james: { tag: "[ asistente de ia ]", title: "Conoce a *James*", lead: "James, conserje y arquitecto de IA de AR Design. Pregúntale por el alcance, el proceso o si encaja contigo. Cuando estés listo, entra un ingeniero fundador." },
  brief: {
    tag: "[ brief ]", title: "Construyamos algo *inolvidable.*", lead: "Tres pasos rápidos. Respondemos en un día laborable.",
    steps: ["¿Qué necesitas?", "Paquete", "Plazos y contacto"],
    budgets: { "Teardown · $390": "Análisis de 15 páginas + Loom, 24 h", "Sprint · $12,500": "Sprint fijo, 14 días", "System · $18,500+": "Ciclo completo, 3–4 semanas" },
    timelines: { "As soon as possible": "Lo antes posible", "Within a month": "En un mes", "In 2–3 months": "En 2–3 meses", Flexible: "Flexible" },
    budgetNote: "Precio fijo. Alcance fijo. Calendario fijo. Ajustamos el paquete cuando leamos el brief.",
    replyTo: "[ responderemos a ]", account: "Tu cuenta de Telegram", openInTg: "Abre esta página desde Telegram para que veamos a quién responder.",
    notePh: "¿Algo más que debamos saber? (opcional)", contactPh: "Correo, teléfono o URL del sitio (opcional)",
    notTelegram: "Abre esta página desde Telegram para enviar tu brief.", failed: "Algo salió mal. Inténtalo de nuevo en un momento.",
  },
  done: { status: "[ estado ]", received: "recibido", title: "Brief *recibido*", lead: "Gracias. Un ingeniero fundador te responderá aquí, en Telegram, en un día laborable.", project: "proyecto", budget: "paquete", timing: "plazos" },
  footer: { tag: "[ hablemos ]", title: "Construyamos algo *inolvidable.*", about: "AR Design es un estudio digital de sitios web, productos digitales, agentes de IA e integraciones. Trabajamos con clientes de cualquier tamaño y de cualquier país. Sprints de precio fijo.", email: "hello@withardesign.com" },
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
