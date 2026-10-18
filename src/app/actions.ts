"use server";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import el from "@/messages/el.json";

export type WaitlistState = { status: "idle" | "ok" | "error"; message?: string };

const schema = z.object({
  email: z.email().max(254),
  answer: z.string().max(500).optional(),
});

export async function joinWaitlist(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  // honeypot: τα bots συμπληρώνουν κρυφά πεδία
  if (String(formData.get("website") ?? "") !== "") return { status: "ok", message: el.form.success };

  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    answer: String(formData.get("answer") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { status: "error", message: el.form.invalid };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("waitlist: missing supabase env");
    return { status: "error", message: el.form.error };
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase
    .from("waitlist")
    .insert({ email: parsed.data.email, answer: parsed.data.answer ?? null });

  // 23505 = ήδη στη λίστα: το αντιμετωπίζουμε ως επιτυχία
  if (error && error.code !== "23505") {
    console.error("waitlist insert failed:", error.code);
    return { status: "error", message: el.form.error };
  }
  return { status: "ok", message: el.form.success };
}
