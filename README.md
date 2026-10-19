# Θύμισέ μου

Εφαρμογή που συγκεντρώνει όλες τις λήξεις και τις επαναλαμβανόμενες υποχρεώσεις σου (ΚΤΕΟ, ασφάλειες, τέλη κυκλοφορίας, διαβατήριο, ταυτότητα, εγγυήσεις, συνδρομές) και σε ειδοποιεί έγκαιρα.

Φωτογραφίζεις ή ανεβάζεις ένα έγγραφο, το AI διαβάζει τον τύπο, τον πάροχο και την ημερομηνία λήξης, εσύ τα επιβεβαιώνεις, και η εφαρμογή σου στέλνει υπενθύμιση 60, 30 και 7 μέρες πριν.

Αγορά MVP: Ελλάδα. Το UI είναι στα ελληνικά, με τα κείμενα σε ξεχωριστό αρχείο ώστε να προστεθούν άλλες γλώσσες.

## Τι κάνει σήμερα

- **Σύνδεση χωρίς κωδικό** με magic link στο email.
- **Upload εγγράφου** (JPG, PNG, WebP ή PDF έως 4MB). Το AI εξάγει τα στοιχεία και τα δείχνει σε οθόνη επιβεβαίωσης. **Τίποτα δεν αποθηκεύεται πριν το επιβεβαιώσεις.** Τα πεδία με χαμηλό confidence επισημαίνονται, και αν η εξαγωγή αποτύχει συμπληρώνεις χειροκίνητα.
- **Οθόνη "Τι λήγει;"** με χρώματα: κόκκινο (έληξε), πορτοκαλί (λήγει σε 60 μέρες ή λιγότερες), πράσινο (σε ισχύ).
- **Υπενθυμίσεις με email** 60/30/7 μέρες πριν τη λήξη, αυτόματα για κάθε έγγραφο.
- **Διαγραφή** εγγράφου μαζί με το αρχείο του.
- **Landing page** με λίστα αναμονής.

## Τι έρχεται

Βλ. τη σειρά υλοποίησης στο [CLAUDE.md](CLAUDE.md): web push, inbound email (προώθηση email σε μοναδική διεύθυνση ανά χρήστη), ανιχνευτής συνδρομών από statement, κουμπί "Βρες μου καλύτερη τιμή" με ρητή συναίνεση.

## Stack

| Τμήμα | Τεχνολογία |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind |
| Βάση, auth, αρχεία | Supabase (Postgres με RLS, Auth, private Storage) |
| AI εξαγωγή | Gemini (δωρεάν, για ανάπτυξη) ή Anthropic Claude, επιλογή με env variable |
| Email | Resend |
| Υπενθυμίσεις | Supabase `pg_cron` και Edge Function |

## Πώς δουλεύει η εξαγωγή

Η συνάρτηση `extractDocument(input)` στο [src/lib/extract.ts](src/lib/extract.ts) δέχεται εικόνα, PDF ή κείμενο email και επιστρέφει δομημένα δεδομένα (τύπος, τίτλος, πάροχος, αναγνωριστικό, ημερομηνία λήξης, ποσό, επανάληψη, confidence ανά πεδίο).

- Το prompt και το schema είναι κοινά για όλους τους providers. Αλλάζει μόνο η κλήση.
- Ο provider επιλέγεται με `EXTRACTION_PROVIDER=gemini|anthropic`.
- Μετά το AI τρέχει αμυντικός έλεγχος (`sanityCheck`): ημερομηνίες εκτός λογικού εύρους ή με χαμηλό confidence σημαδεύονται για review (`needsReview`, `reviewReasons`).
- Κάθε κλήση έχει timeout, retry και fallback σε χειροκίνητη συμπλήρωση.

Το σημαντικότερο μέγεθος ποιότητας είναι το **"λάθος ημερομηνία με υψηλή βεβαιότητα"**, που πρέπει να είναι 0. Μετριέται με:

```bash
npm run eval
```

Το script διαβάζει ζεύγη `αρχείο` και `.expected.json` από το `fixtures/`. Ο φάκελος είναι εκτός git, γιατί τα δείγματα είναι ευαίσθητα.

## Ιδιωτικότητα

