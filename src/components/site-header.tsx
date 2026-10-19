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
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100/85 shadow-sm shadow-slate-300/30 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-sm font-bold text-white shadow-sm">✓</span>
          <span className="hidden sm:inline">Θύμισέ μου</span>
        </Link>

        {user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/dashboard" className="btn-secondary !px-3 !py-2 !text-xs sm:!px-4 sm:!text-sm">
              {el.header.dashboard}
            </Link>
            <Link href="/dashboard/subscriptions" className="btn-secondary !px-3 !py-2 !text-xs sm:!px-4 sm:!text-sm">
              {el.subscriptions.link}
            </Link>
            <UserMenu initials={initials(user.user_metadata?.full_name, user.email)} email={user.email ?? ""} />
          </div>
        ) : (
          <Link href="/login" className="btn-dark !px-4 !py-2">
            {el.header.login}
          </Link>
        )}
      </div>
    </header>
  );
}
