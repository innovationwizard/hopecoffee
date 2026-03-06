import type { Config } from "tailwindcss";
import containerQueries from "@tailwindcss/container-queries";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        orion: {
          50: "#eef3ff",
          100: "#d9e4ff",
          200: "#b3c8ff",
          300: "#7da3ff",
          400: "#4a7aff",
          500: "#2656d6",
          600: "#1a3fa8",
          700: "#112d7a",
          800: "#0c1f54",
          900: "#0a1628",
          950: "#060e1a",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-dm-sans)",
          "DM Sans",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "SF Mono",
          "Fira Code",
          "ui-monospace",
          "monospace",
        ],
      },
    },
  },
  plugins: [containerQueries],
};

export default config;
