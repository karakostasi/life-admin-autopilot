import { stripPlate } from "@/lib/vehicles";

// Τίτλος εγγράφου με την πινακίδα (identifier) σε bold, ώστε να φαίνεται αμέσως για ποιο όχημα πρόκειται.
export function DocTitle({ title, identifier }: { title: string; identifier: string | null }) {
  const plate = identifier?.trim();
  if (!plate) return <p className="truncate font-semibold">{title}</p>;

  return (
    <p className="flex min-w-0 items-center gap-2">
      <span className="truncate font-semibold">{stripPlate(title, plate)}</span>
      <Plate>{plate}</Plate>
    </p>
  );
}

export function Plate({ children, large }: { children: React.ReactNode; large?: boolean }) {
  return (
    <strong
      className={`shrink-0 rounded-md border border-slate-300 bg-slate-100 font-extrabold tracking-wider text-slate-900 ${large ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}
    >
      {children}
    </strong>
  );
}
