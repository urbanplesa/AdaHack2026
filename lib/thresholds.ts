// Alarm logika: primerjava meritve z mejnimi vrednostmi plana.
// Podprte so zgornje (thresholdL1/L2/L3) IN spodnje (thresholdLowL1/L2/L3) meje.

export type PlanThresholds = {
  thresholdL1: number | null;
  thresholdL2: number | null;
  thresholdL3: number | null;
  thresholdLowL1: number | null;
  thresholdLowL2: number | null;
  thresholdLowL3: number | null;
};

export function evaluateThresholds(
  plan: PlanThresholds,
  value: number,
): { severity: "L1" | "L2" | "L3"; direction: "above" | "below" } | null {
  const upper: Array<[number | null, "L1" | "L2" | "L3"]> = [
    [plan.thresholdL3, "L3"],
    [plan.thresholdL2, "L2"],
    [plan.thresholdL1, "L1"],
  ];
  for (const [threshold, severity] of upper) {
    if (threshold != null && value >= threshold) return { severity, direction: "above" };
  }
  const lower: Array<[number | null, "L1" | "L2" | "L3"]> = [
    [plan.thresholdLowL3, "L3"],
    [plan.thresholdLowL2, "L2"],
    [plan.thresholdLowL1, "L1"],
  ];
  for (const [threshold, severity] of lower) {
    if (threshold != null && value <= threshold) return { severity, direction: "below" };
  }
  return null;
}

export function alertMessage(label: string, unit: string, value: number, severity: string, direction: "above" | "below") {
  const verb = direction === "above" ? "presega" : "je pod";
  return `Meritev ${label} = ${value} ${unit} ${verb} mejo ${severity}`;
}
