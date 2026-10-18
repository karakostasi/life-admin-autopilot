/**
 * Μετράει την ακρίβεια του extractDocument πάνω σε πραγματικά δείγματα.
 *
 * Δομή του φακέλου /fixtures (ζευγάρια αρχείο + .expected.json):
 *   fixtures/ktheo-1.jpg
 *   fixtures/ktheo-1.expected.json
 *   fixtures/insurance-1.pdf
 *   fixtures/insurance-1.expected.json
 *   fixtures/email-renewal-1.txt
 *   fixtures/email-renewal-1.expected.json
 *
 * Παράδειγμα .expected.json:
 *   { "type": "ktel_ktheo", "expires_on": "2027-03-14", "identifier": "ΖΧΑ1234" }
 *
 * Εκτέλεση:  npx tsx scripts/eval-extraction.ts
 * ΣΗΜΑΝΤΙΚΟ: τα fixtures να είναι anonymized και ΕΞΩ από το git (βάλ' το στο .gitignore).
 */
import fs from "node:fs";
import path from "node:path";
import { extractDocument, type ExtractInput } from "../src/lib/extract";

const DIR = path.join(process.cwd(), "fixtures");
// Παύση ανάμεσα στις κλήσεις για να αποφεύγονται τα 429 στο free tier (EVAL_DELAY_MS=0 για paid)
const DELAY_MS = Number(process.env.EVAL_DELAY_MS ?? 5000);

function loadInput(file: string): ExtractInput | null {
  const ext = path.extname(file).toLowerCase();
  const buf = fs.readFileSync(file);
  if (ext === ".jpg" || ext === ".jpeg") return { kind: "image", mediaType: "image/jpeg", base64: buf.toString("base64") };
  if (ext === ".png") return { kind: "image", mediaType: "image/png", base64: buf.toString("base64") };
  if (ext === ".webp") return { kind: "image", mediaType: "image/webp", base64: buf.toString("base64") };
  if (ext === ".pdf") return { kind: "pdf", base64: buf.toString("base64") };
  if (ext === ".txt") return { kind: "text", text: buf.toString("utf8") };
  return null;
}

const norm = (s: string | null | undefined) => (s ?? "").replace(/[\s-]/g, "").toUpperCase();

async function main() {
  const files = fs
    .readdirSync(DIR)
    .filter((f) => !f.endsWith(".expected.json") && !f.startsWith("."))
    .sort();

  let total = 0;
  let failed = 0; // κλήσεις που απέτυχαν (όχι λάθος απάντηση): τα νούμερα παρακάτω ΔΕΝ είναι έγκυρα αν > 0
  let typeOk = 0;
  let dateOk = 0;
  let idOk = 0;
  let idTotal = 0;
  let needsReviewWhenWrong = 0;
  let wrongDates = 0;
  let confidentlyWrong = 0;

  for (const f of files) {
    const base = f.replace(path.extname(f), "");
    const expectedPath = path.join(DIR, `${base}.expected.json`);
    const input = loadInput(path.join(DIR, f));
    if (!input || !fs.existsSync(expectedPath)) continue;

    const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
    if (total > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
    const res = await extractDocument(input);
    total++;

    if (!res.ok) {
      failed++;
      console.log(`✗ ${f}: ${res.error}`);
      continue;
    }

    const d = res.data;
    const tOk = d.type === expected.type;
    const dOk = (d.expires_on ?? null) === (expected.expires_on ?? null);
    if (tOk) typeOk++;
    if (dOk) dateOk++;

    if (expected.identifier) {
      idTotal++;
      if (norm(d.identifier) === norm(expected.identifier)) idOk++;
    }

    if (!dOk) {
      wrongDates++;
      if (res.needsReview) needsReviewWhenWrong++;
      else confidentlyWrong++;
    }

    console.log(
      `${tOk && dOk ? "✓" : "✗"} ${f}  type=${d.type}${tOk ? "" : ` (expected ${expected.type})`}  ` +
        `date=${d.expires_on}${dOk ? "" : ` (expected ${expected.expires_on})`}  ` +
        `conf=${d.confidence.expires_on.toFixed(2)}${res.needsReview ? "  [needs review]" : ""}`
    );
  }

  const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}%` : "n/a");
  console.log("\n--- Αποτελέσματα ---");
  if (failed > 0) {
    console.log(`⚠ ${failed}/${total} κλήσεις ΑΠΕΤΥΧΑΝ. Το αποτέλεσμα δεν είναι έγκυρο.`);
    process.exitCode = 1;
  }
  console.log(`Δείγματα:            ${total}`);
  console.log(`Σωστός τύπος:        ${pct(typeOk, total)}`);
  console.log(`Σωστή ημερομηνία:    ${pct(dateOk, total)}`);
  console.log(`Σωστό identifier:    ${pct(idOk, idTotal)}`);
  console.log(`Λάθος ημερομηνίες που πιάστηκαν για review: ${needsReviewWhenWrong}/${wrongDates}`);
  console.log(`ΕΠΙΚΙΝΔΥΝΟ: λάθος ημερομηνία ΜΕ υψηλή βεβαιότητα: ${confidentlyWrong}`);
  console.log("\nΣτόχος MVP: >90% σωστή ημερομηνία και 0 'confidently wrong'.");
}

main();
