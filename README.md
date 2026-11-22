# Spremljanje pacientov na domu po odpustu iz bolnišnice

## Izziv

Po odpustu iz bolnišnice se pacienti pogosto soočajo s pomanjkanjem zdravstvenega nadzora, zaradi česar lahko resni zapleti ostanejo neopaženi, dokler se stanje že precej ne poslabša. 🏥

🩺 Kako lahko tehnologija omogoči učinkovitejše spremljanje okrevanja na domu?

💡 Izziv se osredotoča na razvoj digitalnega sistema, ki pacientom omogoča preprosto poročanje o počutju in zdravstvenem stanju, zdravstvenemu osebju pa pomaga pravočasno prepoznati morebitne zaplete in ukrepati.

## Ideje

- Spletna stran za paciente (in dashboard za zdravnike)
- Navodila za merjenje
- Nalaganje meritev
- Knjižnjica meritev za bolezni/poškode (zdravnik izbere samo potrebne)
- Naprave, ki merijo in samodejno pošiljajo podatke
- AI asistent za navodila in vprašanja glede na podane knjižnjice
- Koledar za zdravila, checkbox da si vzel
- Prehrana
- SOS gumb

### Meritve

- počutje (dobro, slabo, utrujenost, ipd)
- bolečine
- utrip (povprečen v nekem času)
- pritisk
- sladkor
- kisik
- teža
- pljučna kapaciteta
- temperatura
- slika rane/šiva (in opis)
- gibljivost, mravljinčenje

### Komunikacija/obveščanje

- nenormalne meritve: obvesti zdravnika/pojdi na urgenco/pokliči rešilca
- Zdravnikv/med sestra/svojec obveščen ko pacient ne vpisuje podatkov

### Dashboard

- Seznam pacientov (kdo, kaj je znemu, status)
- status (vse vredu, nekaj je lahko narobe, nekaj je narobe, v bolnišnici, nova meritve - npr. slika ali obvestilo)
- nekaj je lahko narobe obvestilo gre zdravniku/medicinski sestri
- za pacienta vidi vse podatke
- začeten vnos podatkov iz bolnišnice za pacienta

### Knjižnjica

- Meritve
- Normalni stranski učinki
- Okviren potek okrevanja (časovnica)
- Priporočila za prehrano
- Fizične vaje za okrevanje
- AI asistent (hosted na zdravstveni infrastrukturi), ki odgovarja na vprašanja, ki za katere pacienti normalno nebi poklicali zdravnika (npr. ali grem lahko na 5km sprehod po 2 tednih za operacijo kolena?).
- Zdravnik lahko izkluči/doda priporočila

## Problem

**Kaj je sploh problem?** Zdravniki nimajo nadzora nad pacienti ko te zapustijo bolnišnico, pacienti nimajo vseh informacij o okrevanju, prav tako zelo pozno dobijo fizioterapevta, zato okrevanje stagnira.

## Rešitev

Rešitev je platforma, s katero zdravnik, s čim manj dela, preverja, da stanje pacienta ni kritično in pacientu poda čim več informacij o dogajanju po operaciji, te so:
- meritve, naj ki jih pacient izvaja,
- okvirna časovnica okrevanja,
- priporočena prehrana,
- priporočene fizioterapevtske vaje.

Ko zdravnik doda novega pacienta, se z vnosom ZZZS številke izpolnijo vsi podatki o pacientu. 
Nato zdravnik označi stanje oz. bolezen. Glede na to, platforma avtomatsko označi potrebne zgornje informacije, ki jih bo pacient prejel. Zdravnik lahko to sam ročno prilagodi.
Prav tako platforma iz baze bolnišnice importira dosedanje meritve, ki so jih opravili v bolnišnici.
Vsak tip meritve ima pričakovana, nenavadna in kritična območja podatkov. Meje se izpolnijo samodejno, a ji zdravnik lahko sam prilagodi.

Ko pacient odpre platformo, mu ta pove naj izpolni meritve, če tega ta dan še ni storil. Po opravljenih meritvah pa mu priporoči vaje za ta dan in ostale informacije o njegovem stanju. Če je bila kakšna meritev nenavadna mu priporoči posvet z zdravnikom, če je bila kritična pa klic na urgenco.
Pacient ima možnost klepeta z Umetno inteligenco, ki mu odgovarja glede na njegove meritve in informacije.

Zdravnik ima v svojem pogledu seznam vseh pacientov, obveščen je za tiste, ki imajo kritično, nenavadno ali že tri dni neznano stanje.

## Kaj je implementirano

- Prijava po vlogah (pacient / zdravnik), seja prek httpOnly piškočka.
- **Katalog 28 stanj** (izvorni projekt `lovable/`): ob dodajanju pacienta zdravnik izbere stanje → samodejno se nastavijo merilni načrti z mejami iz kataloga (npr. `SpO2<90` → L3), priporočila za okrevanje (potek, prehrana, opozorilni simptomi, alarmi, oprema) in **sklopi vaj** z izračunanim datumom začetka.
- **25 PDF vodičev fizioterapije SB Nova Gorica** (lokalno v `public/guides/`, z izvirnim virom) — v knjižnici in v pacientovem načrtu; opomnik »Čas je za začetek vaj« s potrditvijo prejema.
- Meritve po vrsti vnosa: število, besedilo, pritisk `120/80`, da/ne + opis, slika (rana/EKG); zdravnik lahko vnaša svoje meritve z oceno (varno/nenavadno/kritično).
- Alarm logika L1/L2/L3 (zgornje in spodnje meje) + SOS + alarmi ob izostanku vnosa (**samodejni pregled vsakih 15 min** prek `instrumentation.ts`, po potrebi še ročni `POST /api/cron/missed-checkins`). **Pacient takoj vidi opozorilo, če njegova meritev preseže mejo** (L3/SOS → rdeč banner »takoj pokličite 112«, L2 → rumeno; zavihek Alarmi na strani pacienta). Zdravnik potrjuje alarme in pripravlja opomnike (e-pošta).
- **Grafi trendov meritev** (SVG, brez dodatnih odvisnosti): zdravnik vidi pod vsako numerično merijo črtni graf z mejnimi črtami L1/L2/L3 in točkami, obarvanimi po resnosti prekoračitve; pacient vidi kompakten graf nad zgodovino v svoji kartici meritve. Seed podatki vsebujejo 10-dnevno zgodovino, da so grafi takoj vidni.
- Standardne meje bolnice na tip meritve (ureja zdravnik), izhodišča pred odpustom (»podatki iz bolnišnice«), koledar zdravil z odkljukavanjem terminov.
- Knjižnjica znanj (urejanje samo zdravnik) in **AI asistent** (OpenAI-compatible endpoint iz `.env`, kontekst = načrti + meritve + alarmi + knjižnjica + vaje pacienta).

## Razvoj

Tehnična dokumentacija, zagon in konvencije so v [`AGENTS.md`](AGENTS.md).

Hiter zagon (Nix/devenv):

```bash
devenv shell          # vstop v dev okolje
npm install
npm run db:migrate    # če še ni baze
npm run db:seed       # demo podatki
npm run dev           # http://localhost:3000
```

Demo prijavi: `pacient@test.si / pacient123` in `zdravnik@test.si / zdravnik123` (samo sintetični podatki).
