"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import el from "@/messages/el.json";
import { createClient } from "@/lib/supabase/server";

export type AddState = { status: "idle" | "ok" | "error"; message?: string };

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  type: z.enum(Object.keys(el.types) as [string, ...string[]]),
  expires_on: z.iso.date().nullable(),
});

export async function addDocument(_prev: AddState, formData: FormData): Promise<AddState> {
  const parsed = schema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    expires_on: String(formData.get("expires_on") ?? "") || null,
  });
  if (!parsed.success) return { status: "error", message: el.dashboard.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: el.dashboard.error };

  const { error } = await supabase.from("documents").insert({
    user_id: user.id,
    ...parsed.data,
    source: "manual",
    status: "confirmed",
  });
  if (error) {
    console.error("add document failed:", error.code);
    return { status: "error", message: el.dashboard.error };
  }
  revalidatePath("/dashboard");
  return { status: "ok" };
}

export async function deleteDocument(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("file_path,vehicle_id").eq("id", id.data).maybeSingle();
  await supabase.from("documents").delete().eq("id", id.data); // το RLS επιτρέπει μόνο δικά του
  if (doc?.file_path) await supabase.storage.from("documents").remove([doc.file_path]);
  // όχημα χωρίς άλλα έγγραφα: σβήνεται κι αυτό
  if (doc?.vehicle_id) {
    const { count } = await supabase.from("documents").select("id", { count: "exact", head: true }).eq("vehicle_id", doc.vehicle_id);
    if (count === 0) await supabase.from("vehicles").delete().eq("id", doc.vehicle_id);
  }
  revalidatePath("/dashboard");
}
