# AGENTS.md — AdaHack2026

Spremljanje pacientov na domu po odpustu iz bolnišnice (hackathon projekt, glej `README.md` za idejo in zahteve).

## Stack

- **Next.js 15 (App Router) + TypeScript (strict) + React 19**
- **Prisma 6 + SQLite** (`prisma/dev.db`) — preklop na Postgres kasneje samo z menjavo `provider` v shemi
- **Tailwind CSS 3.4**
- HTTP strežnik je vgrajen v Next.js (`app/api/*` route handlerji) — ni ločenega serverja

## Zagon (devenv / Nix)

Vse ukaze poganjamo **znotraj devenv okolja**:

```bash
devenv shell                 # vstop v okolje (node 22, npm, DATABASE_URL, PRISMA_* poti)
npm install                  # enkrat po klonu
npm run db:migrate           # migracije (prvič oz. po spremembi sheme)
npm run db:seed              # demo podatki (idempotentno — najprej počisti)
npm run dev                  # http://localhost:3000
npm run build                # produkcijski build (preveri pred commmit)
```

**Pazi:** `devenv shell CMD ARGS` argumente razdeli po presledkih (ne upošteva navednicov) — zato kompleksnejše ukaze piši v skripto in kliči `devenv shell bash pot/do/skripte.sh`.

### NixOS + Prisma (pomembno!)

Na NixOS Prisma zazna platformo `linux-nixos`, uradnih engine binarnikov zanjo ni (404 ob `prisma generate`). Rešitev je v `devenv.nix`:

- `binaryTargets = ["debian-openssl-3.0.x"]` v `prisma/schema.prisma`
- `PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x` in poti `PRISMA_*_BINARY` / `PRISMA_QUERY_ENGINE_LIBRARY` proti `node_modules/@prisma/engines/` in `node_modules/.prisma/client/`
- preneseni binarniki tečejo prek sistemskega nix-ld (`libssl.so.3`, `libstdc++.so.6` sta na voljo)

**Ob prvem `prisma generate` po `npm install` moramo začasno `unset`nit `PRISMA_*_BINARY/LIBRARY`** (poti še ne obstajajo, sicer generate crkne). Potem so nastavljene nazaj in vse deluje (migrate, seed, runtime).

## Struktura projekta

```
app/
  login/page.tsx          # prijava (client komponenta)
  pacient/page.tsx        # pacient UI (v delu)
  zdravnik/page.tsx       # dashboard zdravnika (v delu)
  api/
    auth/login/route.ts   # POST {email,password} → httpOnly piškotek "session"=userId
    measurements/route.ts # GET (seznam), POST (vnos + alarm logika)
lib/
  prisma.ts               # PrismaClient singleton
  auth.ts                 # getSessionUser() — prebere piškotek, vrne User
prisma/
  schema.prisma           # podatkovni model
  seed.mjs                # demo podatki
public/uploads/           # slike ran (lokalno; kasneje object storage)
devenv.nix                # dev okolje (node, env spremenljivke)
```

## Podatkovni model (Prisma)

`User` → `Patient` → `MeasurementPlan`, `Measurement`, `Alert`, `Medication`, `ChatMessage`; ločena `LibraryEntry` (knjižnjica).

**SQLite ne podpira `enum`** — zato so statusi navadni `String` z dogovorjenimi vrednostmi:

- `User.role`: `PACIENT | ZDRAVNIK | KONTAKTNA_OSEBA`
- `Patient.status`: `AKTIVEN | V_BOLNICI | ZAKLJUCEN`
- `Alert.severity`: `L1 | L2 | L3 | SOS | IZOSTANEK_VNOSA`
- `Alert.status`: `ODPRT | POTRJEN`
- `MeasurementPlan.type` / `Measurement.type`: `POCUTJE | BOLECINA | UTRIP | PRITISK | SLADKOR | KISIK | TEZA | TEMPERATURA | PLJUCNA_KAPACITETA | GIBLJIVOST | SLIKA_RANE`

