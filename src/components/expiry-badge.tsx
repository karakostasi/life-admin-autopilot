import el from "@/messages/el.json";
import type { ExpiryStatus } from "@/lib/expiry";

export const STATUS_STYLES: Record<ExpiryStatus, { badge: string; border: string; dot: string }> = {
  expired: { badge: "bg-red-100 text-red-800", border: "border-l-red-500", dot: "bg-red-500" },
  soon: { badge: "bg-orange-100 text-orange-800", border: "border-l-orange-500", dot: "bg-orange-500" },
  ok: { badge: "bg-emerald-100 text-emerald-800", border: "border-l-emerald-500", dot: "bg-emerald-500" },
  unknown: { badge: "bg-slate-100 text-slate-700", border: "border-l-slate-300", dot: "bg-slate-300" },
};

const plural = (n: number) => `${n} ${n === 1 ? el.status.day : el.status.days}`;

export function statusLabel(status: ExpiryStatus, days: number | null): string {
  if (days === null) return el.status.unknown;
  if (status === "expired") return el.status.expiredAgo.replace("{n}", plural(Math.abs(days)));
  if (days === 0) return el.status.today;
  if (status === "soon") return el.status.inDays.replace("{n}", plural(days));
  return el.status.validFor.replace("{n}", plural(days));
}

export function ExpiryBadge({ status, days }: { status: ExpiryStatus; days: number | null }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status].badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[status].dot}`} />
      {statusLabel(status, days)}
    </span>
  );
}
