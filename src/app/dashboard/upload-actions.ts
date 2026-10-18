"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import el from "@/messages/el.json";
import { extractDocument, type Extraction, type ExtractInput } from "@/lib/extract";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 4 * 1024 * 1024;
const BUCKET = "documents";
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export type UploadResult =
  | { ok: true; path: string; extraction: Extraction; needsReview: boolean; reasons: string[] }
  // η εξαγωγή απέτυχε: ο χρήστης συμπληρώνει χειροκίνητα, το αρχείο έχει ήδη ανέβει
  | { ok: false; path: string | null; error: string };

export type SaveState = { status: "idle" | "ok" | "error"; message?: string };

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Βήμα 1: ανεβάζει το αρχείο σε private bucket και τρέχει το AI. ΔΕΝ αποθηκεύει έγγραφο.
export async function extractUpload(formData: FormData): Promise<UploadResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, path: null, error: el.upload.errors.auth };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, path: null, error: el.upload.errors.unsupported };
  if (file.size > MAX_BYTES) return { ok: false, path: null, error: el.upload.errors.tooLarge };
  const ext = EXT[file.type];
  if (!ext) return { ok: false, path: null, error: el.upload.errors.unsupported };

  const buf = Buffer.from(await file.arrayBuffer());
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: file.type });
  if (upErr) {
    console.error("upload failed:", upErr.message.slice(0, 80));
    return { ok: false, path: null, error: el.upload.errors.upload };
  }

  const base64 = buf.toString("base64");
  const input: ExtractInput =
    file.type === "application/pdf"
      ? { kind: "pdf", base64 }
      : { kind: "image", mediaType: file.type as "image/jpeg" | "image/png" | "image/webp", base64 };

  const res = await extractDocument(input);
  if (!res.ok) {
    return { ok: false, path, error: res.error === "rate_limited" ? el.upload.errors.rateLimited : el.upload.errors.extract };
  }
  return { ok: true, path, extraction: res.data, needsReview: res.needsReview, reasons: res.reviewReasons };
}

// Ακύρωση: σβήνει το αρχείο που ανέβηκε (μόνο από τον φάκελο του χρήστη)
export async function discardUpload(path: string) {
  const { supabase, user } = await currentUser();
  if (!user || !path.startsWith(`${user.id}/`)) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

const saveSchema = z.object({
  title: z.string().trim().min(1).max(120),
  type: z.enum(Object.keys(el.types) as [string, ...string[]]),
  provider: z.string().trim().max(120).nullable(),
  identifier: z.string().trim().max(60).nullable(),
  expires_on: z.iso.date().nullable(),
  amount: z.number().min(0).max(1_000_000).nullable(),
  currency: z.string().trim().length(3),
  recurrence: z.enum(["none", "monthly", "yearly"]),
  file_path: z.string().nullable(),
  extraction: z.string().max(6000).nullable(),
});

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

// Βήμα 2: ο χρήστης επιβεβαίωσε/διόρθωσε τα πεδία -> αποθήκευση
export async function saveDocument(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const { supabase, user } = await currentUser();
  if (!user) return { status: "error", message: el.upload.errors.auth };

  const amountRaw = text(formData.get("amount"));
  const parsed = saveSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    provider: text(formData.get("provider")),
    identifier: text(formData.get("identifier")),
    expires_on: text(formData.get("expires_on")),
    amount: amountRaw === null ? null : Number(amountRaw.replace(",", ".")),
    currency: text(formData.get("currency")) ?? "EUR",
    recurrence: formData.get("recurrence"),
    file_path: text(formData.get("file_path")),
    extraction: text(formData.get("extraction")),
  });
  if (!parsed.success) return { status: "error", message: el.dashboard.error };

  const { extraction, file_path, ...rest } = parsed.data;
  if (file_path && !file_path.startsWith(`${user.id}/`)) return { status: "error", message: el.dashboard.error };

  let extractionJson: unknown = null;
  try {
    extractionJson = extraction ? JSON.parse(extraction) : null;
  } catch {
    extractionJson = null;
  }

  const { error } = await supabase.from("documents").insert({
    user_id: user.id,
    ...rest,
    file_path,
    extraction: extractionJson,
    source: "upload",
    status: "confirmed",
  });
  if (error) {
    console.error("save document failed:", error.code);
    return { status: "error", message: el.dashboard.error };
  }
  revalidatePath("/dashboard");
  return { status: "ok" };
}
