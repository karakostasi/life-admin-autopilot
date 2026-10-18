"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import el from "@/messages/el.json";
import { extractDocument, type Extraction, type ExtractInput } from "@/lib/extract";
import { createClient } from "@/lib/supabase/server";
import { isVehicleType, plateKey, vehicleKindForType } from "@/lib/vehicles";

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
  // όχημα: "" (κανένα) | "new" | id υπάρχοντος οχήματος
  vehicle_choice: z.string().max(40),
  vehicle_model: z.string().trim().max(80).nullable(),
  vehicle_kind: z.enum(["car", "motorcycle"]).nullable(),
});

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Βρίσκει ή δημιουργεί το όχημα στο οποίο ανήκει το έγγραφο. Το RLS εγγυάται ότι βλέπουμε μόνο δικά του.
async function resolveVehicle(
  supabase: Supabase,
  userId: string,
  v: { choice: string; plate: string | null; model: string | null; kind: "car" | "motorcycle" },
): Promise<{ id: string; plate: string } | null> {
  if (z.uuid().safeParse(v.choice).success) {
    const { data } = await supabase.from("vehicles").select("id,plate").eq("id", v.choice).maybeSingle();
    return data ?? null;
  }
  const key = plateKey(v.plate);
  if (v.choice !== "new" || !v.plate || !key) return null;

  const find = () => supabase.from("vehicles").select("id,plate,model").eq("plate_key", key).maybeSingle();
  let { data: vehicle } = await find();
  if (!vehicle) {
    const { data, error } = await supabase
      .from("vehicles")
      .insert({ user_id: userId, kind: v.kind, plate: v.plate, plate_key: key, model: v.model })
      .select("id,plate,model")
      .single();
    if (error) {
      if (error.code !== "23505") console.error("create vehicle failed:", error.code);
      vehicle = (await find()).data; // ταυτόχρονη δημιουργία: πάρε αυτό που υπάρχει ήδη
    } else vehicle = data;
  } else if (!vehicle.model && v.model) {
    await supabase.from("vehicles").update({ model: v.model }).eq("id", vehicle.id);
  }
  return vehicle ? { id: vehicle.id, plate: vehicle.plate } : null;
}

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
    vehicle_choice: String(formData.get("vehicle_choice") ?? ""),
    vehicle_model: text(formData.get("vehicle_model")),
    vehicle_kind: (text(formData.get("vehicle_kind")) as "car" | "motorcycle" | null) ?? null,
  });
  if (!parsed.success) return { status: "error", message: el.dashboard.error };

  const { extraction, file_path, vehicle_choice, vehicle_model, vehicle_kind, ...rest } = parsed.data;
  if (file_path && !file_path.startsWith(`${user.id}/`)) return { status: "error", message: el.dashboard.error };

  let extractionJson: unknown = null;
  try {
    extractionJson = extraction ? JSON.parse(extraction) : null;
  } catch {
    extractionJson = null;
  }

  let vehicleId: string | null = null;
  if (isVehicleType(rest.type)) {
    const vehicle = await resolveVehicle(supabase, user.id, {
      choice: vehicle_choice,
      plate: rest.identifier,
      model: vehicle_model,
      kind: vehicle_kind ?? vehicleKindForType(rest.type),
    });
    if (vehicle) {
      vehicleId = vehicle.id;
      rest.identifier = vehicle.plate; // η πινακίδα του εγγράφου ευθυγραμμίζεται με του οχήματος
    }
  }

  const { error } = await supabase.from("documents").insert({
    user_id: user.id,
    ...rest,
    vehicle_id: vehicleId,
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
