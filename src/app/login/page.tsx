import el from "@/messages/el.json";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">{el.auth.title}</h1>
      <p className="text-slate-600">{el.auth.subtitle}</p>
      <LoginForm callbackError={error === "1"} />
    </main>
  );
}
