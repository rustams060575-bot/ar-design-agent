import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { TelegramProvider } from "@/components/TelegramProvider";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "AR Design",
  description: "Interactive websites, scroll choreography and AI engineering by Rustam.",
  robots: { index: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body>
        <TelegramProvider>{children}</TelegramProvider>
      </body>
    </html>
  );
}
