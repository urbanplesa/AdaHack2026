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
- Chat window za zdravnika
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

## Rešitev

**Kaj je sploh problem?** Zdravniki nimajo več nadzora nad pacienti, pacienti pa nimajo vseh informacij o okrevanju.

Na spletni strani/aplikaciji se naredi knjižnjico meritev priporočljivih za neko bolezen/poškodbo in proporočila za dejavnosti in prehrano, ter potek okrevanja.

Pred odpustom pacienta iz bolnišinice zdravnik izbere meritve, ki naj jih pacient opravlja in zapisuje na aplikacijo/spletno stran, ter kdaj naj jih dela. Pacientu se izmeri oz. določi mejne vrednosti meritev. Pacient tudi poda kontaktno osebo za obveščanje in dostopa do knjižnjice in vnašanja podatkov. Pacient si lahko izposodi merilec (za srčni utrip, tlak, kisik, ipd.)., ter se mu pokaže kako se meritev pravilno opravi.

Iz portala zVem se prodobi recepte za zdravila, ki se dodajo v knjižnico - kdaj in kako se mora jemati (ob potrditvi zdravnika). Pacient si lahko vklopi obvestila na telefon, kdaj naj vzame zdravilo.

Če meritev preseže mejno vrednost, se glede na presežek obvesti zdravstvenega delavca, ki pregelda opozorilo in ustrezno ukrepa, če je potrebno. Npr. če je meritev nad prvo mejno vrednostjo, jo zdravstveni delavec pregleda v enem dnevu, če čez drugo pa v eni uri. Lahko je tudi tretja, ki takoj obvesti zdravstvenega delavca, pacient pa naj takoj pokliče urgenco.

V primeru nevnašnaja podatkov se sprva obvesti kontaktno osebo, kasneje še zdravnika.

Ko zdravnik oceni (ali po vnaprej določenem obdobju brez nesprejemljivih meritev), da je pacient zdrav ali se okrevanje ne more poslabšati, se nadzor zaključi, pacient pa ima dostop do knjižnjice še 30 dni.
