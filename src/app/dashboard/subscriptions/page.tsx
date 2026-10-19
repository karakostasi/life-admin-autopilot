import Link from "next/link";
import { redirect } from "next/navigation";
import el from "@/messages/el.json";
import { ServiceIcon } from "@/components/service-icon";
import { formatDate } from "@/lib/expiry";
import { monthlyEquivalent } from "@/lib/subscriptions";
import { createClient } from "@/lib/supabase/server";
import { deleteSubscription } from "./actions";
import { StatementUpload } from "./statement-upload";

const money = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

// οι server actions (upload, AI) τρέχουν με το όριο της σελίδας: τα AI calls έχουν timeout 60-90s
export const maxDuration = 60;

export default async function Subscriptions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id,merchant,amount,period,last_charged_on")
    .eq("status", "active")
    .order("amount", { ascending: false });

  const items = subs ?? [];
  const monthly = items.reduce((sum, s) => sum + monthlyEquivalent(Number(s.amount), s.period), 0);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <div>
        <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:underline">
          ← {el.subscriptions.back}
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{el.subscriptions.title}</h1>
        <p className="text-sm text-slate-500">{el.subscriptions.subtitle}</p>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-indigo-300 bg-indigo-100 p-4 shadow-md shadow-indigo-200/60 sm:p-5">
            <p className="text-3xl font-extrabold text-indigo-700 sm:text-4xl">{money(monthly)}</p>
            <p className="mt-1 text-xs font-semibold text-slate-700 sm:text-sm">{el.subscriptions.perMonth}</p>
          </div>
          <div className="rounded-2xl border border-indigo-300 bg-indigo-100 p-4 shadow-md shadow-indigo-200/60 sm:p-5">
            <p className="text-3xl font-extrabold text-indigo-700 sm:text-4xl">{money(monthly * 12)}</p>
            <p className="mt-1 text-xs font-semibold text-slate-700 sm:text-sm">{el.subscriptions.perYear}</p>
          </div>
        </div>
      )}

      <StatementUpload />

      {items.length === 0 ? (
        <p className="text-slate-500">{el.subscriptions.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((s) => (
            <li key={s.id} className="card flex flex-wrap items-center gap-4 p-4">
              <ServiceIcon merchant={s.merchant} />
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate font-semibold">{s.merchant}</p>
                <p className="text-sm text-slate-500">
                  {el.upload.recurrence[s.period as "monthly" | "yearly"]}
                  {s.last_charged_on && ` · ${el.subscriptions.lastChargeShort.replace("{date}", formatDate(s.last_charged_on))}`}
                </p>
              </div>
              <p className="font-semibold">{money(Number(s.amount))}</p>
              <form action={deleteSubscription}>
                <input type="hidden" name="id" value={s.id} />
                <button className="text-sm text-slate-400 transition hover:text-red-600">{el.dashboard.delete}</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
