import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        secondary: "var(--secondary)",
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        border: "var(--border)",
        warning: "var(--warning)",
        success: "var(--success)",
        destructive: "var(--destructive)",
      },
      fontFamily: {
        display: ['Georgia', '"Times New Roman"', "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
