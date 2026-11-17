import type { Config } from "tailwindcss";

// Colors come from CSS variables (app/globals.css), switched by the Telegram color scheme.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        fg: "var(--fg)",
        muted: "var(--muted)",
        line: "var(--line)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      transitionTimingFunction: { quiet: "cubic-bezier(0.22, 1, 0.36, 1)" },
    },
  },
  plugins: [],
};

export default config;
