import { redirect } from "next/navigation";
import el from "@/messages/el.json";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">{el.dashboard.title}</h1>
      <p className="text-slate-600">{el.dashboard.signedInAs.replace("{email}", user.email ?? "")}</p>
      <form action={signOut}>
        <button className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50">{el.dashboard.signOut}</button>
      </form>
    </main>
  );
}
