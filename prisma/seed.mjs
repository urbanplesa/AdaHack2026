import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Počistimo (vrstni red zaradi tujih ključev)
  await prisma.chatMessage.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.measurement.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.measurementPlan.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.libraryEntry.deleteMany();
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

  const patient = await prisma.patient.create({
    data: {
      userId: pacientUser.id,
      status: "AKTIVEN",
      diagnosis: "Operacija kolena (artroskopija)",
      dischargeDate: new Date("2026-11-10T00:00:00Z"),
      contactName: "Maja Novak",
      contactPhone: "040 123 456",
    },
  });

  const planUtrip = await prisma.measurementPlan.create({
    data: {
      patientId: patient.id,
      type: "UTRIP",
      label: "Srčni utrip",
      unit: "ut/min",
      frequency: "2x na dan",
      thresholdL1: 100,
      thresholdL2: 120,
      thresholdL3: 140,
    },
  });

  await prisma.measurementPlan.create({
    data: {
      patientId: patient.id,
      type: "PRITISK",
      label: "Krvni pritisk (sistolični)",
      unit: "mmHg",
      frequency: "1x na dan",
      thresholdL1: 140,
      thresholdL2: 160,
      thresholdL3: 180,
    },
  });

  await prisma.measurementPlan.create({
    data: {
      patientId: patient.id,
      type: "TEMPERATURA",
      label: "Telesna temperatura",
      unit: "°C",
      frequency: "1x na dan",
      thresholdL1: 37.5,
      thresholdL2: 38.5,
      thresholdL3: 39.5,
    },
  });

  await prisma.measurementPlan.create({
    data: {
      patientId: patient.id,
      type: "BOLECINA",
      label: "Bolečina (lestvica 0–10)",
      unit: "/10",
      frequency: "2x na dan",
      thresholdL1: 5,
      thresholdL2: 7,
      thresholdL3: 9,
    },
  });

  await prisma.measurementPlan.create({
    data: {
      patientId: patient.id,
      type: "KISIK",
      label: "Nasičenost krvi s kisikom (SpO2)",
      unit: "%",
      frequency: "1x na dan",
      // Spodnje meje: alarm če je SpO2 POD tem pragom
      thresholdLowL1: 95,
      thresholdLowL2: 92,
      thresholdLowL3: 90,
    },
  });

  await prisma.measurementPlan.create({
    data: {
      patientId: patient.id,
      type: "SLIKA_RANE",
      label: "Slika rane / šiva",
      unit: "",
      frequency: "1x na 2 dni",
    },
  });

  // Normalne meritve
  await prisma.measurement.create({
    data: {
      patientId: patient.id,
      planId: planUtrip.id,
      type: "UTRIP",
      value: 72,
      recordedAt: new Date("2026-11-20T08:00:00Z"),
    },
  });

  // Meritve čez mejo L2 → sproži demo alarm
  const sporocilna = await prisma.measurement.create({
    data: {
      patientId: patient.id,
      planId: planUtrip.id,
      type: "UTRIP",
      value: 132,
      note: "Po hitri hoji po stopnicah, malo težko diham",
      recordedAt: new Date("2026-11-21T07:30:00Z"),
    },
  });

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
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
