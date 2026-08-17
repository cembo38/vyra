import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getCurrentUser } from "@/lib/auth";
import { getSupplierAccountByOwner, getSupplierLeads, getSupplierOrders } from "@/lib/data/store";
import { formatCurrency } from "@/lib/config";
import { ChevronLeft, ChevronRight, Clock, PartyPopper } from "lucide-react";

export const metadata = { title: "Kalender — Vyra voor leveranciers" };

const WEEKDAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function dateKey(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function monthKeyOf(y: number, m: number) {
  return `${y}-${pad(m + 1)}`;
}

type DayEntry = {
  key: string;
  day: number;
  inMonth: boolean;
  bookings: { label: string; amount: number }[];
  deadlines: { label: string; requestId: string }[];
};

export default async function SupplierCalendarPage(props: PageProps<"/supplier/calendar">) {
  const params = await props.searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) redirect("/supplier/onboarding");

  const now = new Date();
  let year = now.getFullYear();
  let monthIndex = now.getMonth();
  const monthParam = typeof params.month === "string" ? params.month : null;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    if (y && m >= 1 && m <= 12) {
      year = y;
      monthIndex = m - 1;
    }
  }

  const monthStart = new Date(year, monthIndex, 1);
  const dow = monthStart.getDay(); // 0=zo..6=za
  const mondayOffset = (dow + 6) % 7;
  const gridStart = new Date(year, monthIndex, 1 - mondayOffset);

  const [orders, leads] = await Promise.all([getSupplierOrders(supplier.id), getSupplierLeads(supplier.id)]);

  const days: DayEntry[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    days.push({ key, day: d.getDate(), inMonth: d.getMonth() === monthIndex, bookings: [], deadlines: [] });
  }
  const dayByKey = new Map(days.map((d) => [d.key, d]));

  for (const { offer, event } of orders) {
    if (!event?.date) continue;
    const entry = dayByKey.get(event.date);
    if (entry) entry.bookings.push({ label: event.name, amount: offer.totalPriceCents });
  }
  for (const lead of leads) {
    if (lead.target.status !== "pending") continue;
    const deadlineDate = lead.request.deadlineAt.slice(0, 10);
    const entry = dayByKey.get(deadlineDate);
    if (entry) entry.deadlines.push({ label: lead.event.name, requestId: lead.request.id });
  }

  const monthLabel = monthStart.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
  const prev = new Date(year, monthIndex - 1, 1);
  const next = new Date(year, monthIndex + 1, 1);

  const agenda = days
    .filter((d) => d.inMonth && (d.bookings.length > 0 || d.deadlines.length > 0))
    .sort((a, b) => a.key.localeCompare(b.key));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl capitalize text-ink">{monthLabel}</h1>
          <p className="mt-1 text-ink-soft">Je geboekte evenementen en openstaande aanvraagdeadlines in één overzicht.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/supplier/calendar?month=${monthKeyOf(prev.getFullYear(), prev.getMonth())}`} className="rounded-full border border-line p-2 text-ink-soft hover:bg-paper-dim" aria-label="Vorige maand">
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={`/supplier/calendar?month=${monthKeyOf(now.getFullYear(), now.getMonth())}`} className="rounded-full border border-line px-3 py-2 text-xs font-medium text-ink-soft hover:bg-paper-dim">
            Vandaag
          </Link>
          <Link href={`/supplier/calendar?month=${monthKeyOf(next.getFullYear(), next.getMonth())}`} className="rounded-full border border-line p-2 text-ink-soft hover:bg-paper-dim" aria-label="Volgende maand">
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4 text-xs text-ink-faint">
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-sage" /> Boeking</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-ochre" /> Aanvraagdeadline</span>
      </div>

      {/* Volle maand-grid: cellen van ~50px op een telefoon van 375px zijn te
          dicht om nauwkeurig te tikken — vanaf `md` (iPad-portret) is er
          genoeg ruimte om deze interactief te tonen. */}
      <Card className="mt-3 hidden p-0 md:block">
        <div className="grid grid-cols-7 border-b border-line-soft text-center text-xs font-medium uppercase tracking-wide text-ink-faint">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="py-2">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => (
            <div
              key={d.key}
              className={`min-h-24 border-b border-r border-line-soft p-1.5 last:border-r-0 ${d.inMonth ? "" : "bg-paper-dim/40"}`}
            >
              <p className={`text-xs ${d.inMonth ? "text-ink" : "text-ink-faint"}`}>{d.day}</p>
              <div className="mt-1 space-y-0.5">
                {d.bookings.slice(0, 2).map((b, i) => (
                  <p key={`b-${i}`} className="truncate rounded bg-sage-50 px-1 py-0.5 text-[10px] font-medium text-sage-dark" title={b.label}>
                    {b.label}
                  </p>
                ))}
                {d.deadlines.slice(0, 2).map((dl, i) => (
                  <p key={`d-${i}`} className="truncate rounded bg-ochre-50 px-1 py-0.5 text-[10px] font-medium text-ochre" title={dl.label}>
                    {dl.label}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Telefoon-only: op een klein scherm is een lijst overzichtelijker en
          beter aan te tikken dan een dichte maand-grid. */}
      <div className="md:hidden">
        <h2 className="mb-3 mt-8 font-display text-lg text-ink">Deze maand</h2>
        {agenda.length === 0 ? (
          <Card><p className="text-sm text-ink-faint">Geen boekingen of deadlines deze maand.</p></Card>
        ) : (
          <div className="space-y-2">
            {agenda.map((d) => (
              <Card key={d.key} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <span className="text-sm font-medium text-ink">{d.key}</span>
                <div className="flex flex-wrap items-center gap-2">
                  {d.bookings.map((b, i) => (
                    <Badge key={`b-${i}`} tone="sage" icon={<PartyPopper className="size-3" />}>
                      {b.label} · {formatCurrency(b.amount)}
                    </Badge>
                  ))}
                  {d.deadlines.map((dl, i) => (
                    <Link key={`d-${i}`} href={`/supplier/requests/${dl.requestId}`}>
                      <Badge tone="ochre" icon={<Clock className="size-3" />}>Deadline: {dl.label}</Badge>
                    </Link>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
