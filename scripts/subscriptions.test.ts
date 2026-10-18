import assert from "node:assert/strict";
import { test } from "node:test";
import { detectRecurring, merchantKey, parseAmount, parseDate, parseStatementCsv, type Transaction } from "../src/lib/subscriptions";

test("parseAmount: ελληνική και αγγλική μορφή", () => {
  assert.equal(parseAmount("1.234,56"), 1234.56);
  assert.equal(parseAmount("1,234.56"), 1234.56);
  assert.equal(parseAmount("-12,34"), -12.34);
  assert.equal(parseAmount("(9.99)"), -9.99);
  assert.equal(parseAmount("12,34 EUR"), 12.34);
  assert.equal(parseAmount("1.234"), 1234);
  assert.equal(parseAmount("abc"), null);
});

test("parseDate: dd/mm/yyyy, ISO, άκυρες", () => {
  assert.equal(parseDate("05/03/2026"), "2026-03-05");
  assert.equal(parseDate("5.3.26"), "2026-03-05");
  assert.equal(parseDate("2026-03-05"), "2026-03-05");
  assert.equal(parseDate("31/02/2026"), null);
  assert.equal(parseDate("κείμενο"), null);
});

test("merchantKey: αγνοεί αριθμούς, τόνους και θόρυβο", () => {
  assert.equal(merchantKey("ACME.COM 866-579"), "ACME COM");
  assert.equal(merchantKey("NETFLIX.COM 866-579"), "known:Netflix");
  assert.equal(merchantKey("ΑΓΟΡΑ POS Ηλεκτρονική Α.Ε. 123456"), "ΗΛΕΚΤΡΟΝΙΚΗ Α");
});

test("CSV ελληνικής τράπεζας: ; delimiter, κείμενο πριν τις επικεφαλίδες, χρέωση/πίστωση", () => {
  const csv = [
    "Κίνηση λογαριασμού;;;",
    "Ημερομηνία;Ημ/νία αξίας;Περιγραφή;Χρέωση;Πίστωση",
    "05/01/2026;05/01/2026;NETFLIX.COM;12,99;",
    "01/02/2026;01/02/2026;ΜΙΣΘΟΔΟΣΙΑ;;1.500,00",
    "05/02/2026;05/02/2026;NETFLIX.COM;12,99;",
    "05/03/2026;05/03/2026;NETFLIX.COM;12,99;",
  ].join("\n");
  const res = parseStatementCsv(csv);
  assert.ok(res.ok);
  assert.equal(res.transactions.length, 3); // η μισθοδοσία (πίστωση) δεν μετράει
  assert.equal(res.transactions[0].date, "2026-01-05");
});

test("CSV με μία στήλη ποσού: μόνο οι αρνητικές είναι χρεώσεις", () => {
  const csv = "Date,Description,Amount\n2026-01-05,SPOTIFY,-9.99\n2026-01-06,SALARY,1000\n";
  const res = parseStatementCsv(csv);
  assert.ok(res.ok);
  assert.deepEqual(res.transactions, [{ date: "2026-01-05", description: "SPOTIFY", amount: 9.99 }]);
});

test("CSV χωρίς γνωστές επικεφαλίδες", () => {
  const res = parseStatementCsv("a,b,c\n1,2,3\n");
  assert.deepEqual(res, { ok: false, error: "unrecognized" });
});

const tx = (date: string, description: string, amount: number): Transaction => ({ date, description, amount });

test("μηνιαία συνδρομή με 3 χρεώσεις", () => {
  const found = detectRecurring([
    tx("2026-01-05", "NETFLIX.COM 111", 12.99),
    tx("2026-02-05", "NETFLIX.COM 222", 12.99),
    tx("2026-03-05", "NETFLIX.COM 333", 12.99),
  ]);
  assert.equal(found.length, 1);
  assert.equal(found[0].period, "monthly");
  assert.equal(found[0].last_charged_on, "2026-03-05");
  assert.equal(found[0].occurrences, 3);
});

