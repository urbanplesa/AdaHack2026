# CONTEXT.md — glosar domene (AdaHack2026)

Samo pojmi, brez implementacijskih podrobnosti (te so v `AGENTS.md`).

- **Pacient** — oseba po odpustu iz bolnišnice, ki doma vnaša meritve in klepeta. Ima račun z vlogo `PACIENT` in svoj profil pacienta.
- **Zdravnik** — uporabnik z vlogo `ZDRAVNIK`; spremlja paciente, pregleduje in potrjuje alarme, odgovarja v klepetu.
- **Meritev** — en vnos (pacienta ali zdravnika): tip, vrednost (numerična ali besedilna, npr. pritisk »120/80«), opomba, morebitna slika, avtor in ocena zdravnika (VARNO/NENAVADNO/KRITICNO).
- **Merilni načrt** — dogovorjena meritev s frekvenco, vrsto vnosa (`kind`: NUMERIC/TEXT/PRESSURE/IMAGE/YESNO), alarmnimi mejami (L1/L2/L3, zgornje in spodnje), barvnimi conami in izhodiščno vrednostjo iz bolnišnice (baseline).
- **Katalog stanj** — 28 kliničnih stanj z merjenimi tipi, priporočili, opozorilnimi simptomi, alarmi in sklopi vaj; ob dodajanju pacienta z znanim stanjem se načrt nastavi samodejno.
- **Sklop vaj** — vodič/PDF (fizioterapija SB Nova Gorica) ali po meri sestavljen sklop, dodeljen pacientu z datumom začetka; pacient dobi opomnik in ga potrdi.
- **Standard** — standardna meja bolnice za tip meritve (npr. SpO2); uporabi se, kadar načrt nima lastnih mej.
- **Alarm** — sproženo opozorilo (L1/L2/L3, SOS, IZOSTANEK_VNOSA) z statusom ODPRT ali POTRJEN (s časom in potrditeljem).
- **Knjižnjica** — globalno znanje za paciente (kategorije MERITVE, PREHRANA, VAJE, POTEK_OKREVANJA); ni vezana na posameznega pacienta.
- **Sporočilo** — en zapis v pogovoru pacienta; pošiljatelj je `PACIENT`, `ZDRAVNIK` ali `ASISTENT`.
- **AI asistent** — tretji udeleženec pogovora (pošiljatelj `ASISTENT`). Odgovarja na vprašanja pacienta z dostopom do konteksta: knjižnica, meritve, merilni načrti z mejami in odprti alarmi tega pacienta. Ni zdravnik — odgovori so informativni, v nujnih primerih usmeri na 112 / zdravnika.
