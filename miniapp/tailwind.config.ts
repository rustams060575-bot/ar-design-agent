import type { Config } from "tailwindcss";

// Tokens are CSS-variable channels (app/globals.css): every utility supports opacity modifiers.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        "bg-2": token("bg-2"),
        elevated: token("elevated"),
        ink: token("ink"),
        head: token("head"),
        sub: token("sub"),
        dim: token("dim"),
        line: token("line"),
        accent: token("accent"),
        "accent-ink": token("accent-ink"),
        blue: token("blue"),
        em: token("em"),
        ok: token("ok"),
        danger: token("danger"),
      },
      // Near-square geometry, like the studio site. rounded-full stays a true circle.
      borderRadius: { none: "0", sm: "2px", DEFAULT: "2px", md: "3px", lg: "3px", xl: "4px", "2xl": "4px", "3xl": "6px", full: "9999px" },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      transitionTimingFunction: { expo: "cubic-bezier(0.16, 1, 0.3, 1)" },
    },
  },
  plugins: [],
};

export default config;
