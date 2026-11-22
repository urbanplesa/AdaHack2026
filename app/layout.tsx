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
      <body>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Nunito:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        {children}
      </body>
    </html>
  );
}