test("αύξηση τιμής μέσα σε 15% δεν σπάει την ανίχνευση", () => {
  const found = detectRecurring([
    tx("2026-01-05", "SPOTIFY", 9.99),
    tx("2026-02-05", "SPOTIFY", 9.99),
    tx("2026-03-05", "SPOTIFY", 10.99),
  ]);
  assert.equal(found.length, 1);
  assert.equal(found[0].amount, 10.99);
});

test("2 χρεώσεις με ίδιο ποσό αρκούν, με διαφορετικό ποσό όχι", () => {
  assert.equal(detectRecurring([tx("2026-01-05", "GYM", 30), tx("2026-02-04", "GYM", 30)]).length, 1);
  assert.equal(detectRecurring([tx("2026-01-05", "SUPERMARKET", 30), tx("2026-02-04", "SUPERMARKET", 33)]).length, 0);
});

test("ετήσια χρέωση", () => {
  const found = detectRecurring([tx("2025-03-10", "AMAZON PRIME", 49.9), tx("2026-03-10", "AMAZON PRIME", 49.9)]);
  assert.equal(found.length, 1);
  assert.equal(found[0].period, "yearly");
});

test("εβδομαδιαίες και τυχαίες αγορές δεν είναι συνδρομές", () => {
  const found = detectRecurring([
    tx("2026-01-02", "COFFEE SHOP", 3.5),
    tx("2026-01-09", "COFFEE SHOP", 3.5),
    tx("2026-01-16", "COFFEE SHOP", 3.5),
    tx("2026-01-12", "SUPERMARKET", 54.2),
    tx("2026-02-27", "SUPERMARKET", 80),
  ]);
  assert.equal(found.length, 0);
});

test("ταξινόμηση κατά ποσό", () => {
  const found = detectRecurring([
    tx("2026-01-05", "A SERVICE", 5),
    tx("2026-02-05", "A SERVICE", 5),
    tx("2026-01-06", "B SERVICE", 20),
    tx("2026-02-06", "B SERVICE", 20),
  ]);
  assert.deepEqual(found.map((f) => f.amount), [20, 5]);
});

test("γνωστές υπηρεσίες: ενιαίο όνομα παρά τις παραλλαγές της περιγραφής", () => {
  const found = detectRecurring([
    tx("2026-01-05", "GOOGLE *YouTube Premium g.co/helppay#", 11.99),
    tx("2026-02-05", "GOOGLE YOUTUBEPREMIUM", 11.99),
    tx("2026-03-05", "GOOGLE *YouTubePremium", 11.99),
  ]);
  assert.equal(found.length, 1);
  assert.equal(found[0].merchant, "YouTube Premium");
  assert.equal(found[0].occurrences, 3);
});

test("γνωστή υπηρεσία: 2 χρεώσεις αρκούν ακόμα κι αν αλλάζει το ποσό", () => {
  const found = detectRecurring([tx("2026-01-05", "SPOTIFY P3A1B2", 9.99), tx("2026-02-04", "SPOTIFY P9Z8Y7", 10.99)]);
  assert.equal(found.length, 1);
  assert.equal(found[0].merchant, "Spotify");
});

test("άγνωστο merchant με 2 χρεώσεις και διαφορετικό ποσό παραμένει εκτός", () => {
  assert.equal(detectRecurring([tx("2026-01-05", "ΤΑΒΕΡΝΑ ΝΙΚΟΣ", 30), tx("2026-02-04", "ΤΑΒΕΡΝΑ ΝΙΚΟΣ", 33)]).length, 0);
});

test("Apple: δύο συνδρομές με διαφορετικό ποσό βγαίνουν χωριστά", () => {
  const found = detectRecurring([
    tx("2026-01-03", "APPLE.COM/BILL", 2.99),
    tx("2026-02-03", "APPLE.COM/BILL", 2.99),
    tx("2026-03-03", "APPLE.COM/BILL", 2.99),
    tx("2026-01-10", "APPLE.COM/BILL", 9.99),
    tx("2026-02-10", "APPLE.COM/BILL", 9.99),
    tx("2026-03-10", "APPLE.COM/BILL", 9.99),
  ]);
  assert.deepEqual(found.map((f) => f.amount), [9.99, 2.99]);
});
