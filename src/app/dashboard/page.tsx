import { redirect } from "next/navigation";
import el from "@/messages/el.json";
import { ExpiryBadge, STATUS_STYLES } from "@/components/expiry-badge";
import { expiryInfo, formatDate, type ExpiryStatus } from "@/lib/expiry";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";
import { AddDocument } from "./add-document";
import { deleteDocument } from "./actions";

const ORDER: ExpiryStatus[] = ["expired", "soon", "ok", "unknown"];

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: docs } = await supabase
    .from("documents")
    .select("id,type,title,provider,identifier,expires_on")
    .neq("status", "archived")
    .order("expires_on", { ascending: true, nullsFirst: false });

  const now = new Date();
  const items = (docs ?? []).map((d) => ({ ...d, ...expiryInfo(d.expires_on, now) }));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{el.dashboard.title}</h1>
          <p className="text-sm text-slate-500">{el.dashboard.signedInAs.replace("{email}", user.email ?? "")}</p>
        </div>
        <form action={signOut}>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">{el.dashboard.signOut}</button>
        </form>
      </div>

      <AddDocument />

      {items.length === 0 && <p className="text-slate-500">{el.dashboard.empty}</p>}

      {ORDER.map((status) => {
        const group = items.filter((i) => i.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {el.dashboard.groups[status]} ({group.length})
            </h2>
            <ul className="flex flex-col gap-3">
              {group.map((d) => (
                <li
                  key={d.id}
                  className={`flex items-center justify-between gap-4 rounded-xl border border-slate-200 border-l-4 p-4 ${STATUS_STYLES[status].border}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.title}</p>
                    <p className="text-sm text-slate-500">
                      {el.types[d.type as keyof typeof el.types]}
                      {d.expires_on && ` · ${formatDate(d.expires_on)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <ExpiryBadge status={d.status} days={d.days} />
                    <form action={deleteDocument}>
                      <input type="hidden" name="id" value={d.id} />
                      <button className="text-sm text-slate-400 hover:text-red-600">{el.dashboard.delete}</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
