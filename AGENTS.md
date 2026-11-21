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
  Shell.tsx               # skupna lupina (logo, uporabnik, odjava prek POST /api/auth/logout)
  pacient/page.tsx        # pacient UI (+ SOS gumb)
  zdravnik/page.tsx       # dashboard zdravnika
  api/
    auth/login/route.ts        # POST {email,password} → httpOnly piškotek "session"=userId
    auth/logout/route.ts       # POST → počisti sejo, redirect na /login
    measurements/route.ts      # GET seznam; POST vnos meritve + alarm logika (meje + dedup)
    patients/route.ts          # GET seznam / POST nov pacient s plani in zdravili (ZDRAVNIK)
    alerts/route.ts            # GET seznam; POST {action:"sos"} | {action:"acknowledge",alertId}
    chat/route.ts              # GET/POST sporočila (pacient / zdravnik s patientId)
    assistant/route.ts         # GET/POST pogovor z AI asistentom (samo PACIENT; bere knjižnico + meritve pacienta)
    medications/route.ts       # POST {medicationId,time:"HH:MM"} — preklopi današnji odmerek
    upload/route.ts            # POST multipart "file" → public/uploads/, vrne {url:"/uploads/..."}
    cron/missed-checkins/route.ts # POST — alarmi IZOSTANEK_VNOSA (x-cron-secret ali seja ZDRAVNIK)
lib/
  prisma.ts               # PrismaClient singleton
  auth.ts                 # getSessionUser() — prebere piškotek, vrne User
  http.ts                 # readJson() (varno branje JSON) in jsonError()
  thresholds.ts           # evaluateThresholds() — zgornje IN spodnje meje plana
  assistant.ts            # AI asistent: konfiguracija LLM iz .env, kontekst (knjižnica + meritve + načrti + alarmi), klic, fallback
prisma/
  schema.prisma           # podatkovni model
  seed.mjs                # demo podatki
public/uploads/           # naložene slike ran (lokalno; kasneje object storage)
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
- `MeasurementPlan` ima poleg `thresholdL1/L2/L3` tudi **spodnje meje** `thresholdLowL1/L2/L3` (npr. SpO2) ter polja `baseline`, `baselineDate`, `customized`, `greenZone`, `yellowZone`, `redZone`
- `Medication.times`: JSON array `"HH:MM"`; `Medication.takenSlots`: JSON array opravljenih terminov `"YYYY-MM-DD HH:MM"` (per-čas, lokalni čas)

## Avtentikacija in vloge

- Enostavna seja: ob prijavi nastavimo httpOnly piškotek `session` z `userId` (hackathon; gesla so plaintext, **samo sintetični podatki**).
- `lib/auth.ts → getSessionUser()` kličejo strani (server komponente) in API route-i.
- Strani `/pacient/*` preverijo `role === "PACIENT"`, `/zdravnik/*` pa `role === "ZDRAVNIK"`, sicer redirect na `/login`.
- API route-i vedno preverijo sejo in vlogo (glej `app/api/measurements/route.ts` kot zgled).

## Alarm logika (jedro produkta)

Ob vsakem `POST /api/measurements` primerjamo vrednost z mejami plana — zgornjimi (`thresholdL1/L2/L3`) IN spodnjimi (`thresholdLowL1/L2/L3`) — glej `lib/thresholds.ts`. V potrebi ustvarimo `Alert`, brez duplikacije: če za isti plan že obstaja odprt (ODPRT) alarm iste stopnje, novega ne ustvarimo.

- **L1** — malo čez mejo → zdravnik pregleda v **1 dnevu**
- **L2** — več čez mejo → zdravnik pregleda v **1 uri**
- **L3** — kritično → **takojšnje** obvestilo; pacient mora poklicati urgenco
- **SOS** — `POST /api/alerts {"action":"sos"}` (SOS gumb na strani pacienta) → takojšen alarm
- **IZOSTANEK_VNOSA** — `POST /api/cron/missed-checkins` (zaščiteno s headerjem `x-cron-secret` iz `CRON_SECRET` ali sejo zdravnika) → alarm za paciente brez vnosa meritev > 24 h; najprej kontaktna oseba, nato zdravnik
- Potrjevanje alarma: `POST /api/alerts {"action":"acknowledge","alertId":"..."}` (samo `ZDRAVNIK`) → `status=POTRJEN`, `acknowledgedAt`, `acknowledgedBy`
- Seznam alarmov: `GET /api/alerts` (zdravnik vidi vse, pacient svoje)

## AI asistent

- Route `app/api/assistant/route.ts` (samo `PACIENT`): `GET` vrne zgodovino sporočil `PACIENT`+`ASISTENT`; `POST {text}` shrani vprašanje, pokliče LLM in shrani odgovor kot `sender: "ASISTENT"`. Oba zapisa sta v isti tabeli `ChatMessage` — zdravnik vidi celoten pogovor v svojem pogledu "Klepet".
- Konfiguracija v `.env` (Next.js jo prebere sam; že nastavljene `process.env` spremenljivke imajo prednost pred `.env`):
  - `AI_API_URL` — osnovni URL **OpenAI-compatible** endpointa (npr. `https://api.openai.com/v1`, `http://localhost:11434/v1` za Ollama, `https://api.groq.com/openai/v1`); če URL že vsebuje `/chat/completions`, se uporabi kar tako, sicer se pripne
  - `AI_API_KEY` — pošlje se kot `Authorization: Bearer …`
  - `AI_MODEL` — npr. `gpt-4o-mini`, `llama3.1`
