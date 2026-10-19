"use server";

import webpush from "web-push";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function savePushSubscription(sub: unknown): Promise<{ ok: boolean }> {
  const parsed = subscriptionSchema.safeParse(sub);
  const { supabase, user } = await currentUser();
  if (!parsed.success || !user) return { ok: false };

  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth },
    { onConflict: "endpoint" },
  );
  if (error) console.error("save push subscription failed:", error.code);
  return { ok: !error };
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const { supabase, user } = await currentUser();
  if (!user) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint); // το RLS επιτρέπει μόνο δικά του
}

// Δοκιμαστική ειδοποίηση προς όλες τις συσκευές του χρήστη (για να επιβεβαιώσει ότι δουλεύει)
export async function sendTestPush(): Promise<{ sent: number; failed: number }> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const { supabase, user } = await currentUser();
  if (!publicKey || !privateKey || !user) return { sent: 0, failed: 0 };

  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://example.com", publicKey, privateKey);
  const { data: subs } = await supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth");

  let sent = 0;
  let failed = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: "Life Admin Autopilot", body: "Οι ειδοποιήσεις δουλεύουν ✓", url: "/dashboard", tag: `test-${Date.now()}` }),
        { TTL: 60 },
      );
      sent++;
    } catch (err) {
      failed++;
      const status = (err as { statusCode?: number }).statusCode;
      console.error("test push failed:", status);
      if (status === 404 || status === 410) await supabase.from("push_subscriptions").delete().eq("id", s.id); // η συσκευή δεν δέχεται πια
    }
  }
  return { sent, failed };
}
