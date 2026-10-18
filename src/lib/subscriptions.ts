// Ανίχνευση επαναλαμβανόμενων χρεώσεων από statement (CSV ή συναλλαγές που βγήκαν από PDF).
// Καθαρές συναρτήσεις, χωρίς I/O και χωρίς logging: τα statements είναι ευαίσθητα δεδομένα.

export type Transaction = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // θετικό = χρέωση
};

export type SubscriptionCandidate = {
  merchant: string;
  amount: number;
  period: "monthly" | "yearly";
  last_charged_on: string;
  occurrences: number;
};

// ---------- CSV ----------

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

function detectDelimiter(firstLine: string): string {
  const count = (d: string) => firstLine.split(d).length - 1;
  return [";", "\t", ","].reduce((best, d) => (count(d) > count(best) ? d : best), ",");
}

// "1.234,56" | "1,234.56" | "-12,34" | "(12.34)" | "12,34 EUR" | "12,34-"
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[\s ]/g, "").replace(/[−–]/g, "-");
  if (!/\d/.test(s)) return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-") || s.endsWith("-");
  let digits = s.replace(/[^\d.,]/g, "");
  const lastDot = digits.lastIndexOf(".");
  const lastComma = digits.lastIndexOf(",");
  const sep = Math.max(lastDot, lastComma);
  if (sep >= 0) {
    const decimals = digits.length - sep - 1;
    const other = lastDot > lastComma ? "," : ".";
    const hasBoth = digits.includes(".") && digits.includes(",");
    const single = digits.split(digits[sep]).length === 2;
    if (hasBoth || (single && decimals !== 3)) {
      digits = digits.slice(0, sep).replaceAll(other, "").replaceAll(digits[sep], "") + "." + digits.slice(sep + 1);
    } else {
      digits = digits.replace(/[.,]/g, ""); // διαχωριστικό χιλιάδων
    }
  }
  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

// dd/mm/yyyy | dd-mm-yyyy | dd.mm.yyyy | dd/mm/yy | yyyy-mm-dd -> ISO
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})/))) {
    d = Number(match[1]);
    m = Number(match[2]);
    y = Number(match[3]);
    if (match[3].length === 2) y += 2000;
  } else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

const HEADERS = {
  date: ["ημερομηνια", "ημ/νια", "date", "booking", "ημερ"],
  description: ["περιγραφη", "αιτιολογια", "description", "details", "merchant", "επωνυμια", "στοιχεια", "κινηση", "narrative"],
  amount: ["ποσο", "amount", "αξια"],
  debit: ["χρεωση", "debit"],
  credit: ["πιστωση", "credit"],
};

function findColumn(headers: string[], names: string[], avoid: string[] = []): number {
  const preferred = headers.findIndex((h) => names.some((n) => h.includes(n)) && !avoid.some((a) => h.includes(a)));
  return preferred >= 0 ? preferred : headers.findIndex((h) => names.some((n) => h.includes(n)));
}

export type CsvResult = { ok: true; transactions: Transaction[] } | { ok: false; error: "unrecognized" | "empty" };

export function parseStatementCsv(text: string): CsvResult {
  const clean = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(clean.split(/\r?\n/).find((l) => l.trim()) ?? "");
  const rows = parseCsvRows(clean, delimiter);

  // γραμμή επικεφαλίδων: τα Ελληνικά statements έχουν συχνά κείμενο πριν από τον πίνακα
  for (let h = 0; h < Math.min(rows.length, 30); h++) {
    const headers = rows[h].map((c) => stripAccents(c.trim().toLowerCase()));
    const dateCol = findColumn(headers, HEADERS.date, ["αξιας", "value"]);
    const descCol = findColumn(headers, HEADERS.description);
    const amountCol = findColumn(headers, HEADERS.amount);
    const debitCol = findColumn(headers, HEADERS.debit);
    if (dateCol < 0 || descCol < 0 || (amountCol < 0 && debitCol < 0)) continue;

    const parsed: { date: string; description: string; value: number }[] = [];
    for (const r of rows.slice(h + 1)) {
      const date = parseDate(r[dateCol] ?? "");
      const description = (r[descCol] ?? "").trim();
      if (!date || !description) continue;
      const value = debitCol >= 0 ? parseAmount(r[debitCol] ?? "") : parseAmount(r[amountCol] ?? "");
      if (value === null || value === 0) continue;
      parsed.push({ date, description, value });
    }
    if (parsed.length === 0) return { ok: false, error: "empty" };

    // στήλη χρέωσης: οι τιμές είναι ήδη χρεώσεις. Μία στήλη ποσού: οι αρνητικές είναι χρεώσεις
    // (αν δεν υπάρχει καμία αρνητική, θεωρούμε ότι όλες είναι χρεώσεις)
    const hasNegative = parsed.some((p) => p.value < 0);
    const charges = parsed
      .filter((p) => debitCol >= 0 || !hasNegative || p.value < 0)
      .map((p) => ({ date: p.date, description: p.description, amount: Math.abs(p.value) }));
    return charges.length ? { ok: true, transactions: charges } : { ok: false, error: "empty" };
  }
  return { ok: false, error: "unrecognized" };
}

// ---------- Ανίχνευση ----------

const NOISE = new Set(["POS", "CARD", "ΚΑΡΤΑ", "ΑΓΟΡΑ", "PURCHASE", "PAYMENT", "ΠΛΗΡΩΜΗ", "DEBIT", "SEPA", "DD", "VISA", "MASTERCARD", "TRANSACTION"]);

