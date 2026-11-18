"use client";

import { I18nProvider } from "@/lib/i18n";
import { haptic } from "@/lib/tg";
import { Hero } from "./Hero";
import { Manifesto } from "./Manifesto";
import { Works } from "./Works";
import { Services } from "./Services";
import { Tiers } from "./Tiers";
import { Footer } from "./Footer";
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
        <Manifesto />
        <Works />
        <Services />
        <Tiers />
        <James />
        <Configurator />
        <Footer />
      </main>
    </I18nProvider>
  );
}