- Κάθε πίνακας έχει Row Level Security: ο χρήστης βλέπει μόνο τα δικά του δεδομένα.
- Τα αρχεία μένουν σε private bucket και ανοίγουν μόνο με signed URLs που λήγουν.
- Δεν γίνεται log περιεχόμενο εγγράφων, αριθμοί ταυτότητας, IBAN ή email.
- Ο χρήστης μπορεί να διαγράψει τα έγγραφά του.
- **Προσοχή:** το δωρεάν tier του Gemini μπορεί να χρησιμοποιεί τα δεδομένα για εκπαίδευση. Σε αυτό βάζουμε μόνο συνθετικά ή θολωμένα έγγραφα. Για πραγματικούς χρήστες χρησιμοποίησε paid tier ή `EXTRACTION_PROVIDER=anthropic`.

## Τοπική εκτέλεση

Απαιτείται Node 20 ή νεότερο και ένα Supabase project.

```bash
npm install
cp .env.example .env   # συμπλήρωσε τις τιμές (βλ. παρακάτω)
npm run dev            # http://localhost:3000
```

### Μεταβλητές περιβάλλοντος (`.env`)

| Μεταβλητή | Περιγραφή |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Το Project URL, χωρίς `/rest/v1/` στο τέλος |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Το anon ή publishable key |
| `EXTRACTION_PROVIDER` | `gemini` (προεπιλογή) ή `anthropic` |
| `GEMINI_API_KEY` | Για `gemini` |
| `ANTHROPIC_API_KEY` | Για `anthropic` |

Το `service_role` key δεν μπαίνει ποτέ στο `.env` της εφαρμογής ούτε στον client.

### Βάση δεδομένων

Εφάρμοσε με τη σειρά τα αρχεία του [supabase/migrations/](supabase/migrations/) (με `supabase db push` ή από το SQL Editor του dashboard):

1. `…_init.sql`: πίνακες, RLS και trigger για το προφίλ (αντίγραφο του [schema.sql](schema.sql))
2. `…_waitlist.sql`: λίστα αναμονής
3. `…_storage.sql`: private bucket `documents`
4. `…_reminders.sql`: trigger που φτιάχνει τις υπενθυμίσεις
5. `…_reminders_cron.sql`: καθημερινό `pg_cron` job

Στο dashboard του Supabase, στο Authentication → URL Configuration, όρισε Site URL `http://localhost:3000` και Redirect URL `http://localhost:3000/auth/callback`.

### Υπενθυμίσεις (Edge Function)

Η function [send-reminders](supabase/functions/send-reminders/index.ts) στέλνει τα email μέσω Resend και καλείται καθημερινά από το `pg_cron`.

1. Φτιάξε το `supabase/functions/.env` (αγνοείται από το git) με `RESEND_API_KEY`, `REMINDER_CRON_SECRET` (τυχαίο string) και `SITE_URL`.
2. Στείλε τα secrets: `npx supabase secrets set --env-file supabase/functions/.env --project-ref <project-ref>`
3. Αποθήκευσε το ίδιο secret στο vault της βάσης: `select vault.create_secret('<secret>', 'reminder_cron_secret');`
4. Κάνε deploy: `npx supabase functions deploy send-reminders --project-ref <project-ref> --use-api`

Χωρίς δικό σου domain, το Resend στέλνει μόνο στο email του λογαριασμού σου, που αρκεί για δοκιμές. Για πραγματικούς χρήστες χρειάζεται επαληθευμένο domain.

## Εντολές

| Εντολή | Τι κάνει |
|---|---|
| `npm run dev` | Server ανάπτυξης |
| `npm run build` | Build παραγωγής |
| `npm run start` | Εκκίνηση του build |
| `npm test` | Tests του ανιχνευτή συνδρομών |
| `npm run eval` | Μέτρηση ακρίβειας της εξαγωγής πάνω στα `fixtures/` |

## Δομή

```
src/app/            σελίδες: αρχική, login, dashboard, auth callback
src/app/dashboard/  upload, οθόνη επιβεβαίωσης, server actions
src/components/     header, μενού χρήστη, badge κατάστασης
src/lib/extract.ts  extractDocument (Gemini ή Anthropic)
src/lib/expiry.ts   λογική χρωμάτων και ημερών λήξης
src/lib/subscriptions.ts  CSV parser και ανίχνευση επαναλαμβανόμενων χρεώσεων
src/lib/extract-transactions.ts  χρεώσεις από PDF statement (AI)
src/lib/supabase/   clients και session proxy
src/messages/       ελληνικά κείμενα (i18n)
supabase/           migrations, Edge Function, config
scripts/            eval της εξαγωγής
fixtures/           δείγματα για το eval (εκτός git)
```

## Εκκρεμότητες πριν το launch

Βλ. [CLAUDE.md](CLAUDE.md#εκκρεμότητες-πριν-το-launch): eval με πραγματικά δείγματα, ιδιωτικότητα του δωρεάν Gemini, domain για το Resend.