function tokens(description: string): string[] {
  return stripAccents(description.toUpperCase())
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((t) => t && !/\d/.test(t) && !NOISE.has(t));
}

// Γνωστές υπηρεσίες: ένα όνομα για όλες τις παραλλαγές της περιγραφής ("GOOGLE *YouTube Premium",
// "GOOGLE YOUTUBEPREMIUM") και πιο χαλαρά κριτήρια (2 χρεώσεις αρκούν). Έλεγχος πάνω σε συμπιεσμένο κείμενο.
const KNOWN_SERVICES: { name: string; pattern: RegExp }[] = [
  { name: "Netflix", pattern: /NETFLIX/ },
  { name: "YouTube Premium", pattern: /YOUTUBE/ },
  { name: "Spotify", pattern: /SPOTIFY/ },
  { name: "Disney+", pattern: /DISNEY/ },
  { name: "HBO Max", pattern: /HBOMAX/ },
  { name: "Amazon Prime", pattern: /AMAZONPRIME|PRIMEVIDEO|AMZNPRIME/ },
  { name: "Apple (iCloud / App Store)", pattern: /APPLECOM|ITUNES|ICLOUD/ },
  { name: "Google One", pattern: /GOOGLEONE|GOOGLESTORAGE/ },
  { name: "Microsoft 365", pattern: /MICROSOFT365|OFFICE365|MSFT365/ },
  { name: "Adobe", pattern: /ADOBE/ },
  { name: "ChatGPT", pattern: /OPENAI|CHATGPT/ },
  { name: "Claude", pattern: /ANTHROPIC|CLAUDEAI/ },
  { name: "Dropbox", pattern: /DROPBOX/ },
];

function findService(description: string) {
  const compact = stripAccents(description.toUpperCase()).replace(/[^\p{L}\p{N}]+/gu, "");
  return KNOWN_SERVICES.find((s) => s.pattern.test(compact));
}

export function knownService(description: string): string | null {
  return findService(description)?.name ?? null;
}

// Κλειδί συνεταιρισμού: γνωστή υπηρεσία, αλλιώς οι δύο πρώτες "ουσιαστικές" λέξεις
// ("NETFLIX.COM 866-5793" -> "NETFLIX COM")
export function merchantKey(description: string): string {
  const known = knownService(description);
  return known ? `known:${known}` : tokens(description).slice(0, 2).join(" ");
}

function displayName(description: string): string {
  const known = knownService(description);
  if (known) return known;
  const name = description
    .split(/\s+/)
    .filter((t) => !/\d{4,}/.test(t))
    .join(" ")
    .trim();
  return (name || description).slice(0, 60);
}

const DAY = 86_400_000;
const dayNumber = (iso: string) => Math.round(Date.parse(iso + "T00:00:00Z") / DAY);
const PERIODS = { monthly: [26, 35], yearly: [350, 380] } as const;

// Βρίσκει συνδρομή μέσα σε ένα σύνολο χρεώσεων του ίδιου merchant, ξεκινώντας από την πιο πρόσφατη.
// Επιστρέφει και τις χρεώσεις που "χρησιμοποιήθηκαν", ώστε να ψάξουμε για άλλη συνδρομή στο ίδιο merchant.
function detectCluster(sorted: Transaction[], known: boolean): { found: SubscriptionCandidate | null; used: Transaction[] } {
  const latest = sorted[sorted.length - 1];
  // μόνο χρεώσεις με παρόμοιο ποσό με την τελευταία (ανεκτικό σε αυξήσεις τιμής), μία ανά ημέρα
  const similar = sorted.filter(
    (t, i) => Math.abs(t.amount - latest.amount) <= 0.15 * latest.amount && sorted.findIndex((s) => s.date === t.date) === i,
  );
  if (similar.length < 2) return { found: null, used: [latest] };

  const gaps = similar.slice(1).map((t, i) => dayNumber(t.date) - dayNumber(similar[i].date));
  for (const period of ["monthly", "yearly"] as const) {
    const [min, max] = PERIODS[period];
    const inRange = gaps.filter((g) => g >= min && g <= max).length;
    if (inRange / gaps.length < 0.75) continue;
    // 2 χρεώσεις αρκούν για γνωστή υπηρεσία, για ίδιο ποσό στο λεπτό, ή για ετήσια
    const identical = similar.every((t) => t.amount === latest.amount);
    if (period === "monthly" && similar.length < 3 && !identical && !known) continue;
    return {
      found: {
        merchant: displayName(latest.description),
        amount: latest.amount,
        period,
        last_charged_on: latest.date,
        occurrences: similar.length,
      },
      used: similar,
    };
  }
  return { found: null, used: [latest] };
}

export function detectRecurring(transactions: Transaction[]): SubscriptionCandidate[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = merchantKey(t.description);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const found: SubscriptionCandidate[] = [];
  for (const [key, group] of groups) {
    // ένα merchant μπορεί να έχει πολλές συνδρομές με διαφορετικό ποσό (π.χ. Apple, Google)
    let remaining = [...group].sort((a, b) => a.date.localeCompare(b.date));
    while (remaining.length >= 2) {
      const { found: candidate, used } = detectCluster(remaining, key.startsWith("known:"));
      if (candidate) found.push(candidate);
      remaining = remaining.filter((t) => !used.includes(t));
    }
  }
  return found.sort((a, b) => b.amount - a.amount);
}

// Ποσό ανά μήνα (για το σύνολο)
export function monthlyEquivalent(amount: number, period: "monthly" | "yearly" | "none"): number {
  return period === "yearly" ? amount / 12 : amount;
}
