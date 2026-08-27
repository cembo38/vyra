import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { AppTopBar } from "@/components/app/AppTopBar";
import { BackLink } from "@/components/ui/BackLink";
import { Badge } from "@/components/ui/Badge";
import { ScrollFadeX } from "@/components/ui/ScrollFadeX";
import { SupplierAvatar } from "@/components/ui/Avatar";
import { getCurrentUser } from "@/lib/auth";
import { getSupplierAccount } from "@/lib/data/store";
import { SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { isTrustedSupplier, TRUST_BADGE_EXPLANATION } from "@/lib/trust";
import { formatCurrency } from "@/lib/config";
import { MapPin, ShieldCheck, Star } from "lucide-react";

export const metadata = { title: "Leveranciers vergelijken — Vyra" };

const MAX_COMPARE = 4;

export default async function CompareSuppliersPage(props: PageProps<"/leveranciers/vergelijk">) {
  const params = await props.searchParams;
  const idsParam = typeof params.ids === "string" ? params.ids : "";
  const ids = Array.from(new Set(idsParam.split(",").map((id) => id.trim()).filter(Boolean))).slice(0, MAX_COMPARE);

  const user = await getCurrentUser();
  const fetched = await Promise.all(ids.map((id) => getSupplierAccount(id)));
  const suppliers = fetched.filter((s): s is NonNullable<typeof s> => s !== null);

  const main = (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <BackLink fallbackHref="/leveranciers" label="Alle leveranciers" className="mb-3" />
      <h1 className="font-display text-2xl text-ink">Leveranciers vergelijken</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {suppliers.length > 0
          ? `${suppliers.length} leverancier${suppliers.length !== 1 ? "s" : ""} naast elkaar — kies hieronder degene die het best past.`
          : "Geen (geldige) leveranciers om te vergelijken."}
      </p>

      {suppliers.length < 2 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line px-6 py-14 text-center text-ink-faint">
          Selecteer minimaal 2 leveranciers via het vinkje &quot;Vergelijk&quot; op de{" "}
          <Link href="/leveranciers" className="font-medium text-clay hover:underline">zoekresultaten</Link>.
        </div>
      ) : (
        <ScrollFadeX
          variant="white"
          containerClassName="mt-6 overflow-hidden rounded-2xl border border-line bg-white [box-shadow:var(--shadow-card)]"
          className="overflow-x-auto"
        >
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line-soft">
                <th className="w-36 px-4 py-4 text-left text-xs font-medium uppercase tracking-wide text-ink-faint">&nbsp;</th>
                {suppliers.map((s) => (
                  <th key={s.id} className="min-w-[180px] px-4 py-4 text-left align-top">
                    <Link href={`/leveranciers/${s.id}`} className="group flex flex-col items-start gap-2">
                      <SupplierAvatar
                        gradient={["#E8C9A8", "#B5674A"]}
                        initials={s.companyName.slice(0, 2).toUpperCase()}
                        imageUrl={s.logoUrl}
                        verified={s.verified}
                        size={44}
                      />
                      <span className="font-medium text-ink group-hover:text-clay group-hover:underline">{s.companyName}</span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <CompareRow label="Vertrouwen">
                {suppliers.map((s) => (
                  <td key={s.id} className="px-4 py-3">
                    {isTrustedSupplier(s) ? (
                      <span title={TRUST_BADGE_EXPLANATION}>
                        <Badge tone="success" icon={<ShieldCheck className="size-3" />}>Vertrouwd</Badge>
                      </span>
                    ) : s.verified ? (
                      <Badge tone="success" icon={<ShieldCheck className="size-3" />}>Geverifieerd</Badge>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="Beoordeling">
                {suppliers.map((s) => (
                  <td key={s.id} className="px-4 py-3 whitespace-nowrap text-ink-soft">
                    {s.ratingCount > 0 ? (
                      <span className="flex items-center gap-1"><Star className="size-3.5 fill-ochre text-ochre" /> {s.ratingAvg.toFixed(1)} ({s.ratingCount})</span>
                    ) : (
                      "Nog geen reviews"
                    )}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="Reactietijd">
                {suppliers.map((s) => (
                  <td key={s.id} className="px-4 py-3 whitespace-nowrap text-ink-soft">± {s.avgResponseHours} uur</td>
                ))}
              </CompareRow>
              <CompareRow label="Categorie">
                {suppliers.map((s) => (
                  <td key={s.id} className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(s.categories.length > 0 ? s.categories : [s.category]).map((c) => (
                        <Badge key={c} tone="sage">{SUPPLIER_CATEGORY_LABELS[c]}</Badge>
                      ))}
                    </div>
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="Locatie">
                {suppliers.map((s) => (
                  <td key={s.id} className="px-4 py-3 whitespace-nowrap text-ink-soft">
                    <span className="flex items-center gap-1"><MapPin className="size-3.5 shrink-0" /> {s.baseLocation || "Onbekend"} · {s.serviceRadiusKm} km</span>
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="Prijs">
                {suppliers.map((s) => (
                  <td key={s.id} className="px-4 py-3 whitespace-nowrap font-display text-base text-ink">vanaf {formatCurrency(s.minPriceCents)}</td>
                ))}
              </CompareRow>
              <CompareRow label="Omschrijving" last>
                {suppliers.map((s) => (
                  <td key={s.id} className="max-w-[220px] px-4 py-3 text-xs text-ink-soft">{s.description}</td>
                ))}
              </CompareRow>
              <tr>
                <td className="px-4 py-4"></td>
                {suppliers.map((s) => (
                  <td key={s.id} className="px-4 py-4">
                    <Link
                      href={`/leveranciers/${s.id}`}
                      className="chip-hover inline-flex items-center rounded-full bg-ink px-3.5 py-2 text-xs font-medium text-paper hover:bg-ink/90"
                    >
                      Bekijk profiel
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </ScrollFadeX>
      )}
    </div>
  );

  if (user) {
    return (
      <div className="min-h-screen bg-paper">
        <AppTopBar />
        <div className="transition-[padding-left] duration-200 ease-in-out md:pl-[var(--nav-sidebar-w)]">{main}</div>
      </div>
    );
  }

  return (
    <>
      <MarketingHeader />
      {main}
      <Footer />
    </>
  );
}

function CompareRow({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <tr className={last ? "" : "border-b border-line-soft"}>
      <td className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</td>
      {children}
    </tr>
  );
}
