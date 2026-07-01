import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#0a0a0f",
        accent: {
          DEFAULT: "#c9a84c",
          light: "#e4c575",
          dark: "#b8922f",
        },
        bg: {
          DEFAULT: "#ffffff",
          alt: "#f7f7f9",
          card: "#ffffff",
        },
        border: {
          DEFAULT: "#e8e8ed",
          strong: "#d1d1db",
        },
        text: {
          primary: "#0a0a0f",
          secondary: "#4a4a5a",
          muted: "#8f8fa5",
        },
      },
      fontFamily: {
        sans: ["'Pretendard Variable'", "Pretendard", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "10px",
        lg: "18px",
      },
      boxShadow: {
        soft: "0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.06)",
        lift: "0 12px 40px rgba(0,0,0,0.10)",
        gold: "0 6px 20px rgba(201,168,76,0.35)",
        ring: "0 0 0 4px rgba(201,168,76,0.15)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      maxWidth: {
        wrap: "1280px",
        narrow: "760px",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.6s cubic-bezier(0.2,0.8,0.2,1) both",
        "fade-in": "fadeIn 0.3s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
