import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/shared/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#5856D6", // HIG Indigo
          light: "#7B79E0",
          dark: "#3634A3",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          secondary: "#F2F2F7",
        },
        label: {
          primary: "#1C1C1E",
          secondary: "#636366",
        },
        separator: "#E5E5EA",
        fill: "rgba(120, 120, 128, 0.2)",
        destructive: "#FF3B30",
        success: "#34C759",
        warning: "#FF9500",
      },
      boxShadow: {
        hig: "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)",
        'hig-hover': "0 2px 8px rgba(0,0,0,0.1), 0 10px 24px rgba(0,0,0,0.08)",
      },
      borderRadius: {
        'hig-sm': '4px',
        'hig-md': '10px',
        'hig-lg': '14px',
        'hig-xl': '20px',
      }
    },
  },
  plugins: [],
};
export default config;
