// Thin, typed access to the native Telegram WebApp object (telegram-web-app.js, loaded in app/layout.tsx).
// Every call is feature-checked: older clients lack newer methods, and a plain browser has no Telegram at all.

export type HapticStyle = "light" | "medium" | "heavy" | "rigid" | "soft";

export interface TgButton {
  text: string;
  isVisible: boolean;
  isActive: boolean;
  setParams(p: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }): void;
  show(): void;
  hide(): void;
  showProgress(leaveActive?: boolean): void;
  hideProgress(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

export interface TgBackButton {
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: TgUser };
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  ready(): void;
  expand(): void;
  close(): void;
  isVersionAtLeast(v: string): boolean;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  setBottomBarColor?(color: string): void;
  requestFullscreen?(): void;
  disableVerticalSwipes?(): void;
  addToHomeScreen?(): void;
  checkHomeScreenStatus?(cb: (status: "unsupported" | "unknown" | "added" | "missed") => void): void;
  openLink(url: string, opts?: { try_instant_view?: boolean }): void;
  onEvent(name: string, cb: () => void): void;
  offEvent(name: string, cb: () => void): void;
  MainButton: TgButton;
  BackButton: TgBackButton;
  HapticFeedback: {
    impactOccurred(style: HapticStyle): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
    selectionChanged(): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

export function getWebApp(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  const app = window.Telegram?.WebApp;
  return app && app.initData ? app : null; // empty initData = opened outside Telegram
}

export const haptic = {
  light: () => getWebApp()?.HapticFeedback?.impactOccurred("light"),
  success: () => getWebApp()?.HapticFeedback?.notificationOccurred("success"),
  error: () => getWebApp()?.HapticFeedback?.notificationOccurred("error"),
};

export function openLink(url: string) {
  const app = getWebApp();
  if (app) app.openLink(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}
