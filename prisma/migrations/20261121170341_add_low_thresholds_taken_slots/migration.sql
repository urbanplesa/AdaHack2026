/*
  Warnings:

  - You are about to drop the column `takenAt` on the `Medication` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MeasurementPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
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
INSERT INTO "new_MeasurementPlan" ("frequency", "id", "label", "patientId", "thresholdL1", "thresholdL2", "thresholdL3", "type", "unit") SELECT "frequency", "id", "label", "patientId", "thresholdL1", "thresholdL2", "thresholdL3", "type", "unit" FROM "MeasurementPlan";
DROP TABLE "MeasurementPlan";
ALTER TABLE "new_MeasurementPlan" RENAME TO "MeasurementPlan";
CREATE TABLE "new_Medication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "times" TEXT NOT NULL,
    "duration" TEXT,
    "note" TEXT,
    "takenSlots" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "Medication_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Medication" ("dosage", "id", "name", "patientId", "times") SELECT "dosage", "id", "name", "patientId", "times" FROM "Medication";
DROP TABLE "Medication";
ALTER TABLE "new_Medication" RENAME TO "Medication";
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Patient" ("contactName", "contactPhone", "createdAt", "diagnosis", "dischargeDate", "id", "status", "userId") SELECT "contactName", "contactPhone", "createdAt", "diagnosis", "dischargeDate", "id", "status", "userId" FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "new_Patient" RENAME TO "Patient";
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
