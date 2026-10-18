import el from "@/messages/el.json";
import { WaitlistForm } from "./waitlist-form";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{el.hero.title}</h1>
        <p className="text-lg text-slate-600">{el.hero.subtitle}</p>
      </header>

      <ol className="flex flex-col gap-3">
        {el.points.map((p, i) => (
          <li key={p} className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{p}</span>
          </li>
        ))}
      </ol>

      <WaitlistForm />

      <p className="text-sm text-slate-500">{el.trust}</p>
    </main>
  );
}
