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
        brown: {
          DEFAULT: "#A2845E", // Apple HIG Brown
          50: "#F7F3ED",
          100: "#EAE0D1",
          200: "#D5C4A8",
          300: "#C0A87F",
          400: "#AB8C56",
          500: "#A2845E",
          600: "#8B6F47",
          700: "#6F5938",
          800: "#53432A",
          900: "#372C1C",
        },
        teal: {
          DEFAULT: "#5AC8C8", // Apple HIG Teal
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
        success: "#34C759",
        warning: "#FF9500",
      },
      boxShadow: {
        hig: "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)",
        'hig-hover': "0 2px 8px rgba(0,0,0,0.1), 0 10px 24px rgba(0,0,0,0.08)",
        'float': "0 8px 16px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.12)",
        'float-lg': "0 12px 24px rgba(0,0,0,0.1), 0 24px 64px rgba(0,0,0,0.15)",
        'brown-glow': "0 4px 16px rgba(162,132,94,0.2)",
        'teal-glow': "0 4px 16px rgba(90,200,200,0.2)",
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
      }
    },
  },
  plugins: [],
};
export default config;
