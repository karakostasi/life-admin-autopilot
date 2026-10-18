"use client";

import { useActionState } from "react";
import el from "@/messages/el.json";
import { sendMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm({ callbackError }: { callbackError: boolean }) {
  const [state, action, pending] = useActionState(sendMagicLink, initial);

  if (state.status === "sent") {
    return <p className="rounded-lg bg-emerald-50 p-4 text-emerald-800">{state.message}</p>;
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
