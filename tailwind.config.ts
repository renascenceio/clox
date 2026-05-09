import type { Config } from "tailwindcss";

/*
 * Anthology — Pearl & Onyx
 * Editorial × productivity Tailwind theme.
 *
 *   colors      → driven by CSS variables in globals.css
 *                 (`bg-rail`, `text-ink`, `border-hairline`, `text-accent`)
 *   fonts       → font-sans (Geist), font-mono (Geist Mono),
 *                 font-serif (Newsreader)
 *   radii       → sharp by default — 2px / 3px / 4px / 6px / 8px / 12px.
 *   shadows    → none. The system is structured by 1px hairlines, not glow.
 *
 * Backwards compatibility:
 *   • `bg-mint`, `bg-apple-teal`, `bg-brown` (and their text/border twins),
 *     `text-success`, and the `*-glow` shadows are aliased to `accent` so any
 *     surface that hasn't been individually migrated still renders Terracotta.
 *   • The legacy `hig-*` radius tokens collapse to small sharp values.
 */

const accent = "rgb(var(--accent-rgb) / <alpha-value>)";
const accentScale = {
  DEFAULT: accent,
  50:  "rgb(var(--accent-rgb) / 0.06)",
  100: "rgb(var(--accent-rgb) / 0.10)",
  200: "rgb(var(--accent-rgb) / 0.18)",
  300: "rgb(var(--accent-rgb) / 0.30)",
  400: "rgb(var(--accent-rgb) / 0.55)",
  500: accent,
  600: "rgb(var(--accent-rgb) / 0.92)",
  700: "rgb(var(--accent-rgb) / 0.84)",
  800: "rgb(var(--accent-rgb) / 0.74)",
  900: "rgb(var(--accent-rgb) / 0.65)",
};

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/shared/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "Menlo", "monospace"],
        serif: ["var(--font-newsreader)", "Georgia", '"Times New Roman"', "serif"],
      },
      colors: {
        // ---- Editorial primitives (preferred for new code) -------------
        bg: "var(--bg)",
        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          soft:    "rgb(var(--ink-soft-rgb) / <alpha-value>)",
          muted:   "rgb(var(--ink-muted-rgb) / <alpha-value>)",
        },
        rail: {
          DEFAULT: "rgb(var(--rail-rgb) / <alpha-value>)",
          soft:    "rgb(var(--rail-soft-rgb) / <alpha-value>)",
        },
        "surface-alt": "rgb(var(--surface-alt-rgb) / <alpha-value>)",
        accent: accentScale,
        hairline: {
          DEFAULT: "var(--hairline)",
          soft:    "var(--hairline-soft)",
        },
        you: {
          bg: "rgb(var(--you-bg-rgb) / <alpha-value>)",
          fg: "rgb(var(--you-fg-rgb) / <alpha-value>)",
        },
        ai: {
          bg: "rgb(var(--ai-bg-rgb) / <alpha-value>)",
        },

        // ---- Legacy semantic surfaces (kept stable, remapped values) ----
        surface: {
          DEFAULT:   "rgb(var(--surface) / <alpha-value>)",
          secondary: "rgb(var(--surface-secondary) / <alpha-value>)",
          tertiary:  "rgb(var(--surface-tertiary) / <alpha-value>)",
        },
        label: {
          primary:   "rgb(var(--label-primary) / <alpha-value>)",
          secondary: "rgb(var(--label-secondary) / <alpha-value>)",
          tertiary:  "rgb(var(--label-tertiary) / <alpha-value>)",
        },
        separator: "rgb(var(--separator) / <alpha-value>)",
        fill:      "rgba(var(--fill) / <alpha-value>)",

        // ---- Legacy brand aliases — all collapse to the single accent ---
        // Existing classes (`bg-mint-500`, `text-mint-600`, `border-mint/40`,
        // `bg-brown`, `bg-apple-teal`, `text-success`) keep working but now
        // render Terracotta, in keeping with the "one accent only" rule.
        mint:        accentScale,
        teal:        accentScale,
        "apple-teal": accentScale,
        brown:       accentScale,
        success:     accent,

        // State colors — communicate state, not brand. Kept literal.
        destructive: "#C8423B",
        warning:     "#C97A1F",
      },
      borderRadius: {
        // Editorial scale — sharp by default.
        sharp:    "2px",
        card:     "3px",
        composer: "4px",

        // Legacy hig-* aliases collapse to small sharp values so existing
        // utility classes still render correctly with the new system.
        "hig-sm":  "2px",
        "hig-md":  "3px",
        "hig-lg":  "4px",
        "hig-xl":  "6px",
        "hig-2xl": "8px",
        "hig-3xl": "12px",
      },
      boxShadow: {
        // The system has no shadows. Every legacy shadow alias is `none`.
        hig:          "none",
        "hig-hover":  "none",
        float:        "none",
        "float-lg":   "none",
        "brown-glow": "none",
        "teal-glow":  "none",
        "apple-teal": "none",
        "mint-glow":  "none",
      },
      backdropBlur: {
        hig: "20px",
      },
      keyframes: {
        blob: {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "33%":      { transform: "translate(30px, -50px) scale(1.05)" },
          "66%":      { transform: "translate(-20px, 20px) scale(0.95)" },
        },
        "blob-slow": {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "33%":      { transform: "translate(40px, -60px) scale(1.08)" },
          "66%":      { transform: "translate(-30px, 30px) scale(0.92)" },
        },
      },
      animation: {
        blob: "blob 7s infinite",
        "blob-slow": "blob-slow 15s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
