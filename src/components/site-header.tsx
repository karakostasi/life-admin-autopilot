import Link from "next/link";
import el from "@/messages/el.json";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "./user-menu";

// Αρχικά από το όνομα (αν υπάρχει) αλλιώς από το email: "nikos.p@x.gr" -> "NP"
function initials(name: string | undefined, email: string | undefined): string {
  const source = (name ?? "").trim() || (email ?? "").split("@")[0].replace(/[._-]+/g, " ").trim();
  const words = source.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : source.slice(0, 2);
  return letters.toLocaleUpperCase("el") || "?";
}

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm text-white">✓</span>
          Life Admin Autopilot
        </Link>

        {user ? (
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="hidden rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:block">
              {el.header.dashboard}
            </Link>
            <UserMenu initials={initials(user.user_metadata?.full_name, user.email)} email={user.email ?? ""} />
          </div>
        ) : (
          <Link href="/login" className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
            {el.header.login}
          </Link>
        )}
      </div>
    </header>
  );
}
