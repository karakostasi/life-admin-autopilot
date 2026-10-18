"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import el from "@/messages/el.json";
import { signOut } from "@/app/login/actions";

export function UserMenu({ initials, email }: { initials: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Κλείνει με κλικ έξω ή Escape
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={email}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        {initials}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <p className="truncate px-3 py-2 text-sm text-slate-500">{email}</p>
          <Link href="/dashboard" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
            {el.header.dashboard}
          </Link>
          <form action={signOut}>
            <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">{el.dashboard.signOut}</button>
          </form>
        </div>
      )}
    </div>
  );
}
