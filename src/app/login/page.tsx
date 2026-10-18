import el from "@/messages/el.json";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-6 py-16">
      <div className="card flex flex-col gap-6 p-8 shadow-xl shadow-slate-200/60">
      <h1 className="text-3xl font-bold tracking-tight">{el.auth.title}</h1>
      <p className="text-slate-600">{el.auth.subtitle}</p>
      <LoginForm callbackError={error === "1"} />
      </div>
    </main>
  );
}
