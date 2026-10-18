# Project: Life Admin Autopilot (MVP)

Εφαρμογή που συγκεντρώνει όλες τις λήξεις και τις επαναλαμβανόμενες υποχρεώσεις του χρήστη
(ΚΤΕΟ, ασφάλειες, συνδρομές, διαβατήριο, εγγυήσεις) και τον ειδοποιεί έγκαιρα.
Το AI διαβάζει φωτογραφίες, PDF και forwarded emails και βγάζει δομημένα δεδομένα.

Αγορά MVP: Ελλάδα. UI στα ελληνικά (με i18n από την αρχή, ώστε να προστεθούν άλλες γλώσσες).

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind, σαν PWA (installable, web push)
- **Backend/DB/Auth/Storage:** Supabase, **region EU (Frankfurt)** για GDPR
- **AI:** Anthropic API με vision, structured output μέσω tool use (model: `claude-sonnet-5-5`, έλεγξε τα docs για το τρέχον model string)
- **Email out:** Resend
- **Email in (forwarding):** Postmark Inbound ή Cloudflare Email Routing -> webhook `/api/inbound-email`
- **Scheduler υπενθυμίσεων:** Supabase `pg_cron` + Edge Function

## Κανόνες (σημαντικό)

1. **Ιδιωτικότητα πρώτα.** Τα έγγραφα είναι ευαίσθητα δεδομένα.
   - Κάθε πίνακας έχει RLS. Ποτέ query με service role από το client.
   - Ποτέ μη κάνεις log περιεχόμενο εγγράφων, αριθμούς ταυτότητας ή IBAN.
   - Τα αρχεία αποθηκεύονται σε private bucket, πρόσβαση μόνο με signed URLs.
   - Ο χρήστης μπορεί να διαγράψει τα πάντα (account + αρχεία) με ένα κουμπί.
2. **Human-in-the-loop.** Το AI δεν αποθηκεύει τίποτα σιωπηλά. Μετά την εξαγωγή,
   ο χρήστης βλέπει τα πεδία και επιβεβαιώνει/διορθώνει. Πεδία με χαμηλό confidence επισημαίνονται.
3. **Τα leads (προσφορές ασφάλειας) στέλνονται μόνο με ρητή συναίνεση**
   που καταγράφεται (`leads.consent_at`) και με σαφές κείμενο για το ποιος θα λάβει τα στοιχεία.
4. **Απλότητα.** Όχι premature abstraction. Όχι microservices. Ένα repo, ένα deploy.
5. Όλες οι ημερομηνίες σε `date` (ISO). Ο χρήστης βλέπει ελληνική μορφή (dd/mm/yyyy).
6. Κάθε AI κλήση έχει timeout, retry και fallback ("συμπλήρωσε χειροκίνητα").

## Domain model (βλ. `schema.sql`)

`documents` (λήξεις), `reminders`, `subscriptions` (ανιχνευμένες από statement), `leads`.

Τύποι εγγράφων (`documents.type`): `car_insurance`, `ktel_ktheo` (ΚΤΕΟ), `road_tax`, `passport`,
`id_card`, `driving_license`, `home_insurance`, `health_insurance`, `warranty`, `contract`, `other`.

## AI extraction

Μία συνάρτηση `extractDocument(input)` όπου input = εικόνα | PDF | κείμενο email.
Χρησιμοποίησε tool use με αυστηρό JSON schema. Πεδία εξόδου:

```
{
  "type": enum (βλ. παραπάνω),
  "title": string,                 // π.χ. "Ασφάλεια ΙΧ - Interamerican"
  "provider": string | null,
  "identifier": string | null,     // π.χ. πινακίδα
  "expires_on": "YYYY-MM-DD" | null,
  "amount": number | null,
  "currency": "EUR" | ...,
  "recurrence": "none" | "monthly" | "yearly",
  "confidence": { "expires_on": 0-1, "type": 0-1, "amount": 0-1 },
  "notes": string | null
}
```

System prompt (βασικές οδηγίες): διάβασε ελληνικά και αγγλικά έγγραφα· αν η ημερομηνία
είναι ασαφής, επέστρεψε `null` και χαμηλό confidence, ΜΗΝ μαντεύεις· οι ελληνικές
ημερομηνίες είναι dd/mm/yyyy· διάκρινε ημερομηνία έκδοσης από ημερομηνία λήξης.

Γράψε tests με πραγματικά δείγματα (anonymized) στο `/fixtures`. Το extraction είναι ο πυρήνας του προϊόντος.

## Σειρά υλοποίησης

1. Setup: Next.js + Supabase (EU) + auth (magic link) + εφαρμογή του `schema.sql`
2. Upload εγγράφου -> `extractDocument` -> οθόνη επιβεβαίωσης -> αποθήκευση
3. Οθόνη "Τι λήγει;" (χρονολόγιο, ομαδοποίηση: λήγει σύντομα / αργότερα / ληγμένα)
4. Υπενθυμίσεις: 60/30/7 μέρες πριν, email (Resend) + web push, μέσω pg_cron
5. Inbound email: forwarding σε μοναδική διεύθυνση ανά χρήστη (`<token>@in.domain.gr`)
6. Ανιχνευτής συνδρομών: upload CSV/PDF statement -> εντοπισμός επαναλαμβανόμενων χρεώσεων
7. Κουμπί "Βρες μου καλύτερη τιμή" -> φόρμα συναίνεσης -> εγγραφή στο `leads` + email στον συνεργάτη
8. Landing page, privacy policy, analytics (privacy-friendly, π.χ. Plausible/PostHog EU)

## Μετρικές επιτυχίας MVP

- >50% των χρηστών προσθέτουν 3+ έγγραφα την πρώτη μέρα
- 50% επιστρέφουν μέσα σε 30 μέρες
- >=10% πατούν "Βρες μου καλύτερη τιμή"

Γι' αυτό: καταγραφή events `document_added`, `reminder_opened`, `lead_clicked`.

## Εκκρεμότητες (πριν το launch)

- [ ] **Eval με πραγματικά δείγματα.** Το "λάθος ημερομηνία με υψηλή βεβαιότητα" έχει μετρηθεί μόνο σε 8 συνθετικά email.
  Μάζεψε 15-20 θολωμένα δείγματα (ΚΤΕΟ, ασφαλιστήρια, διαβατήριο, ταυτότητα, τέλη κυκλοφορίας, email συνδρομής) στο `fixtures/`
  με `.expected.json`, τρέξε `npm run eval` και ξανά με `EXTRACTION_PROVIDER=anthropic`. Στόχος: >90% σωστή ημερομηνία και 0 "confidently wrong".
  Αν δεν βγει 0, βελτίωσε prompt και thresholds πριν προχωρήσεις.
- [ ] **Ιδιωτικότητα AI.** Το δωρεάν Gemini μπορεί να χρησιμοποιεί τα δεδομένα για εκπαίδευση: μόνο συνθετικά/θολωμένα έγγραφα. Πριν έρθουν πραγματικοί χρήστες: paid tier ή `EXTRACTION_PROVIDER=anthropic`.
- [ ] Region Supabase: το project είναι `eu-west-1` (Ιρλανδία), όχι Frankfurt. Αποδεκτό (ΕΕ), αλλά ενημέρωσε το Stack αν μείνει έτσι.
- [ ] `supabase db push` κολλάει (IPv6). Οι migrations εφαρμόστηκαν χειροκίνητα από το SQL Editor: τρέξε `migration repair` όταν διορθωθεί.

## Εντολές

(συμπλήρωσε μετά το setup: dev, test, lint, db migrate)