- Če katera od treh manjka ali klic spodleti (timeout 30 s, HTTP napaka, prazen odgovor), asistent vrne fallback sporočilo (`ASSISTANT_FALLBACK` v `lib/assistant.ts`) in ga normalno shrani — UI/demo ne crkne brez ključa.
- Zahteva na LLM: `POST {AI_API_URL}/chat/completions` z `{model, messages, max_tokens: 600, temperature: 0.3}`, brez streamanja.
- Kontekst (`lib/assistant.ts → buildContext`): diagnoza + datum odpusta, vsi merilni načrti z mejami (L1/L2/L3, spodnje meje, barvne cone), zadnjih **20 meritev** z enoto in opombo, odprti alarmi, **vsi vnosi knjižnice**; plus zadnjih **12 sporočil** pogovora. Sistemski prompt: odgovori v slovenščini, kratko, z disclaimerjem (ni zdravnik, nujno 112) in s sklicevanjem na podatke iz konteksta.

## Demo računi in podatki

| Vloga | E-pošta | Geslo |
|---|---|---|
| Pacient | `pacient@test.si` | `pacient123` |
| Zdravnik | `zdravnik@test.si` | `zdravnik123` |

Vsi novi pacienti, ustvarjeni prek `POST /api/patients`, dobijo **isto privzeto geslo `pacient123`** (konstanta `DEFAULT_PATIENT_PASSWORD` v `lib/auth.ts`).

Seed podatki: pacient Janez Novak (operacija kolena), 6 merilnih planov (utrip, pritisk, temperatura, bolečina, kisik s spodnjimi mejami, slika rane), 2 meritvi (ena čez L2 → demo alarm), 2 zdravili (ena z že odvzetim današnjim terminom), 4 vnosi knjižnjice, 2 chat sporočili.

## Konvencije kode

- Jezik kode angleščina, uporabniški vmesnik slovenščina.
- Server komponente privzeto; `"use client"` samo za interaktivne dele (form, gumbi).
- Importi přes `@/...` (nastavljeno v `tsconfig.json`).
- Nova stran: `app/<pot>/page.tsx`; nov API: `app/api/<pot>/route.ts` (GET/POST, `NextRequest`/`NextResponse`).
- Prisma: vedno `lib/prisma.ts` singleton, nikoli novega `PrismaClient` na roke.
- **Pred commmit obvezno `npm run build`** in ročni smoke test (login + vnos meritve).
- Ne commitaj: `node_modules/`, `.next/`, `.env`, `prisma/*.db*`, `public/uploads/*` (razen `.gitkeep`), `.devenv/` (vse v `.gitignore`). `.env` vsebuje `DATABASE_URL="file:./dev.db"` (relativno na mapo `prisma/`, torej `prisma/dev.db`) in prazne `AI_API_URL`/`AI_API_KEY`/`AI_MODEL` — prave vrednosti ostanejo lokalno, nikoli v gitu.

## Varnost / podatki

Gre za zdravstvene podatke (GDPR): **samo sintetični (lažni) podatki**, brez pravih osebnih podatkov. AI asistent kliče pravi LLM endpoint samo če je nastavljen v `.env` (lokalno / lastna infrastruktura); sicer odgovarja s fallback sporočilom. zVem integracija je za hackathon še vedno stub — pravi LLM klic v produkciji pride šele na zdravstveni infrastrukturi.

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
# vnos pod spodnjo mejo (kisik 88) → alarm L3
curl -b /tmp/c.txt -X POST http://localhost:3000/api/measurements \
  -H 'Content-Type: application/json' \
  -d '{"type":"KISIK","value":88}'
# seznam alarmov / SOS / potrdi alarm
curl -b /tmp/c.txt http://localhost:3000/api/alerts
curl -b /tmp/c.txt -X POST http://localhost:3000/api/alerts \
  -H 'Content-Type: application/json' -d '{"action":"sos"}'
curl -b /tmp/d.txt -X POST http://localhost:3000/api/alerts \
  -H 'Content-Type: application/json' -d '{"action":"acknowledge","alertId":"<id>"}'
# upload slike rane (vrne {"url":"/uploads/..."})
curl -b /tmp/c.txt -X POST http://localhost:3000/api/upload -F "file=@slika.jpg"
# chat, zdravilo, preverjanje izostalih vnosov
curl -b /tmp/c.txt -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' -d '{"text":"Danes sem dobro."}'
curl -b /tmp/c.txt -X POST http://localhost:3000/api/medications \
  -H 'Content-Type: application/json' -d '{"medicationId":"<id>","time":"20:00"}'
curl -b /tmp/d.txt -X POST http://localhost:3000/api/cron/missed-checkins
# AI asistent (samo PACIENT) — brez nastavljenega AI_API_KEY dobimo fallback odgovor
curl -b /tmp/c.txt http://localhost:3000/api/assistant
curl -b /tmp/c.txt -X POST http://localhost:3000/api/assistant \
  -H 'Content-Type: application/json' -d '{"text":"Ali grem lahko že na 5 km sprehod?"}'
```

(`curl -c /tmp/d.txt ... zdravnik@test.si` prijavi zdravnika za `/tmp/d.txt`)
