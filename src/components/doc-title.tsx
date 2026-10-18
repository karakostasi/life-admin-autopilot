const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Τίτλος εγγράφου με την πινακίδα (identifier) σε bold, ώστε να φαίνεται αμέσως για ποιο όχημα πρόκειται.
// Αν η πινακίδα υπάρχει ήδη μέσα στον τίτλο ("ΚΤΕΟ ΖΧΑ-1234"), βγαίνει από εκεί για να μην εμφανίζεται δύο φορές.
export function DocTitle({ title, identifier }: { title: string; identifier: string | null }) {
  const plate = identifier?.trim();
  if (!plate) return <p className="truncate font-semibold">{title}</p>;

  // ανεκτικό σε διαφορές κενών/παύλας: "ΖΧΑ 1234" = "ΖΧΑ-1234"
  const pattern = [...plate.replace(/[\s-]+/g, "")].map(escape).join("[\\s-]*");
  const stripped = title
    .replace(new RegExp(pattern, "i"), "")
    .replace(/\s*[-–·:]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return (
    <p className="flex min-w-0 items-center gap-2">
      <span className="truncate font-semibold">{stripped || title}</span>
      <strong className="shrink-0 rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-extrabold tracking-wider text-slate-900">{plate}</strong>
    </p>
  );
}
