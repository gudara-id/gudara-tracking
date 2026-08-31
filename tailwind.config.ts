import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Warm workshop-paper neutral scale, used everywhere the app already
        // calls `slate-*` — this reskins the whole app to a consistent warm
        // tone without touching every className.
        slate: colors.stone,
        // Brand accents: denim (primary, cool) and thread (accent, warm gold).
        denim: {
          50: "#eef2f8",
          100: "#dbe4f0",
          200: "#b6c9e1",
          300: "#8ea9cd",
          400: "#5f80ab",
          500: "#3f6088",
          600: "#32496b",
          700: "#293c58",
          800: "#212f45",
          900: "#182233",
          950: "#0f1520",
        },
        thread: {
          50: "#fdf6e9",
          100: "#faecc8",
          200: "#f3d68d",
          300: "#e9bc55",
          400: "#dba635",
          500: "#c1892a",
          600: "#9c6c21",
          700: "#78521c",
          800: "#5a3e18",
          900: "#402c12",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
