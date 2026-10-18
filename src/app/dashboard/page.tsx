import Link from "next/link";
import { redirect } from "next/navigation";
import el from "@/messages/el.json";
import { DocTitle } from "@/components/doc-title";
import { ExpiryBadge, STATUS_STYLES } from "@/components/expiry-badge";
import { typeIcon } from "@/lib/doc-types";
import { expiryInfo, formatDate, type ExpiryStatus } from "@/lib/expiry";
import { createClient } from "@/lib/supabase/server";
import { AddDocument } from "./add-document";
import { Upload } from "./upload";
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
    .select("id,type,title,provider,identifier,expires_on,file_path")
    .neq("status", "archived")
    .order("expires_on", { ascending: true, nullsFirst: false });

  // signed URLs (5 λεπτά): το bucket είναι private
  const paths = (docs ?? []).map((d) => d.file_path).filter((p): p is string => !!p);
  const signed = paths.length ? (await supabase.storage.from("documents").createSignedUrls(paths, 300)).data : null;
  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);

  const now = new Date();
  const items = (docs ?? []).map((d) => ({ ...d, ...expiryInfo(d.expires_on, now) }));

  const counts = { expired: 0, soon: 0, ok: 0, unknown: 0 } as Record<ExpiryStatus, number>;
  for (const i of items) counts[i.status]++;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{el.dashboard.title}</h1>
        <p className="text-sm text-slate-500">{el.dashboard.signedInAs.replace("{email}", user.email ?? "")}</p>
        <Link href="/dashboard/subscriptions" className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:underline">
          {el.subscriptions.link} →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {(["expired", "soon", "ok"] as const).map((status) => (
          <div key={status} className={`rounded-2xl border p-4 shadow-md sm:p-5 ${STATUS_STYLES[status].tile}`}>
            <p className={`text-3xl font-extrabold sm:text-4xl ${STATUS_STYLES[status].text}`}>{counts[status]}</p>
            <p className="mt-1 text-xs font-semibold text-slate-700 sm:text-sm">{el.dashboard.summary[status]}</p>
          </div>
        ))}
      </div>

      <Upload />

      <AddDocument />

      {items.length === 0 && <p className="text-slate-500">{el.dashboard.empty}</p>}

      {ORDER.map((status) => {
        const group = items.filter((i) => i.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[status].dot}`} />
              {el.dashboard.groups[status]} ({group.length})
            </h2>
            <ul className="flex flex-col gap-3">
              {group.map((d) => (
                <li key={d.id} className="card flex flex-wrap items-center gap-4 p-4 transition hover:shadow-md">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${STATUS_STYLES[status].soft}`}>
                    {typeIcon(d.type)}
                  </span>
                  <div className="min-w-0 flex-1 basis-48">
                    <DocTitle title={d.title} identifier={d.identifier} />
                    <p className="text-sm text-slate-500">
                      {el.types[d.type as keyof typeof el.types]}
                      {d.expires_on && ` · ${formatDate(d.expires_on)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <ExpiryBadge status={d.status} days={d.days} />
                    {d.file_path && urlByPath.get(d.file_path) && (
                      <a href={urlByPath.get(d.file_path)} target="_blank" rel="noreferrer" className="text-sm font-medium text-indigo-600 hover:underline">
                        {el.upload.openFile}
                      </a>
                    )}
                    <form action={deleteDocument}>
                      <input type="hidden" name="id" value={d.id} />
                      <button className="text-sm text-slate-400 transition hover:text-red-600">{el.dashboard.delete}</button>
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
