-- AlterTable
ALTER TABLE "LibraryEntry" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "LibraryEntry" ADD COLUMN "url" TEXT;

-- CreateTable
CREATE TABLE "ExerciseSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "condition" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "pdfUrl" TEXT,
    "sourceUrl" TEXT,
    "language" TEXT NOT NULL DEFAULT 'sl',
    "kind" TEXT NOT NULL DEFAULT 'exercise',
    "pages" INTEGER
);

-- CreateTable
CREATE TABLE "PatientExerciseSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "exerciseSetId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "acknowledgedDate" TEXT,
    CONSTRAINT "PatientExerciseSet_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PatientExerciseSet_exerciseSetId_fkey" FOREIGN KEY ("exerciseSetId") REFERENCES "ExerciseSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Standard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metricType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "thresholdL1" REAL,
    "thresholdL2" REAL,
    "thresholdL3" REAL,
    "thresholdLowL1" REAL,
    "thresholdLowL2" REAL,
    "thresholdLowL3" REAL,
    "greenZone" TEXT,
    "yellowZone" TEXT,
    "redZone" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Measurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "planId" TEXT,
    "type" TEXT NOT NULL,
    "value" REAL,
    "valueText" TEXT,
    "note" TEXT,
    "photoUrl" TEXT,
    "author" TEXT NOT NULL DEFAULT 'PACIENT',
    "severity" TEXT,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Measurement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Measurement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MeasurementPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Measurement" ("id", "note", "patientId", "photoUrl", "planId", "recordedAt", "type", "value") SELECT "id", "note", "patientId", "photoUrl", "planId", "recordedAt", "type", "value" FROM "Measurement";
DROP TABLE "Measurement";
ALTER TABLE "new_Measurement" RENAME TO "Measurement";
CREATE TABLE "new_MeasurementPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'NUMERIC',
    "thresholdL1" REAL,
    "thresholdL2" REAL,
    "thresholdL3" REAL,
    "thresholdLowL1" REAL,
    "thresholdLowL2" REAL,
    "thresholdLowL3" REAL,
    "baseline" TEXT,
    "baselineDate" DATETIME,
    "customized" BOOLEAN NOT NULL DEFAULT false,
    "greenZone" TEXT,
    "yellowZone" TEXT,
    "redZone" TEXT,
    CONSTRAINT "MeasurementPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MeasurementPlan" ("baseline", "baselineDate", "customized", "frequency", "greenZone", "id", "label", "patientId", "redZone", "thresholdL1", "thresholdL2", "thresholdL3", "thresholdLowL1", "thresholdLowL2", "thresholdLowL3", "type", "unit", "yellowZone") SELECT "baseline", "baselineDate", "customized", "frequency", "greenZone", "id", "label", "patientId", "redZone", "thresholdL1", "thresholdL2", "thresholdL3", "thresholdLowL1", "thresholdLowL2", "thresholdLowL3", "type", "unit", "yellowZone" FROM "MeasurementPlan";
DROP TABLE "MeasurementPlan";
ALTER TABLE "new_MeasurementPlan" RENAME TO "MeasurementPlan";
CREATE TABLE "new_Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AKTIVEN',
    "diagnosis" TEXT NOT NULL,
    "dischargeDate" DATETIME,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "zzzs" TEXT,
    "sideEffects" TEXT,
    "timeline" TEXT,
    "nutrition" TEXT,
    "exercises" TEXT,
    "generalRecommendations" TEXT,
    "equipment" TEXT,
    "warningSymptoms" TEXT,
    "alarmYellow" TEXT,
    "alarmRed" TEXT,
    "catalogSource" TEXT,
    "careCustomized" BOOLEAN NOT NULL DEFAULT false,
    "procedureDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Patient" ("contactName", "contactPhone", "createdAt", "diagnosis", "dischargeDate", "exercises", "id", "nutrition", "sideEffects", "status", "timeline", "userId", "zzzs") SELECT "contactName", "contactPhone", "createdAt", "diagnosis", "dischargeDate", "exercises", "id", "nutrition", "sideEffects", "status", "timeline", "userId", "zzzs" FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "new_Patient" RENAME TO "Patient";
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PatientExerciseSet_patientId_exerciseSetId_key" ON "PatientExerciseSet"("patientId", "exerciseSetId");

-- CreateIndex
CREATE UNIQUE INDEX "Standard_metricType_key" ON "Standard"("metricType");
