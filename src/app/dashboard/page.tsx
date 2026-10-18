import Link from "next/link";
import { redirect } from "next/navigation";
import el from "@/messages/el.json";
import { DocTitle, Plate } from "@/components/doc-title";
import { ExpiryBadge, STATUS_STYLES } from "@/components/expiry-badge";
import { typeIcon } from "@/lib/doc-types";
import { expiryInfo, formatDate, type ExpiryStatus } from "@/lib/expiry";
import { groupByVehicle, stripPlate, type Vehicle } from "@/lib/vehicles";
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
    .select("id,type,title,provider,identifier,vehicle_id,expires_on,file_path")
    .neq("status", "archived")
    .order("expires_on", { ascending: true, nullsFirst: false });
  const { data: vehicleRows } = await supabase.from("vehicles").select("id,kind,plate,model").order("created_at");
  const vehicles = (vehicleRows ?? []) as Vehicle[];
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));

  // signed URLs (5 λεπτά): το bucket είναι private
  const paths = (docs ?? []).map((d) => d.file_path).filter((p): p is string => !!p);
  const signed = paths.length ? (await supabase.storage.from("documents").createSignedUrls(paths, 300)).data : null;
  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);

  const now = new Date();
  const items = (docs ?? []).map((d) => ({ ...d, ...expiryInfo(d.expires_on, now) }));

  const counts = { expired: 0, soon: 0, ok: 0, unknown: 0 } as Record<ExpiryStatus, number>;
  for (const i of items) counts[i.status]++;

  // έγγραφα του ίδιου οχήματος -> μία κάρτα οχήματος. Μπαίνει στην ενότητα του πιο επείγοντος εγγράφου της
  const entries = groupByVehicle(items).map((g) => {
    const worst = [...g.items].sort(
      (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || (a.days ?? Infinity) - (b.days ?? Infinity),
    )[0];
    return { ...g, status: worst.status, days: worst.days };
  });

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

      <Upload vehicles={vehicles} />

      <AddDocument />

      {items.length === 0 && <p className="text-slate-500">{el.dashboard.empty}</p>}

      {ORDER.map((status) => {
        const group = entries
          .filter((e) => e.status === status)
          .sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity));
        if (group.length === 0) return null;
        return (
          <section key={status} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[status].dot}`} />
              {el.dashboard.groups[status]} ({group.length})
            </h2>
            <ul className="flex flex-col gap-3">
              {group.map((e) =>
                e.vehicleId ? (
                  <li key={e.vehicleId} className="card overflow-hidden transition hover:shadow-md">
                    <div className="flex flex-wrap items-center gap-4 p-4">
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${STATUS_STYLES[status].soft}`}>
                        {vehicleIcon(vehicleById.get(e.vehicleId), e.items.map((d) => d.type))}
                      </span>
                      <div className="min-w-0 flex-1 basis-48">
                        <Plate large>{vehicleById.get(e.vehicleId)?.plate ?? e.items[0].identifier}</Plate>
                        <p className="mt-1 text-sm text-slate-500">
                          {[vehicleById.get(e.vehicleId)?.model, el.dashboard.documentsCount.replace("{n}", String(e.items.length))].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <ExpiryBadge status={status} days={e.days} />
                    </div>
                    <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/60">
                      {e.items.map((d) => (
                        <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                          <span className="w-6 shrink-0 text-center text-lg">{typeIcon(d.type)}</span>
                          <div className="min-w-0 flex-1 basis-40">
                            <p className="truncate text-sm font-semibold">{stripPlate(d.title, vehicleById.get(e.vehicleId!)?.plate ?? d.identifier)}</p>
                            <p className="text-xs text-slate-500">
                              {el.types[d.type as keyof typeof el.types]}
                              {d.expires_on && ` · ${formatDate(d.expires_on)}`}
                            </p>
                          </div>
                          <DocActions d={d} url={d.file_path ? urlByPath.get(d.file_path) : undefined} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ) : (
                  e.items.map((d) => (
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
                      <DocActions d={d} url={d.file_path ? urlByPath.get(d.file_path) : undefined} />
                    </li>
                  ))
                ),
              )}
            </ul>
          </section>
        );
      })}
    </main>
  );
}

// Εικονίδιο οχήματος για την ομάδα: από το είδος του οχήματος, αλλιώς από τα έγγραφά του
function vehicleIcon(vehicle: Vehicle | undefined, types: string[]): string {
  if (vehicle) return typeIcon(vehicle.kind === "motorcycle" ? "motorcycle_insurance" : "car_insurance");
  if (types.includes("motorcycle_insurance")) return typeIcon("motorcycle_insurance");
  if (types.some((t) => ["car_insurance", "ktel_ktheo", "road_tax"].includes(t))) return typeIcon("car_insurance");
  return typeIcon(types[0]);
}

function DocActions({ d, url }: { d: { id: string; status: ExpiryStatus; days: number | null }; url?: string }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3">
      <ExpiryBadge status={d.status} days={d.days} />
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-indigo-600 hover:underline">
          {el.upload.openFile}
        </a>
      )}
      <form action={deleteDocument}>
        <input type="hidden" name="id" value={d.id} />
        <button className="text-sm text-slate-400 transition hover:text-red-600">{el.dashboard.delete}</button>
      </form>
    </div>
  );
}
