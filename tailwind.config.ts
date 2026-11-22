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
        accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" },
        warning: "var(--warning)",
        success: "var(--success)",
        destructive: "var(--destructive)",
      },
      fontFamily: {
        sans: ["Nunito", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", '"Times New Roman"', "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
