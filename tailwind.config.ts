import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/shared/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /*
         * Historically this palette was brown — we've remapped every shade to
         * Apple HIG systemMint so every existing `text-brown-*`, `bg-brown-*`,
         * and `border-brown-*` usage across the app now renders as mint without
         * requiring per-component edits. The name is kept for backwards compat.
         */
        brown: {
          DEFAULT: "#00C7BE", // Apple HIG systemMint (light)
          50: "#E6F9F8",
          100: "#BFF0EE",
          200: "#80E3DE",
          300: "#40D5CE",
          400: "#00C7BE",
          500: "#00C7BE",
          600: "#009F98",
          700: "#007872",
          800: "#00504D",
          900: "#002827",
        },
        // Explicit Apple HIG systemMint palette (preferred for new code).
        mint: {
          DEFAULT: "#00C7BE",
          50: "#E6F9F8",
          100: "#BFF0EE",
          200: "#80E3DE",
          300: "#40D5CE",
          400: "#00C7BE",
          500: "#00C7BE",
          600: "#009F98",
          700: "#007872",
          800: "#00504D",
          900: "#002827",
        },
        teal: {
          DEFAULT: "#5AC8C8", // Legacy HIG Teal - kept for backwards compat
          50: "#E8F8F8",
          100: "#C7EEEE",
          200: "#A0E3E3",
          300: "#78D8D8",
          400: "#51CDCD",
          500: "#5AC8C8",
          600: "#3DB1B1",
          700: "#2E8A8A",
          800: "#206363",
          900: "#113C3C",
        },
        // Apple HIG systemTeal
        // Light: #30B0C7  Dark: #40C8E0 (the default here is the light variant;
        // dark mode is handled in globals.css via a CSS variable)
        'apple-teal': {
          DEFAULT: "#30B0C7",
          50: "#E7F6F9",
          100: "#C1E8EF",
          200: "#8CD6E2",
          300: "#5BC5D6",
          400: "#40C8E0",
          500: "#30B0C7",
          600: "#268FA1",
          700: "#1E6E7C",
          800: "#164E57",
          900: "#0E3037",
        },
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          secondary: "rgb(var(--surface-secondary) / <alpha-value>)",
          tertiary: "rgb(var(--surface-tertiary) / <alpha-value>)",
        },
        label: {
          primary: "rgb(var(--label-primary) / <alpha-value>)",
          secondary: "rgb(var(--label-secondary) / <alpha-value>)",
          tertiary: "rgb(var(--label-tertiary) / <alpha-value>)",
        },
        separator: "rgb(var(--separator) / <alpha-value>)",
        fill: "rgba(var(--fill) / <alpha-value>)",
        destructive: "#FF3B30",
        success: "#00C7BE", // Apple HIG systemMint — used for tick/confirmation dots app-wide
        warning: "#FF9500",
      },
      boxShadow: {
        hig: "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)",
        'hig-hover': "0 2px 8px rgba(0,0,0,0.1), 0 10px 24px rgba(0,0,0,0.08)",
        'float': "0 8px 16px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.12)",
        'float-lg': "0 12px 24px rgba(0,0,0,0.1), 0 24px 64px rgba(0,0,0,0.15)",
        // All brand glows now tint mint/teal. Utility names retained for backwards compat.
        'brown-glow': "0 4px 16px rgba(0,199,190,0.28)",
        'teal-glow': "0 4px 16px rgba(48,176,199,0.28)",
        'apple-teal': "0 4px 16px rgba(48,176,199,0.28)",
        'mint-glow': "0 4px 16px rgba(0,199,190,0.28)",
      },
      borderRadius: {
        'hig-sm': '4px',
        'hig-md': '10px',
        'hig-lg': '14px',
        'hig-xl': '20px',
        'hig-2xl': '24px',
        'hig-3xl': '32px',
      },
      backdropBlur: {
        'hig': '24px',
      },
      keyframes: {
        blob: {
          '0%': {
            transform: 'translate(0px, 0px) scale(1)',
          },
          '33%': {
            transform: 'translate(30px, -50px) scale(1.1)',
          },
          '66%': {
            transform: 'translate(-20px, 20px) scale(0.9)',
          },
          '100%': {
            transform: 'translate(0px, 0px) scale(1)',
          },
        },
        'blob-slow': {
          '0%, 100%': {
            transform: 'translate(0px, 0px) scale(1)',
          },
          '33%': {
            transform: 'translate(40px, -60px) scale(1.15)',
          },
          '66%': {
            transform: 'translate(-30px, 30px) scale(0.85)',
          },
        },
      },
      animation: {
        blob: 'blob 7s infinite',
        'blob-slow': 'blob-slow 15s infinite',
      },
    },
  },
  plugins: [],
};
export default config;
