import Link from "next/link";

export default function Shell({ children, userName }: { children: React.ReactNode; userName?: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="font-display flex items-center gap-2 text-2xl font-semibold text-primary">
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xl text-white">♥</span>
          Vitalis
        </Link>
        {userName && <div className="flex items-center gap-3 text-sm"><span className="text-muted-foreground">{userName}</span><form action="/api/auth/logout" method="POST"><button type="submit" className="rounded-full border border-border px-4 py-2 font-semibold hover:bg-muted">Odjava</button></form></div>}
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">{children}</main>
    </div>
  );
}
