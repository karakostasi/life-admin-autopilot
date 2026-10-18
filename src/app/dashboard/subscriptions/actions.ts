"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import el from "@/messages/el.json";
import { extractTransactions } from "@/lib/extract-transactions";
import { detectRecurring, parseStatementCsv, type SubscriptionCandidate, type Transaction } from "@/lib/subscriptions";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 4 * 1024 * 1024;

export type AnalyzeResult = { ok: true; candidates: SubscriptionCandidate[]; transactionCount: number } | { ok: false; error: string };

function decodeCsv(buf: Buffer): string {
  // τα ελληνικά statements βγαίνουν συχνά σε Windows-1253
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1253").decode(buf);
  }
}

// Το statement διαβάζεται στη μνήμη και ΔΕΝ αποθηκεύεται πουθενά. Επιστρέφει μόνο τις υποψήφιες συνδρομές.
export async function analyzeStatement(formData: FormData): Promise<AnalyzeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: el.upload.errors.auth };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: el.subscriptions.errors.unsupported };
  if (file.size > MAX_BYTES) return { ok: false, error: el.upload.errors.tooLarge };

  const buf = Buffer.from(await file.arrayBuffer());
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isCsv = /\.(csv|txt)$/i.test(file.name) || file.type === "text/csv";
  if (!isPdf && !isCsv) return { ok: false, error: el.subscriptions.errors.unsupported };

  let transactions: Transaction[];
  if (isPdf) {
    const res = await extractTransactions(buf.toString("base64"));
    if (!res.ok) return { ok: false, error: res.error === "rate_limited" ? el.upload.errors.rateLimited : el.subscriptions.errors.pdf };
    transactions = res.transactions;
  } else {
    const res = parseStatementCsv(decodeCsv(buf));
    if (!res.ok) return { ok: false, error: res.error === "empty" ? el.subscriptions.errors.empty : el.subscriptions.errors.csv };
    transactions = res.transactions;
  }
  if (transactions.length === 0) return { ok: false, error: el.subscriptions.errors.empty };

  return { ok: true, candidates: detectRecurring(transactions), transactionCount: transactions.length };
}

const saveSchema = z
  .array(
    z.object({
      merchant: z.string().trim().min(1).max(80),
      amount: z.number().positive().max(100_000),
      period: z.enum(["monthly", "yearly"]),
      last_charged_on: z.iso.date(),
    }),
  )
  .min(1)
  .max(100);

// Ο χρήστης επιβεβαίωσε (και ίσως διόρθωσε) τη λίστα -> αποθήκευση, χωρίς διπλότυπα
export async function saveSubscriptions(items: unknown): Promise<{ ok: boolean; saved: number }> {
  const parsed = saveSchema.safeParse(items);
  if (!parsed.success) return { ok: false, saved: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, saved: 0 };

  const { data: existing } = await supabase.from("subscriptions").select("merchant,amount").neq("status", "cancelled");
  const seen = new Set((existing ?? []).map((s) => `${s.merchant.toLowerCase()}|${Number(s.amount)}`));
  const rows = parsed.data
    .filter((s) => !seen.has(`${s.merchant.toLowerCase()}|${s.amount}`))
    .map((s) => ({ ...s, user_id: user.id, currency: "EUR" }));

  if (rows.length) {
    const { error } = await supabase.from("subscriptions").insert(rows);
    if (error) {
      console.error("save subscriptions failed:", error.code);
      return { ok: false, saved: 0 };
    }
  }
  revalidatePath("/dashboard/subscriptions");
  return { ok: true, saved: rows.length };
}

export async function deleteSubscription(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("subscriptions").delete().eq("id", id.data); // το RLS επιτρέπει μόνο δικά του
  revalidatePath("/dashboard/subscriptions");
}
