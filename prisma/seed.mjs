import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const prisma = new PrismaClient();
const here = dirname(fileURLToPath(import.meta.url));
// Izpeljano iz lib/catalog.ts (28 stanj + 25 PDF vodičev) — glej AGENTS.md
const seedCatalog = JSON.parse(readFileSync(join(here, "seed-catalog.json"), "utf8"));

const localDateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function main() {
  // Počistimo (vrstni red zaradi tujih ključev)
  await prisma.chatMessage.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.measurement.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.patientExerciseSet.deleteMany();
  await prisma.measurementPlan.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.libraryEntry.deleteMany();
  await prisma.exerciseSet.deleteMany();
  await prisma.standard.deleteMany();
  await prisma.user.deleteMany();

  const zdravnik = await prisma.user.create({
    data: {
      email: "zdravnik@test.si",
      password: "zdravnik123",
      name: "dr. Ana Kovač",
      role: "ZDRAVNIK",
    },
  });

  const pacientUser = await prisma.user.create({
    data: {
      email: "pacient@test.si",
      password: "pacient123",
      name: "Janez Novak",
      role: "PACIENT",
    },
  });

  // --- Sklopi vaj: 25 PDF vodičev fizioterapije SB Nova Gorica (lokalno v public/guides) ---
  for (const g of seedCatalog.guides) {
    await prisma.exerciseSet.create({
      data: {
        id: g.id,
        name: g.name,
        condition: g.condition ?? "",
        instructions: g.instructions ?? "",
        pdfUrl: g.pdfUrl,
        sourceUrl: g.sourceUrl,
        language: g.language ?? "sl",
        kind: g.kind ?? "exercise",
        pages: g.pages ?? null,
      },
    });
  }

  // --- Standardne meje bolnice (globalni standardi za tipe meritev) ---
  const standards = [
    { metricType: "KISIK", label: "Nasičenost krvi s kisikom (SpO2)", unit: "%", thresholdLowL1: 95, thresholdLowL2: 94, thresholdLowL3: 90, greenZone: "≥ 95 %", yellowZone: "94 %", redZone: "< 90 %" },
    { metricType: "TEMPERATURA", label: "Telesna temperatura", unit: "°C", thresholdL1: 37.5, thresholdL2: 37.5, thresholdL3: 38.5, greenZone: "36,0–37,4 °C", yellowZone: "37,5 °C", redZone: "≥ 38,5 °C" },
    { metricType: "BOLECINA", label: "Bolečina", unit: "/10", thresholdL1: 5, thresholdL2: 5, thresholdL3: 8, greenZone: "0–4", yellowZone: "5–7", redZone: "≥ 8" },
    { metricType: "UTRIP", label: "Srčni utrip", unit: "ut/min", thresholdL1: 100, thresholdL2: 110, thresholdL3: 140, greenZone: "60–100", yellowZone: "101–110", redZone: "> 140" },
    { metricType: "PRITISK", label: "Krvni pritisk (sistolični)", unit: "mmHg", thresholdL1: 140, thresholdL2: 160, thresholdL3: 180, greenZone: "< 140", yellowZone: "140–160", redZone: "> 180" },
    { metricType: "SLADKOR", label: "Sladkor v krvi", unit: "mmol/L", thresholdL1: 10, thresholdL2: 10, thresholdL3: 15, greenZone: "4–10", yellowZone: "10–15", redZone: "> 15" },
    { metricType: "TEZA", label: "Teža", unit: "kg", greenZone: "stabilna", yellowZone: "+2 kg/teden", redZone: "nenadna sprememba" },
  ];
  for (const s of standards) {
    await prisma.standard.create({ data: s });
  }

  // --- Demo pacient: stanje iz kataloga (Artroskopija kolena) ---
  const catalog = seedCatalog.conditions.find((c) => c.condition === "Artroskopija kolena");
  const dischargeDate = new Date("2026-11-10T00:00:00Z");
  const procedureDate = localDateKey(dischargeDate); // "2026-11-10"

  const patient = await prisma.patient.create({
    data: {
      userId: pacientUser.id,
      status: "AKTIVEN",
      diagnosis: catalog.condition,
      dischargeDate,
      procedureDate: dischargeDate,
      contactName: "Maja Novak",
      contactPhone: "040 123 456",
      zzzs: "1234567890",
      sideEffects: catalog.sideEffects,
      timeline: catalog.timeline,
      nutrition: catalog.nutrition,
      exercises: "",
      generalRecommendations: catalog.recommendations,
      equipment: catalog.equipment !== "-" ? catalog.equipment : "",
      warningSymptoms: catalog.warningSymptoms,
      alarmYellow: catalog.alarmYellow,
      alarmRed: catalog.alarmRed,
      catalogSource: catalog.source,
    },
  });

  // Merilni načrti iz kataloga (POCUTJE, BOLECINA, GIBLJIVOST, SLIKA_RANE)
  const plansByType = {};
  for (const p of catalog.plans) {
    const plan = await prisma.measurementPlan.create({
      data: {
        patientId: patient.id,
        type: p.type,
        label: p.label,
        unit: p.unit,
        kind: p.kind,
        frequency: p.frequency,
        yellowZone: p.yellowZone || null,
        redZone: p.redZone || null,
        thresholdL2: p.thresholdL2,
        thresholdL3: p.thresholdL3,
        thresholdLowL2: p.thresholdLowL2,
        thresholdLowL3: p.thresholdLowL3,
      },
    });
    plansByType[p.type] = plan;
  }

  // Dodatni načrti (utrip, pritisk, temperatura, kisik) s standardi bolnice
  const extraTypes = ["UTRIP", "PRITISK", "TEMPERATURA", "KISIK"];
  for (const type of extraTypes) {
    const std = standards.find((s) => s.metricType === type);
    const plan = await prisma.measurementPlan.create({
      data: {
        patientId: patient.id,
        type,
        label: std.label,
        unit: std.unit,
        kind: type === "PRITISK" ? "PRESSURE" : "NUMERIC",
        frequency: type === "UTRIP" || type === "BOLECINA" ? "2x na dan" : "1x na dan",
        thresholdL1: std.thresholdL1 ?? null,
        thresholdL2: std.thresholdL2 ?? null,
        thresholdL3: std.thresholdL3 ?? null,
        thresholdLowL1: std.thresholdLowL1 ?? null,
        thresholdLowL2: std.thresholdLowL2 ?? null,
        thresholdLowL3: std.thresholdLowL3 ?? null,
        greenZone: std.greenZone ?? null,
        yellowZone: std.yellowZone ?? null,
        redZone: std.redZone ?? null,
      },
    });
    plansByType[type] = plan;
  }

  // Dodeljeni sklopi vaj iz kataloga z izračunanim začetnim datumom (1-3 dni po posegu)
  const startOffsets = { "1. dan": [1, 1], "1-3 dni": [1, 3], "1-7 dni": [1, 7], "24-48h": [1, 2], "po porodu": [0, 0] };
  const [oy, om, od] = procedureDate.split("-").map(Number);
  const [o1, o2] = startOffsets[catalog.startGuidance] ?? [null, null];
  const startDate =
    catalog.startGuidance === "takoj"
      ? localDateKey(new Date())
      : o1 != null
        ? localDateKey(new Date(oy, om - 1, od + Math.floor((o1 + o2) / 2)))
        : "";
  for (const setId of catalog.exerciseSetIds) {
    await prisma.patientExerciseSet.create({
      data: { patientId: patient.id, exerciseSetId: setId, startDate },
    });
  }

  // --- Zgodovina meritev (zadnjih 10 dni) — podatki za demo grafov trenda ---
  async function addM(type, data) {
    return prisma.measurement.create({
      data: { patientId: patient.id, planId: plansByType[type]?.id ?? null, type, ...data },
    });
  }
  const day = (d, hm) => new Date(`2026-11-${d}T${hm}:00Z`);
  const d10 = (i) => String(12 + i).padStart(2, "0"); // 12..21 november 2026

  // Utrip 2x na dan; 21. 11. zjutraj skok na 132 (čez L2) → edini odprt alarm v seedu
  const utrip = [
    ["12", "08:00", 72], ["12", "18:00", 74], ["13", "08:00", 70], ["13", "18:00", 76],
    ["14", "08:00", 75], ["14", "18:00", 72], ["15", "08:00", 73], ["15", "18:00", 78],
    ["16", "08:00", 71], ["16", "18:00", 74], ["17", "08:00", 76], ["17", "18:00", 72],
    ["18", "08:00", 72], ["18", "18:00", 75], ["19", "08:00", 74], ["19", "18:00", 73],
    ["20", "08:00", 76], ["20", "18:00", 71], ["21", "07:30", 132], ["21", "18:00", 78],
  ];
  let sporocilna = null;
  for (const [d, hm, v] of utrip) {
    const m = await addM("UTRIP", {
      value: v,
      recordedAt: day(d, hm),
      ...(v === 132 ? { note: "Po hitri hoji po stopnicah, malo težko diham" } : {}),
    });
    if (v === 132) sporocilna = m;
  }

  // Bolečina 2x na dan — pada (izboljševanje)
  const bolecina = [4, 3, 3, 3, 4, 2, 3, 2, 2, 2, 3, 1, 2, 1, 2, 2, 1, 1, 2, 1];
  let bi = 0;
  for (let i = 0; i < 10; i++) {
    for (const hm of ["08:00", "18:00"]) {
      await addM("BOLECINA", { value: bolecina[bi++], recordedAt: day(d10(i), hm) });
    }
  }

  // Pritisk 1x na dan (value = sistolični, valueText "sys/dia")
  const pritiski = [[126, 84], [124, 82], [130, 86], [128, 84], [134, 88], [132, 86], [129, 84], [136, 90], [133, 87], [138, 90]];
  for (let i = 0; i < pritiski.length; i++) {
    const [sys, dia] = pritiski[i];
    await addM("PRITISK", { value: sys, valueText: `${sys}/${dia}`, recordedAt: day(d10(i), "08:00") });
  }

  // Temperatura 1x na dan (17. 11. rahla vročina 37,6 — zgodovina, brez alarma)
  const temperature = [36.6, 36.8, 37.0, 36.7, 36.9, 37.6, 37.1, 36.8, 37.0, 36.9];
  for (let i = 0; i < temperature.length; i++) {
    await addM("TEMPERATURA", { value: temperature[i], recordedAt: day(d10(i), "19:00") });
  }

  // Kisik 1x na dan (vse v mejah)
  const kisik = [98, 97, 98, 97, 98, 97, 99, 98, 97, 98];
  for (let i = 0; i < kisik.length; i++) {
    await addM("KISIK", { value: kisik[i], recordedAt: day(d10(i), "08:00") });
  }

  // Počutje (besedilo) na nekaj dni
  await addM("POCUTJE", { valueText: "Dobro, malo utrujen", recordedAt: day("12", "20:00") });
  await addM("POCUTJE", { valueText: "Normalno", recordedAt: day("15", "20:00") });
  await addM("POCUTJE", { valueText: "Dobro, malo bolečin v kolenu", recordedAt: day("18", "20:00") });
  await addM("POCUTJE", { valueText: "Po stopnicah težko diham", recordedAt: day("21", "08:00") });

  // Meritev čez mejo L2 → demo alarm
  await prisma.alert.create({
    data: {
      patientId: patient.id,
      measurementId: sporocilna.id,
      severity: "L2",
      status: "ODPRT",
      message: "Meritev Srčni utrip = 132 ut/min presega mejo L2",
    },
  });

  // Zdravila (mock zVem recepta)
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  await prisma.medication.create({
    data: {
      patientId: patient.id,
      name: "Ibuprofen",
      dosage: "400 mg",
      times: JSON.stringify(["08:00", "20:00"]),
      takenSlots: JSON.stringify([`${today} 08:00`]),
    },
  });
  await prisma.medication.create({
    data: {
      patientId: patient.id,
      name: "Omeprazol",
      dosage: "20 mg",
      times: JSON.stringify(["07:30"]),
    },
  });

  // Knjižnjica
  await prisma.libraryEntry.createMany({
    data: [
      {
        category: "MERITVE",
        title: "Kako pravilno izmerim srčni utrip",
        content:
          "Sedite 5 minut v miru, meritec položite na zapestje ali vratno žilo. Štejte utripe 60 sekund.",
      },
      {
        category: "POTEK_OKREVANJA",
        title: "Okviren potek okrevanja po artroskopiji kolena",
        content:
          "1. teden: počitek, led, dvig noge. 2.–3. teden: hoja s štakami, začetek vaj. 4.–6. teden: normalna hoja, krepitev.",
      },
      {
        category: "PREHRANA",
        title: "Priporočila za prehrano",
        content:
          "Povečajte vnos beljakovin (ribje, perutnina, stročnice) za celjenje tkiv. Pijte dovolj vode.",
      },
      {
        category: "VAJE",
        title: "Vaje za krepitev kolena",
        content:
          "3x na dan: izteg kolena 10 sekund (10 ponovitev), dvig iztegnjene noge leže (10 ponovitev).",
      },
    ],
  });

  // Začetni pogovor z AI asistentom (nadaljuje se prek /api/assistant)
  await prisma.chatMessage.createMany({
    data: [
      {
        patientId: patient.id,
        sender: "PACIENT",
        text: "Ali grem lahko že na 5 km sprehod?",
      },
      {
        patientId: patient.id,
        sender: "ASISTENT",
        text: "Po 2 tednih od operacije kolena priporočamo sprehode do 2 km. 5 km začnemo postopoma v 4. tednu, če ni otekline.",
      },
    ],
  });

  console.log("Seed končan:", {
    zdravnik: zdravnik.email,
    pacient: pacientUser.email,
    exerciseSets: seedCatalog.guides.length,
    standards: standards.length,
    catalogCondition: catalog.condition,
    exerciseStartDate: startDate,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