## Avtentikacija in vloge

- Enostavna seja: ob prijavi nastavimo httpOnly piškotek `session` z `userId` (hackathon; gesla so plaintext, **samo sintetični podatki**).
- `lib/auth.ts → getSessionUser()` kličejo strani (server komponente) in API route-i.
- Strani `/pacient/*` preverijo `role === "PACIENT"`, `/zdravnik/*` pa `role === "ZDRAVNIK"`, sicer redirect na `/login`.
- API route-i vedno preverijo sejo in vlogo (glej `app/api/measurements/route.ts` kot zgled).

## Alarm logika (jedro produkta)

Ob vsakem `POST /api/measurements` primerjamo vrednost s mejami plana (`thresholdL1/L2/L3`) in po potrebi ustvarimo `Alert`:

- **L1** — malo čez mejo → zdravnik pregleda v **1 dnevu**
- **L2** — več čez mejo → zdravnik pregleda v **1 uri**
- **L3** — kritično → **takojšnje** obvestilo; pacient mora poklicati urgenco
- **SOS** — pacient pritisne SOS gumb → takojšen alarm
- **IZOSTANEK_VNOSA** — pacient ne vnaša podatkov → najprej kontaktna oseba, nato zdravnik (cron oz. ročni endpoint, še v izdelavi)

## Demo računi in podatki

| Vloga | E-pošta | Geslo |
|---|---|---|
| Pacient | `pacient@test.si` | `pacient123` |
| Zdravnik | `zdravnik@test.si` | `zdravnik123` |

Seed podatki: pacient Janez Novak (operacija kolena), 5 merilnih planov (utrip, pritisk, temperatura, bolečina, slika rane), 2 meritvi (ena čez L2 → demo alarm), 2 zdravili, 4 vnosi knjižnjice, 2 chat sporočili.

## Konvencije kode

- Jezik kode angleščina, uporabniški vmesnik slovenščina.
- Server komponente privzeto; `"use client"` samo za interaktivne dele (form, gumbi).
- Importi přes `@/...` (nastavljeno v `tsconfig.json`).
- Nova stran: `app/<pot>/page.tsx`; nov API: `app/api/<pot>/route.ts` (GET/POST, `NextRequest`/`NextResponse`).
- Prisma: vedno `lib/prisma.ts` singleton, nikoli novega `PrismaClient` na roke.
- **Pred commmit obvezno `npm run build`** in ročni smoke test (login + vnos meritve).
- Ne commitaj: `node_modules/`, `.next/`, `prisma/dev.db*`, `public/uploads/*` (razen `.gitkeep`), `.devenv/` (že v `.gitignore`). `.env` vsebuje samo `DATABASE_URL` za lokalni SQLite — brez skrivnosti.

## Varnost / podatki

Gre za zdravstvene podatke (GDPR): **samo sintetični (lažni) podatki**, brez pravih osebnih podatkov. AI asistent in zVem integracija sta za hackathon **mock/stub** — pravi LLM klic pride šele po hackathonu na zdravstveni infrastrukturi.

## Trenutni obseg (MVP za 24 h)

Must: login, vnos meritev (s sliko), alarmi L1–L3, dashboard z alarmi, SOS, seed podatki.
Should: grafi meritev, koledar zdravil, knjižnjica, začetni vnos pacienta.
Nice: chat stub, opozorila ob izostalih vnosih, e-pošta.

## Koristni ročni testi (curl)

```bash
# login (shrani piškotek)
curl -c /tmp/c.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"pacient@test.si","password":"pacient123"}'
# seznam meritev
curl -b /tmp/c.txt http://localhost:3000/api/measurements
# vnos meritve čez L3 mejo (utrip 150) → ustvari alarm
curl -b /tmp/c.txt -X POST http://localhost:3000/api/measurements \
  -H 'Content-Type: application/json' \
  -d '{"type":"UTRIP","value":150,"note":"test"}'
```
