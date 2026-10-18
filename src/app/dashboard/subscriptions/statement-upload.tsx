"use client";

import { useRef, useState, useTransition } from "react";
import { ServiceIcon } from "@/components/service-icon";
import el from "@/messages/el.json";
import { formatDate } from "@/lib/expiry";
import type { SubscriptionCandidate } from "@/lib/subscriptions";
import { analyzeStatement, saveSubscriptions } from "./actions";

type Row = SubscriptionCandidate & { selected: boolean };

export function StatementUpload() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [txCount, setTxCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await analyzeStatement(fd);
      if (!res.ok) return setError(res.error);
      setTxCount(res.transactionCount);
      setRows(res.candidates.map((c) => ({ ...c, selected: true })));
    });
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs && rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function save() {
    const chosen = (rows ?? []).filter((r) => r.selected);
    if (chosen.length === 0) return setRows(null);
    startTransition(async () => {
      const res = await saveSubscriptions(chosen.map(({ selected: _s, occurrences: _o, ...rest }) => rest));
      if (!res.ok) return setError(el.dashboard.error);
      setRows(null);
    });
  }

  return (
    <section className="rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">{el.subscriptions.uploadTitle}</h2>
          <p className="text-sm text-slate-600">{el.subscriptions.uploadHint}</p>
        </div>
        <button type="button" disabled={pending || rows !== null} onClick={() => inputRef.current?.click()} className="btn-primary">
          {pending && rows === null ? el.subscriptions.reading : el.upload.choose}
        </button>
        <input ref={inputRef} type="file" accept=".csv,.txt,text/csv,application/pdf" onChange={onPick} className="hidden" />
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {rows && (
        <div className="mt-5 flex flex-col gap-4 border-t border-indigo-200 pt-5">
          <div>
            <h3 className="font-semibold">{el.subscriptions.reviewTitle}</h3>
            <p className="text-sm text-slate-600">
              {rows.length > 0
                ? el.subscriptions.reviewHint.replace("{n}", String(txCount))
                : el.subscriptions.none.replace("{n}", String(txCount))}
            </p>
          </div>

          <ul className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <li key={`${r.merchant}-${i}`} className="card flex flex-wrap items-center gap-3 p-3">
                <input type="checkbox" checked={r.selected} onChange={(e) => update(i, { selected: e.target.checked })} className="h-4 w-4" aria-label={r.merchant} />
                <ServiceIcon merchant={r.merchant} size="sm" />
                <input
                  value={r.merchant}
                  maxLength={80}
                  onChange={(e) => update(i, { merchant: e.target.value })}
                  className="input min-w-0 flex-1 basis-40"
                />
                <span className="text-sm font-semibold">{r.amount.toFixed(2).replace(".", ",")} €</span>
                <select value={r.period} onChange={(e) => update(i, { period: e.target.value as Row["period"] })} className="input !w-auto">
                  <option value="monthly">{el.upload.recurrence.monthly}</option>
                  <option value="yearly">{el.upload.recurrence.yearly}</option>
                </select>
                <span className="w-full text-xs text-slate-500 sm:w-auto">
                  {el.subscriptions.lastCharge.replace("{date}", formatDate(r.last_charged_on)).replace("{n}", String(r.occurrences))}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex gap-3">
            {rows.length > 0 && (
              <button type="button" disabled={pending} onClick={save} className="btn-dark">
                {pending ? el.upload.saving : el.subscriptions.confirm}
              </button>
            )}
            <button type="button" onClick={() => setRows(null)} className="btn-secondary">
              {rows.length > 0 ? el.upload.cancel : el.subscriptions.close}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
