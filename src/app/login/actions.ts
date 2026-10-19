"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import el from "@/messages/el.json";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.email().max(254).safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) return { status: "error", message: el.auth.invalid };

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    console.error("magic link failed:", error.status ?? error.code ?? "unknown");
    return { status: "error", message: error.status === 429 ? el.auth.rateLimited : el.auth.error };
  }
  return { status: "sent", message: el.auth.sent, email: parsed.data };
}

// Σύνδεση με τον κωδικό του email: δουλεύει μέσα στο PWA, χωρίς να βγαίνει ο χρήστης στο Safari
export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = z.email().max(254).safeParse(String(formData.get("email") ?? "").trim());
  const token = z.string().regex(/^\d{6,10}$/).safeParse(String(formData.get("code") ?? "").replace(/\s/g, ""));
  if (!email.success) return { status: "error", message: el.auth.error };
  if (!token.success) return { status: "sent", email: email.data, message: el.auth.codeInvalid };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: email.data, token: token.data, type: "email" });
  if (error) {
    console.error("verify code failed:", error.status ?? error.code ?? "unknown");
    return { status: "sent", email: email.data, message: error.status === 429 ? el.auth.rateLimited : el.auth.codeInvalid };
  }
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
