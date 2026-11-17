"use client";

import { I18nProvider } from "@/lib/i18n";
import { haptic } from "@/lib/tg";
import { Hero } from "./Hero";
import { Works } from "./Works";
import { Services } from "./Services";
import { James } from "./James";
import { Configurator } from "./Configurator";
import { LangSwitcher } from "./LangSwitcher";

export function Home() {
  const toBrief = () => {
    haptic.light();
    document.getElementById("brief")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <I18nProvider>
      <LangSwitcher />
      <main>
        <Hero onStart={toBrief} />
        <Works />
        <Services />
        <James />
        <Configurator />
      </main>
    </I18nProvider>
  );
}
