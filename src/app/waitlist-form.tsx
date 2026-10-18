"use client";

import { useActionState } from "react";
import el from "@/messages/el.json";
import { joinWaitlist, type WaitlistState } from "./actions";

const initial: WaitlistState = { status: "idle" };

export function WaitlistForm() {
  const [state, action, pending] = useActionState(joinWaitlist, initial);

  if (state.status === "ok") {
    return <p className="rounded-lg bg-emerald-50 p-4 text-emerald-800">{state.message}</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4 text-left">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{el.form.email}</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          {el.form.question} <span className="font-normal text-slate-500">({el.form.optional})</span>
        </span>
        <textarea
          name="answer"
          rows={2}
          maxLength={500}
          className="rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
        />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? el.form.sending : el.form.cta}
      </button>
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
