"use client";

import { useActionState } from "react";
import el from "@/messages/el.json";
import { addDocument, type AddState } from "./actions";

const initial: AddState = { status: "idle" };
const field = "rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900";

export function AddDocument() {
  const [state, action, pending] = useActionState(addDocument, initial);
  return (
    <details className="rounded-2xl border border-slate-200 p-5">
      <summary className="cursor-pointer font-medium">+ {el.dashboard.add}</summary>
      <form action={action} key={state.status === "ok" ? Date.now() : "form"} className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm sm:col-span-3">
          {el.dashboard.addTitle}
          <input name="title" required maxLength={120} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {el.dashboard.addType}
          <select name="type" className={field} defaultValue="other">
            {Object.entries(el.types).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {el.dashboard.addDate}
          <input type="date" name="expires_on" className={field} />
        </label>
        <button disabled={pending} className="self-end rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-60">
          {el.dashboard.addCta}
        </button>
        {state.status === "error" && <p className="text-sm text-red-600 sm:col-span-3">{state.message}</p>}
      </form>
    </details>
  );
}
