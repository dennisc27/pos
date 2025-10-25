import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1F6FEB",
          dark: "#174EA6",
          light: "#A4C5FF"
        },
        success: "#22C55E",
        warning: "#FACC15",
        danger: "#EF4444"
      }
    }
  },
  plugins: []
};

export default config;
