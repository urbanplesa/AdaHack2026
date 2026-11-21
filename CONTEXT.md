# CONTEXT.md — glosar domene (AdaHack2026)

Samo pojmi, brez implementacijskih podrobnosti (te so v `AGENTS.md`).

- **Pacient** — oseba po odpustu iz bolnišnice, ki doma vnaša meritve in klepeta. Ima račun z vlogo `PACIENT` in svoj profil pacienta.
- **Zdravnik** — uporabnik z vlogo `ZDRAVNIK`; spremlja paciente, pregleduje in potrjuje alarme, odgovarja v klepetu.
- **Meritev** — en vnos pacienta (tip, vrednost, enota prek merilnega načrta, opomba, morebitna slika rane).
- **Merilni načrt** — dogovorjena meritev s frekvenco, alarmnimi mejami (L1/L2/L3, zgornje in spodnje) ter barvnimi conami (zelena/rumena/rdeča).
- **Alarm** — sproženo opozorilo (L1/L2/L3, SOS, IZOSTANEK_VNOSA) z statusom ODPRT ali POTRJEN (s časom in potrditeljem).
- **Knjižnjica** — globalno znanje za paciente (kategorije MERITVE, PREHRANA, VAJE, POTEK_OKREVANJA); ni vezana na posameznega pacienta.
- **Sporočilo** — en zapis v pogovoru pacienta; pošiljatelj je `PACIENT`, `ZDRAVNIK` ali `ASISTENT`.
- **AI asistent** — tretji udeleženec pogovora (pošiljatelj `ASISTENT`). Odgovarja na vprašanja pacienta z dostopom do konteksta: knjižnica, meritve, merilni načrti z mejami in odprti alarmi tega pacienta. Ni zdravnik — odgovori so informativni, v nujnih primerih usmeri na 112 / zdravnika.
