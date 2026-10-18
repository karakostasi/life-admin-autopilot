// Edge Function (Deno): στέλνει τις υπενθυμίσεις που έχουν έρθει. Καλείται καθημερινά από pg_cron.
// Secrets: REMINDER_CRON_SECRET, RESEND_API_KEY, RESEND_FROM, SITE_URL
// (SUPABASE_URL και SUPABASE_SERVICE_ROLE_KEY δίνονται αυτόματα από το Supabase).
import { createClient } from "npm:@supabase/supabase-js@2";

const TYPE_LABELS: Record<string, string> = {
  car_insurance: "Ασφάλεια αυτοκινήτου",
  motorcycle_insurance: "Ασφάλεια μηχανής",
  ktel_ktheo: "ΚΤΕΟ",
  road_tax: "Τέλη κυκλοφορίας",
  passport: "Διαβατήριο",
  id_card: "Ταυτότητα",
  driving_license: "Δίπλωμα οδήγησης",
  home_insurance: "Ασφάλεια κατοικίας",
  health_insurance: "Ασφάλεια υγείας",
  warranty: "Εγγύηση",
  contract: "Συμβόλαιο / συνδρομή",
  other: "Έγγραφο",
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const plural = (n: number) => `${n} ${n === 1 ? "μέρα" : "μέρες"}`;
const todayInAthens = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date());
const utcDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const formatDate = (iso: string) => iso.split("-").reverse().join("/");

function buildEmail(title: string, type: string, expiresOn: string, days: number, siteUrl: string) {
  const when = days <= 0 ? "λήγει σήμερα" : `λήγει σε ${plural(days)}`;
  const subject = `${title} ${when}`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px">
  <h2 style="margin:0 0 8px">${esc(title)}</h2>
  <p style="margin:0 0 16px;color:#475569">${esc(TYPE_LABELS[type] ?? "Έγγραφο")} · ${when} (${formatDate(expiresOn)})</p>
  <a href="${esc(siteUrl)}/dashboard" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Δες τι λήγει</a>
  <p style="margin-top:24px;font-size:12px;color:#94a3b8">Life Admin Autopilot</p>
</div>`;
  return { subject, html };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("REMINDER_CRON_SECRET");
  if (!secret || req.headers.get("Authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return new Response("missing RESEND_API_KEY", { status: 500 });
  const from = Deno.env.get("RESEND_FROM") ?? "Life Admin Autopilot <onboarding@resend.dev>";
  const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:3000";

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const today = todayInAthens();

  const { data: due, error } = await supabase
    .from("reminders")
    .select("id,user_id,documents!inner(title,type,expires_on,status)")
    .eq("channel", "email")
    .is("sent_at", null)
    .lte("remind_on", today)
    .limit(200);
  if (error) {
    console.error("query failed:", error.code);
    return new Response("query failed", { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  const emailCache = new Map<string, string | null>();

  for (const r of due ?? []) {
    const doc = r.documents as unknown as { title: string; type: string; expires_on: string | null; status: string };
    // Δεν στέλνουμε για αρχειοθετημένα ή ληγμένα εδώ και καιρό
    if (!doc.expires_on || doc.status === "archived") continue;
    const days = Math.round((utcDay(doc.expires_on) - utcDay(today)) / 86_400_000);
    if (days < -1) continue;

    if (!emailCache.has(r.user_id)) {
      const { data } = await supabase.auth.admin.getUserById(r.user_id);
      emailCache.set(r.user_id, data.user?.email ?? null);
    }
    const to = emailCache.get(r.user_id);
    if (!to) continue;

    const { subject, html } = buildEmail(doc.title, doc.type, doc.expires_on, days, siteUrl);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (res.ok) {
      await supabase.from("reminders").update({ sent_at: new Date().toISOString() }).eq("id", r.id);
      sent++;
    } else {
      failed++;
      console.error("resend failed:", res.status); // όχι email ή περιεχόμενο στα logs
    }
  }

  return Response.json({ due: due?.length ?? 0, sent, failed });
});
