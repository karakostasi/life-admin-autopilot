"use client";

import { useActionState } from "react";
import el from "@/messages/el.json";
import { sendMagicLink, verifyCode, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm({ callbackError }: { callbackError: boolean }) {
  const [state, action, pending] = useActionState(sendMagicLink, initial);
  const [codeState, codeAction, verifying] = useActionState(verifyCode, initial);

  if (state.status === "sent") {
    return (
      <form action={codeAction} className="flex flex-col gap-4">
        <p className="rounded-lg bg-emerald-50 p-4 text-emerald-800">{state.message}</p>
        <input type="hidden" name="email" value={state.email} />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{el.auth.codeLabel}</span>
          <input
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            autoFocus
            className="input text-center text-2xl font-bold tracking-[0.4em]"
          />
        </label>
        <button type="submit" disabled={verifying} className="btn-primary py-3">
          {verifying ? el.auth.verifying : el.auth.codeCta}
        </button>
        {codeState.status !== "idle" && codeState.message && <p className="text-sm text-red-600">{codeState.message}</p>}
        <p className="text-sm text-slate-500">{el.auth.codeAlt}</p>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{el.auth.email}</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="input"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="btn-primary py-3"
      >
        {pending ? el.auth.sending : el.auth.cta}
      </button>
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
      {callbackError && state.status === "idle" && <p className="text-sm text-red-600">{el.auth.callbackError}</p>}
    </form>
  );
}
