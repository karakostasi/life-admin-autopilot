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

// Μόνο ο ίδιος identifier σε 2+ έγγραφα σχηματίζει ομάδα· τα υπόλοιπα μένουν μόνα τους
export function groupByPlate<T extends { identifier: string | null }>(items: T[]): { plate: string | null; items: T[] }[] {
  const byKey = new Map<string, T[]>();
  for (const i of items) {
    const key = plateKey(i.identifier);
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), i]);
  }
  const seen = new Set<string>();
  const out: { plate: string | null; items: T[] }[] = [];
  for (const i of items) {
    const key = plateKey(i.identifier);
    const members = key ? byKey.get(key)! : [i];
    if (key && members.length > 1) {
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ plate: i.identifier!.trim(), items: members });
    } else out.push({ plate: null, items: [i] });
  }
  return out;
}
