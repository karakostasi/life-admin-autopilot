export type ExpiryStatus = "expired" | "soon" | "ok" | "unknown";

// Όριο για "προκειται να λήξει" (ευθυγραμμισμένο με τις υπενθυμίσεις 60/30/7)
export const SOON_DAYS = 60;

// Σημερινή ημερομηνία στην Ελλάδα (YYYY-MM-DD), ανεξάρτητα από το timezone του server
function todayInAthens(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(now);
}

function toUtcDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function expiryInfo(expiresOn: string | null, now = new Date()): { status: ExpiryStatus; days: number | null } {
  if (!expiresOn) return { status: "unknown", days: null };
  const days = Math.round((toUtcDay(expiresOn) - toUtcDay(todayInAthens(now))) / 86_400_000);
  if (days < 0) return { status: "expired", days };
  if (days <= SOON_DAYS) return { status: "soon", days };
  return { status: "ok", days };
}

// ISO -> dd/mm/yyyy
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
