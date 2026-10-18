import Link from "next/link";
import el from "@/messages/el.json";
import { ExpiryBadge, STATUS_STYLES } from "@/components/expiry-badge";
import { expiryInfo, formatDate, type ExpiryStatus } from "@/lib/expiry";
import { createClient } from "@/lib/supabase/server";
import { WaitlistForm } from "./waitlist-form";

const ICONS = ["📸", "🔔", "💸"];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Συνδεδεμένος: τα πιο επείγοντα έγγραφά του (ληγμένα, μετά πορτοκαλί, μετά τα υπόλοιπα)
  let urgent: { id: string; title: string; type: string; expires_on: string | null; status: ExpiryStatus; days: number | null }[] = [];
  if (user) {
    const { data: docs } = await supabase
      .from("documents")
      .select("id,type,title,expires_on")
      .neq("status", "archived")
      .order("expires_on", { ascending: true, nullsFirst: false });
    const rank: Record<ExpiryStatus, number> = { expired: 0, soon: 1, ok: 2, unknown: 3 };
    urgent = (docs ?? [])
      .map((d) => ({ ...d, ...expiryInfo(d.expires_on) }))
      .sort((a, b) => rank[a.status] - rank[b.status])
      .slice(0, 4);
  }

  return (
    <main>
      <section className="bg-gradient-to-b from-indigo-50 to-white">
        <div className="mx-auto grid max-w-5xl gap-12 px-6 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{el.hero.title}</h1>
            <p className="text-lg text-slate-600">{el.hero.subtitle}</p>
            <div className="flex flex-wrap gap-3">
              {!user && (
                <>
                  <a href="#waitlist" className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500">
                    {el.hero.cta}
                  </a>
                  <Link href="/login" className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium hover:bg-slate-50">
                    {el.hero.login}
                  </Link>
                </>
              )}
            </div>
          </div>

          {user ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
              <p className="mb-4 text-sm font-medium text-slate-500">{el.landing.yourDocs}</p>
              {urgent.length === 0 ? (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-slate-600">{el.dashboard.empty}</p>
                  <Link href="/dashboard" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                    {el.landing.addFirst}
                  </Link>
                </div>
              ) : (
                <>
                  <ul className="flex flex-col gap-3">
                    {urgent.map((d) => (
                      <li key={d.id} className={`flex items-center justify-between gap-3 rounded-lg border border-slate-200 border-l-4 p-3 ${STATUS_STYLES[d.status].border}`}>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{d.title}</p>
                          <p className="text-xs text-slate-500">
                            {el.types[d.type as keyof typeof el.types]}
                            {d.expires_on && ` · ${formatDate(d.expires_on)}`}
                          </p>
                        </div>
                        <ExpiryBadge status={d.status} days={d.days} />
                      </li>
                    ))}
                  </ul>
                  <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
                    {el.landing.seeAll} →
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
              <p className="mb-4 text-sm font-medium text-slate-500">{el.landing.previewTitle}</p>
              <ul className="flex flex-col gap-3">
                {el.landing.previewItems.map((item) => {
                  const s = STATUS_STYLES[item.status as ExpiryStatus];
                  return (
                    <li key={item.title} className={`flex items-center justify-between gap-3 rounded-lg border border-slate-200 border-l-4 p-3 ${s.border}`}>
                      <span className="font-medium">{item.title}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${s.badge}`}>{item.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </section>

      {!user && (
        <>
          <section className="mx-auto max-w-5xl px-6 py-12">
            <div className="grid gap-6 md:grid-cols-3">
              {el.points.map((p, i) => (
                <div key={p} className="rounded-2xl border border-slate-200 p-6">
                  <div className="mb-3 text-3xl">{ICONS[i]}</div>
                  <h3 className="mb-1 font-semibold">{el.landing.pointTitles[i]}</h3>
                  <p className="text-slate-600">{p}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-5xl px-6 py-8 text-center">
            <p className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-500">{el.landing.typesTitle}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {el.landing.types.map((t) => (
                <span key={t} className="rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-700">
                  {t}
                </span>
              ))}
            </div>
          </section>
        </>
      )}

      {!user && (
        <section id="waitlist" className="mx-auto max-w-xl px-6 py-16">
          <h2 className="mb-6 text-center text-2xl font-bold tracking-tight">{el.landing.waitlistTitle}</h2>
          <WaitlistForm />
          <p className="mt-6 text-center text-sm text-slate-500">{el.trust}</p>
        </section>
      )}

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">{el.landing.footer}</footer>
    </main>
  );
}
