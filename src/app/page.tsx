import Link from "next/link";
import el from "@/messages/el.json";
import { DocTitle } from "@/components/doc-title";
import { ExpiryBadge, STATUS_STYLES } from "@/components/expiry-badge";
import { typeIcon } from "@/lib/doc-types";
import { expiryInfo, formatDate, type ExpiryStatus } from "@/lib/expiry";
import { createClient } from "@/lib/supabase/server";
import { WaitlistForm } from "./waitlist-form";

const ICONS = ["📸", "🔔", "💸"];

type Urgent = { id: string; title: string; identifier: string | null; type: string; expires_on: string | null; status: ExpiryStatus; days: number | null };

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Συνδεδεμένος: τα πιο επείγοντα έγγραφά του (ληγμένα, μετά πορτοκαλί, μετά τα υπόλοιπα)
  let urgent: Urgent[] = [];
  if (user) {
    const { data: docs } = await supabase
      .from("documents")
      .select("id,type,title,identifier,expires_on")
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
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-100/70 via-slate-100 to-slate-100">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-200/60 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -left-32 top-40 h-80 w-80 rounded-full bg-orange-100/70 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl gap-14 px-6 py-16 md:grid-cols-2 md:items-center md:py-28">
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm">
              🇬🇷 {el.landing.badge}
            </span>
            <h1 className="text-balance bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-700 bg-clip-text text-4xl font-extrabold leading-tight tracking-tight text-transparent sm:text-5xl lg:text-6xl">
              {el.hero.title}
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-600">{el.hero.subtitle}</p>
            {!user && (
              <div className="flex flex-wrap gap-3">
                <a href="#waitlist" className="btn-primary px-6 py-3 text-base">
                  {el.hero.cta}
                </a>
                <Link href="/login" className="btn-secondary px-6 py-3 text-base">
                  {el.hero.login}
                </Link>
              </div>
            )}
          </div>

          {user ? (
            <div className="card p-6 shadow-xl shadow-slate-200/60">
              <p className="mb-4 text-sm font-semibold text-slate-500">{el.landing.yourDocs}</p>
              {urgent.length === 0 ? (
                <div className="flex flex-col items-start gap-4 py-2">
                  <p className="text-slate-600">{el.dashboard.empty}</p>
                  <Link href="/dashboard" className="btn-primary">
                    {el.landing.addFirst}
                  </Link>
                </div>
              ) : (
                <>
                  <ul className="flex flex-col gap-3">
                    {urgent.map((d) => (
                      <li key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${STATUS_STYLES[d.status].soft}`}>
                          {typeIcon(d.type)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <DocTitle title={d.title} identifier={d.identifier} />
                          <p className="text-xs text-slate-500">
                            {el.types[d.type as keyof typeof el.types]}
                            {d.expires_on && ` · ${formatDate(d.expires_on)}`}
                          </p>
                        </div>
                        <ExpiryBadge status={d.status} days={d.days} />
                      </li>
                    ))}
                  </ul>
                  <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-indigo-600 hover:underline">
                    {el.landing.seeAll} →
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="card p-6 shadow-xl shadow-slate-200/60">
              <div className="mb-4 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <p className="ml-3 text-sm font-semibold text-slate-500">{el.landing.previewTitle}</p>
              </div>
              <ul className="flex flex-col gap-3">
                {el.landing.previewItems.map((item) => {
                  const st = STATUS_STYLES[item.status as ExpiryStatus];
                  return (
                    <li key={item.title} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${st.soft}`}>{item.icon}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{item.title}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${st.badge}`}>{item.label}</span>
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
          <section className="mx-auto max-w-6xl px-6 py-12">
            <div className="grid gap-6 md:grid-cols-3">
              {el.points.map((p, i) => (
                <div key={p} className="card p-7 transition hover:-translate-y-1 hover:shadow-md">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-2xl">{ICONS[i]}</div>
                  <h3 className="mb-1.5 text-lg font-bold">{el.landing.pointTitles[i]}</h3>
                  <p className="leading-relaxed text-slate-600">{p}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-4xl px-6 py-10 text-center">
            <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-slate-500">{el.landing.typesTitle}</p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {el.landing.types.map((t) => (
                <span key={t} className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                  {t}
                </span>
              ))}
            </div>
          </section>

          <section id="waitlist" className="mx-auto max-w-xl scroll-mt-20 px-6 py-16">
            <div className="card p-8 shadow-xl shadow-slate-200/60">
              <h2 className="mb-6 text-center text-2xl font-bold tracking-tight">{el.landing.waitlistTitle}</h2>
              <WaitlistForm />
              <p className="mt-6 text-center text-sm text-slate-500">🔒 {el.trust}</p>
            </div>
          </section>
        </>
      )}

      <footer className="border-t border-slate-200 bg-slate-200/50 py-8 text-center text-sm text-slate-500">{el.landing.footer}</footer>
    </main>
  );
}
