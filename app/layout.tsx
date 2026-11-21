import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdaHack2026 — Spremljanje pacientov na domu",
  description: "Spremljanje pacientov na domu po odpustu iz bolnišnice",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sl">
      <body>{children}</body>
    </html>
  );
}
