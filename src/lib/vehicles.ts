// Ομαδοποίηση εγγράφων με βάση την πινακίδα (identifier). Καθαρές συναρτήσεις.

// Τα ελληνικά γράμματα των πινακίδων μοιάζουν με λατινικά: το AI μπορεί να γράψει οποιοδήποτε από τα δύο
const GREEK_TO_LATIN: Record<string, string> = {
  Α: "A", Β: "B", Ε: "E", Ζ: "Z", Η: "H", Ι: "I", Κ: "K", Μ: "M", Ν: "N", Ο: "O", Ρ: "P", Τ: "T", Υ: "Y", Χ: "X",
};

// "ινζ-852" = "INZ 852" = "ΙΝΖ852" = "ΙΝΖ 0852" (τα μηδενικά μπροστά στον αριθμό αγνοούνται)
export function plateKey(identifier: string | null | undefined): string | null {
  const key = (identifier ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[\s-]+/g, "")
    .replace(/[Α-Ω]/g, (c) => GREEK_TO_LATIN[c] ?? c)
    .replace(/\d+/g, (n) => n.replace(/^0+(?=\d)/, ""));
  return key || null;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Βγάζει την πινακίδα από τον τίτλο ("ΚΤΕΟ ΖΧΑ-1234" -> "ΚΤΕΟ"), για να μη φαίνεται δύο φορές
export function stripPlate(title: string, identifier: string | null | undefined): string {
  const plate = identifier?.trim();
  if (!plate) return title;
  const pattern = [...plate.replace(/[\s-]+/g, "")].map(escape).join("[\\s-]*");
  const stripped = title
    .replace(new RegExp(pattern, "i"), "")
    .replace(/\s*[-–·:]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped || title;
}

// Τύποι εγγράφων που ανήκουν σε όχημα (τα υπόλοιπα, π.χ. διαβατήριο, δεν συνδέονται με όχημα)
export const VEHICLE_TYPES = ["car_insurance", "motorcycle_insurance", "ktel_ktheo", "road_tax"] as const;
export const isVehicleType = (type: string) => (VEHICLE_TYPES as readonly string[]).includes(type);

export type Vehicle = { id: string; kind: "car" | "motorcycle"; plate: string; model: string | null };

export const vehicleKindForType = (type: string): Vehicle["kind"] => (type === "motorcycle_insurance" ? "motorcycle" : "car");

// "Yamaha Tracer 700" = "YAMAHA  tracer-700"
export function modelKey(model: string | null | undefined): string | null {
  const key = (model ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  return key || null;
}

// Υπάρχον όχημα για την πινακίδα που διαβάστηκε
export function findByPlate(vehicles: Vehicle[], plate: string | null | undefined): Vehicle | undefined {
  const key = plateKey(plate);
  return key ? vehicles.find((v) => plateKey(v.plate) === key) : undefined;
}

// Άλλη πινακίδα αλλά ίδιο μοντέλο: πιθανόν το ίδιο όχημα (π.χ. λάθος ανάγνωση). Μόνο πρόταση, ποτέ αυτόματη ένωση.
export function suggestSameVehicle(vehicles: Vehicle[], plate: string | null | undefined, model: string | null | undefined): Vehicle | undefined {
  const m = modelKey(model);
  if (!m || findByPlate(vehicles, plate)) return undefined;
  const matches = vehicles.filter((v) => modelKey(v.model) === m);
  return matches.length === 1 ? matches[0] : undefined; // αν είναι αμφίσημο (2 ίδια μοντέλα) δεν προτείνουμε τίποτα
}

// Ομαδοποίηση εγγράφων ανά όχημα: κάθε ομάδα με 2+ έγγραφα ενός οχήματος γίνεται μία κάρτα, τα υπόλοιπα μένουν μόνα
export function groupByVehicle<T extends { vehicle_id: string | null }>(items: T[]): { vehicleId: string | null; items: T[] }[] {
  const byVehicle = new Map<string, T[]>();
  for (const i of items) if (i.vehicle_id) byVehicle.set(i.vehicle_id, [...(byVehicle.get(i.vehicle_id) ?? []), i]);

  const seen = new Set<string>();
  const out: { vehicleId: string | null; items: T[] }[] = [];
  for (const i of items) {
    const members = i.vehicle_id ? byVehicle.get(i.vehicle_id)! : [i];
    if (i.vehicle_id && members.length > 1) {
      if (seen.has(i.vehicle_id)) continue;
      seen.add(i.vehicle_id);
      out.push({ vehicleId: i.vehicle_id, items: members });
    } else out.push({ vehicleId: null, items: [i] });
  }
  return out;
}
