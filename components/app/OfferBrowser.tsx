"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Heart, X, ArrowRight, Undo2, Star, ShieldCheck, ListChecks, Rows3, Columns3, CheckCircle2, Loader2, ExternalLink, PiggyBank } from "lucide-react";
import { SupplierAvatar } from "@/components/ui/Avatar";
import { Badge, OfferStatusBadge } from "@/components/ui/Badge";
import { formatCurrency, DEFAULT_DEPOSIT_PERCENT } from "@/lib/config";
import { swipeOfferAction, acceptOfferAction } from "@/lib/actions/marketplace-actions";
import { cn } from "@/lib/utils";
import { OfferOption, SupplierProfile } from "@/lib/types";

export interface OfferWithSupplier extends OfferOption {
  supplier: SupplierProfile;
}

export function OfferBrowser({ offers, categoryLabel }: { offers: OfferWithSupplier[]; categoryLabel: string }) {
  const [view, setView] = useState<"swipe" | "list" | "compare">("swipe");
  const undecided = useMemo(() => offers.filter((o) => o.swipeDecision === "none" && o.status !== "accepted"), [offers]);
  const decided = useMemo(() => offers.filter((o) => o.swipeDecision !== "none" || o.status === "accepted"), [offers]);
  // Zodra één offerte in deze categorie is geaccepteerd, mag er geen tweede
  // meer geaccepteerd worden (dat zou een dubbele boeking/betaling
  // opleveren — zie de server-side bescherming in createPaymentForOffer()
  // in lib/data/store.ts). De knoppen hieronder verdwijnen daarom bij de
  // overige offertes zodra dit het geval is, in plaats van dat een klik
  // stilzwijgend niets doet.
  const categoryHasAccepted = useMemo(() => offers.some((o) => o.status === "accepted"), [offers]);

  if (offers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center text-ink-faint">
        Nog geen offertes ontvangen voor {categoryLabel.toLowerCase()}. Je krijgt bericht zodra een leverancier reageert.
      </div>
    );
  }

  return (
    <div>
      {/* flex-col op mobiel: de 3-knops weergavewissel duwde de tellertekst
          er bij smalle viewports zo veel onder druk dat elk woord op een
          eigen regel viel (bv. "3" / "offertes" / "voor" / "catering") —
          zie de Playwright-screenshots uit de mobiel-verbeterronde. */}
      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-faint">{offers.length} offerte{offers.length !== 1 ? "s" : ""} voor {categoryLabel.toLowerCase()}</p>
        <div className="flex items-center gap-1 rounded-full border border-line bg-white p-1">
          <button
            onClick={() => setView("swipe")}
            className={cn("chip-hover flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium", view === "swipe" ? "bg-ink text-paper" : "text-ink-soft")}
          >
            <Rows3 className="size-3.5" /> Swipe
          </button>
          <button
            onClick={() => setView("list")}
            className={cn("chip-hover flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium", view === "list" ? "bg-ink text-paper" : "text-ink-soft")}
          >
            <ListChecks className="size-3.5" /> Lijst
          </button>
          <button
            onClick={() => setView("compare")}
            className={cn("chip-hover flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium", view === "compare" ? "bg-ink text-paper" : "text-ink-soft")}
          >
            <Columns3 className="size-3.5" /> Vergelijken
          </button>
        </div>
      </div>

      {view === "swipe" && <SwipeStack offers={undecided} />}
      {view === "list" && <OfferList offers={offers} categoryHasAccepted={categoryHasAccepted} />}
      {view === "compare" && (
        <>
          {/* Volle tabel (8 kolommen, min-w-[820px]) past pas comfortabel vanaf
              `lg` (iPad landscape en groter); daaronder de kaartenlijst. */}
          <CompareTable offers={offers} categoryHasAccepted={categoryHasAccepted} />
          <CompareCardList offers={offers} categoryHasAccepted={categoryHasAccepted} />
        </>
      )}

      {decided.length > 0 && view === "swipe" && (
        <div className="mt-10">
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-faint">Beslist</h3>
          <OfferList offers={decided} compact categoryHasAccepted={categoryHasAccepted} />
        </div>
      )}
    </div>
  );
}

function SwipeStack({ offers }: { offers: OfferWithSupplier[] }) {
  const [queue, setQueue] = useState(offers);
  const [history, setHistory] = useState<{ offer: OfferWithSupplier }[]>([]);
  const [pending, startTransition] = useTransition();

  function decide(decision: "shortlisted" | "rejected") {
    const [current, ...rest] = queue;
    if (!current) return;
    setQueue(rest);
    setHistory((h) => [...h, { offer: current }]);
    startTransition(async () => { await swipeOfferAction(current.id, decision); });
  }

  function skip() {
    const [current, ...rest] = queue;
    if (!current) return;
    setQueue([...rest, current]);
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setQueue((q) => [last.offer, ...q]);
    startTransition(async () => { await swipeOfferAction(last.offer.id, "none"); });
  }

  if (queue.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center text-ink-faint">
        {history.length > 0 ? "Je hebt alle offertes bekeken. Scroll naar 'Beslist' hieronder, of bekijk je shortlist." : "Geen offertes om te bekijken."}
        {history.length > 0 && (
          <button onClick={undo} className="mx-auto mt-4 flex items-center gap-1.5 text-sm font-medium text-clay">
            <Undo2 className="size-4" /> Vorige terugzetten
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      {/* Vaste 480px viel op korte telefoons (bv. iPhone SE) deels buiten
          beeld door de omringende chrome; krimpt nu mee met de viewport
          maar wordt nooit groter dan de oorspronkelijke 480px. */}
      <div className="relative h-[min(30rem,58dvh)]">
        <AnimatePresence>
          {queue
            .slice(0, 3)
            .reverse()
            .map((offer, i, arr) => {
              const isTop = i === arr.length - 1;
              return (
                <SwipeCard
                  key={offer.id}
                  offer={offer}
                  stackIndex={arr.length - 1 - i}
                  interactive={isTop}
                  onDecide={decide}
                />
              );
            })}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          onClick={() => decide("rejected")}
          disabled={pending}
          aria-label="Niet interessant"
          className="icon-pop flex size-14 items-center justify-center rounded-full border border-line bg-white text-danger shadow-sm"
        >
          <X className="size-6" />
        </button>
        <button
          onClick={undo}
          disabled={history.length === 0}
          aria-label="Ongedaan maken"
          className="icon-pop flex size-11 items-center justify-center rounded-full border border-line bg-white text-ink-faint shadow-sm disabled:opacity-30 disabled:pointer-events-none"
        >
          <Undo2 className="size-4.5" />
        </button>
        <button
          onClick={skip}
          aria-label="Volgende"
          className="icon-pop flex size-11 items-center justify-center rounded-full border border-line bg-white text-ink-faint shadow-sm"
        >
          <ArrowRight className="size-4.5" />
        </button>
        <button
          onClick={() => decide("shortlisted")}
          disabled={pending}
          aria-label="Toevoegen aan shortlist"
          className="icon-pop flex size-14 items-center justify-center rounded-full border border-line bg-white text-clay shadow-sm"
        >
          <Heart className="size-6" />
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-ink-faint">Swipe naar rechts om te shortlisten, naar links voor niet interessant.</p>
    </div>
  );
}

function SwipeCard({ offer, stackIndex, interactive, onDecide }: { offer: OfferWithSupplier; stackIndex: number; interactive: boolean; onDecide: (d: "shortlisted" | "rejected") => void }) {
  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 120) onDecide("shortlisted");
    else if (info.offset.x < -120) onDecide("rejected");
  }

  return (
    <motion.div
      className="absolute inset-0 origin-bottom cursor-grab overflow-hidden rounded-[28px] border border-line bg-white active:cursor-grabbing"
      style={{ boxShadow: "var(--shadow-pop)", zIndex: 10 - stackIndex }}
      drag={interactive ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={interactive ? handleDragEnd : undefined}
      initial={{ scale: 1 - stackIndex * 0.04, y: stackIndex * 12, opacity: stackIndex > 2 ? 0 : 1 }}
      animate={{ scale: 1 - stackIndex * 0.04, y: stackIndex * 12, opacity: 1 }}
      exit={{ x: 400, opacity: 0, rotate: 20, transition: { duration: 0.3 } }}
      whileDrag={{ rotate: 6 }}
    >
      <div className="flex h-40 items-end p-5" style={{ background: `linear-gradient(135deg, ${offer.supplier.photoGradient[0]}, ${offer.supplier.photoGradient[1]})` }}>
        <div className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-ink">{offer.matchScore}% match</div>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-xl text-ink">{offer.supplier.companyName}</h3>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-ink-faint">
              {offer.supplier.ratingCount > 0 ? (
                <>
                  <Star className="size-3.5 fill-ochre text-ochre" /> {offer.supplier.ratingAvg.toFixed(1)} ({offer.supplier.ratingCount})
                </>
              ) : (
                <span>Nog geen reviews</span>
              )}
              {offer.supplier.verified && <ShieldCheck className="ml-1 size-3.5 text-sage" />}
            </div>
          </div>
          <p className="font-display text-xl text-ink">{formatCurrency(offer.totalPriceCents)}</p>
        </div>
        <p className="mt-3 line-clamp-2 text-sm text-ink-soft">{offer.supplier.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {offer.includes.slice(0, 3).map((inc) => (
            <Badge key={inc} tone="neutral">{inc}</Badge>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-faint">{offer.matchRationale}</p>
      </div>
    </motion.div>
  );
}

function CompareTable({ offers, categoryHasAccepted }: { offers: OfferWithSupplier[]; categoryHasAccepted: boolean }) {
  const [pending, startTransition] = useTransition();
  const sorted = useMemo(() => [...offers].sort((a, b) => b.matchScore - a.matchScore), [offers]);

  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-line [box-shadow:var(--shadow-card)] lg:block">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line-soft bg-paper-dim text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
            <th className="px-4 py-3">Leverancier</th>
            <th className="px-4 py-3">Prijs</th>
            <th className="px-4 py-3">Match</th>
            <th className="px-4 py-3">Beoordeling</th>
            <th className="px-4 py-3">Inbegrepen</th>
            <th className="px-4 py-3">Reactietijd</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((offer) => (
            <tr key={offer.id} className="border-b border-line-soft transition-colors last:border-0 hover:bg-paper-dim/60">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <SupplierAvatar gradient={offer.supplier.photoGradient} initials={offer.supplier.initials} imageUrl={offer.supplier.logoUrl} verified={offer.supplier.verified} size={32} />
                  {offer.supplier.isReal ? (
                    <Link href={`/leveranciers/${offer.supplier.id}`} target="_blank" className="flex items-center gap-1 font-medium text-ink hover:text-sage hover:underline">
                      {offer.supplier.companyName} <ExternalLink className="size-3 shrink-0" />
                    </Link>
                  ) : (
                    <span className="font-medium text-ink">{offer.supplier.companyName}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap font-display text-base text-ink">{formatCurrency(offer.totalPriceCents)}</td>
              <td className="px-4 py-3"><Badge tone="sage">{offer.matchScore}%</Badge></td>
              <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                {offer.supplier.ratingCount > 0 ? (
                  <span className="flex items-center gap-1"><Star className="size-3.5 fill-ochre text-ochre" /> {offer.supplier.ratingAvg.toFixed(1)}</span>
                ) : (
                  "Nog geen reviews"
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex max-w-[220px] flex-wrap gap-1">
                  {offer.includes.slice(0, 3).map((inc) => (
                    <Badge key={inc} tone="neutral">{inc}</Badge>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-ink-soft">± {offer.supplier.avgResponseHours} uur</td>
              <td className="px-4 py-3"><OfferStatusBadge status={offer.status} /></td>
              <td className="px-4 py-3">
                {offer.status === "accepted" ? (
                  <span className="flex items-center justify-end gap-1 text-xs font-medium text-success"><CheckCircle2 className="size-3.5" /> Geaccepteerd</span>
                ) : categoryHasAccepted ? (
                  <span className="flex items-center justify-end text-xs text-ink-faint">Andere offerte geaccepteerd</span>
                ) : (
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      disabled={pending}
                      onClick={() => startTransition(async () => { await swipeOfferAction(offer.id, "shortlisted"); })}
                      aria-label="Shortlist"
                      className="icon-pop flex size-9 items-center justify-center rounded-full bg-paper-dim text-ink"
                    >
                      <Heart className="size-3.5" />
                    </button>
                    <button
                      disabled={pending}
                      onClick={() => startTransition(() => acceptOfferAction(offer.id, "full"))}
                      aria-label="Accepteren — volledig betalen"
                      title="Accepteren — volledig betalen"
                      className="icon-pop flex size-9 items-center justify-center rounded-full bg-clay text-white"
                    >
                      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                    </button>
                    <button
                      disabled={pending}
                      onClick={() => startTransition(() => acceptOfferAction(offer.id, "deposit"))}
                      aria-label={`Accepteren met aanbetaling (${Math.round(DEFAULT_DEPOSIT_PERCENT * 100)}%)`}
                      title={`Accepteren met aanbetaling (${Math.round(DEFAULT_DEPOSIT_PERCENT * 100)}%), rest later`}
                      className="icon-pop flex size-9 items-center justify-center rounded-full bg-paper-dim text-ink"
                    >
                      <PiggyBank className="size-3.5" />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Kaarten-variant van de vergelijkingstabel voor `< lg` (telefoon en
 * iPad-portret). Geen opgeschaalde telefoon-view: 1 kolom op telefoon,
 * 2 kolommen vanaf `sm` — op iPad-portret staan er dus al 2 offertes
 * naast elkaar te vergelijken, i.p.v. een enkele, lange lijst.
 */
function CompareCardList({ offers, categoryHasAccepted }: { offers: OfferWithSupplier[]; categoryHasAccepted: boolean }) {
  const [pending, startTransition] = useTransition();
  const sorted = useMemo(() => [...offers].sort((a, b) => b.matchScore - a.matchScore), [offers]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
      {sorted.map((offer) => (
        <div key={offer.id} className="rounded-2xl border border-line bg-white p-4 [box-shadow:var(--shadow-card)]">
          <div className="flex items-center gap-2.5">
            <SupplierAvatar gradient={offer.supplier.photoGradient} initials={offer.supplier.initials} imageUrl={offer.supplier.logoUrl} verified={offer.supplier.verified} size={36} />
            <div className="min-w-0 flex-1">
              {offer.supplier.isReal ? (
                <Link href={`/leveranciers/${offer.supplier.id}`} target="_blank" className="flex min-w-0 items-center gap-1 truncate font-medium text-ink hover:text-sage hover:underline">
                  <span className="truncate">{offer.supplier.companyName}</span> <ExternalLink className="size-3 shrink-0" />
                </Link>
              ) : (
                <p className="truncate font-medium text-ink">{offer.supplier.companyName}</p>
              )}
            </div>
            <OfferStatusBadge status={offer.status} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-paper-dim/60 px-3 py-2.5 text-sm">
            <div>
              <p className="text-xs text-ink-faint">Prijs</p>
              <p className="font-display text-base text-ink">{formatCurrency(offer.totalPriceCents)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-faint">Match</p>
              <Badge tone="sage">{offer.matchScore}%</Badge>
            </div>
            <div>
              <p className="text-xs text-ink-faint">Beoordeling</p>
              {offer.supplier.ratingCount > 0 ? (
                <span className="flex items-center gap-1 text-ink-soft"><Star className="size-3.5 fill-ochre text-ochre" /> {offer.supplier.ratingAvg.toFixed(1)}</span>
              ) : (
                <span className="text-ink-soft">Nog geen reviews</span>
              )}
            </div>
            <div>
              <p className="text-xs text-ink-faint">Reactietijd</p>
              <p className="text-ink-soft">± {offer.supplier.avgResponseHours} uur</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {offer.includes.slice(0, 3).map((inc) => (
              <Badge key={inc} tone="neutral">{inc}</Badge>
            ))}
          </div>

          {offer.status === "accepted" ? (
            <div className="mt-3 flex items-center justify-end gap-1 text-xs font-medium text-success">
              <CheckCircle2 className="size-3.5" /> Geaccepteerd
            </div>
          ) : categoryHasAccepted ? (
            <div className="mt-3 flex items-center justify-end text-xs text-ink-faint">Andere offerte geaccepteerd</div>
          ) : (
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                disabled={pending}
                onClick={() => startTransition(async () => { await swipeOfferAction(offer.id, "shortlisted"); })}
                aria-label="Shortlist"
                className="icon-pop flex size-10 items-center justify-center rounded-full bg-paper-dim text-ink"
              >
                <Heart className="size-4" />
              </button>
              <button
                disabled={pending}
                onClick={() => startTransition(() => acceptOfferAction(offer.id, "deposit"))}
                aria-label={`Accepteren met aanbetaling (${Math.round(DEFAULT_DEPOSIT_PERCENT * 100)}%)`}
                title={`Accepteren met aanbetaling (${Math.round(DEFAULT_DEPOSIT_PERCENT * 100)}%), rest later`}
                className="icon-pop flex size-10 items-center justify-center rounded-full bg-paper-dim text-ink"
              >
                <PiggyBank className="size-4" />
              </button>
              <button
                disabled={pending}
                onClick={() => startTransition(() => acceptOfferAction(offer.id, "full"))}
                aria-label="Accepteren — volledig betalen"
                title="Accepteren — volledig betalen"
                className="icon-pop flex size-10 items-center justify-center rounded-full bg-clay text-white"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function OfferList({ offers, compact, categoryHasAccepted }: { offers: OfferWithSupplier[]; compact?: boolean; categoryHasAccepted: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {offers.map((offer) => (
        <OfferListCard key={offer.id} offer={offer} compact={compact} categoryHasAccepted={categoryHasAccepted} />
      ))}
    </div>
  );
}

function OfferListCard({ offer, compact, categoryHasAccepted }: { offer: OfferWithSupplier; compact?: boolean; categoryHasAccepted: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start gap-3">
        <SupplierAvatar
          gradient={offer.supplier.photoGradient}
          initials={offer.supplier.initials}
          imageUrl={offer.supplier.logoUrl}
          verified={offer.supplier.verified}
          size={44}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {offer.supplier.isReal ? (
              <Link href={`/leveranciers/${offer.supplier.id}`} target="_blank" className="flex min-w-0 items-center gap-1 truncate font-medium text-ink hover:text-sage hover:underline">
                <span className="truncate">{offer.supplier.companyName}</span> <ExternalLink className="size-3 shrink-0" />
              </Link>
            ) : (
              <p className="truncate font-medium text-ink">{offer.supplier.companyName}</p>
            )}
            <OfferStatusBadge status={offer.status} />
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
            {offer.supplier.ratingCount > 0 ? (
              <>
                <Star className="size-3 fill-ochre text-ochre" /> {offer.supplier.ratingAvg.toFixed(1)}
              </>
            ) : (
              <span>Nog geen reviews</span>
            )}
            <span className="mx-1">·</span>
            {offer.matchScore}% match
          </div>
        </div>
      </div>

      <p className="mt-3 font-display text-2xl text-ink">{formatCurrency(offer.totalPriceCents)}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {offer.includes.slice(0, compact ? 2 : 4).map((inc) => (
          <Badge key={inc} tone="success">{inc}</Badge>
        ))}
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-line-soft pt-3 text-xs text-ink-soft">
          {offer.excludes.length > 0 && <p><span className="font-medium text-ink">Niet inbegrepen:</span> {offer.excludes.join(", ")}</p>}
          {offer.extraCostsNote && <p><span className="font-medium text-ink">Extra kosten:</span> {offer.extraCostsNote}</p>}
          <p><span className="font-medium text-ink">Annulering:</span> {offer.cancellationPolicy}</p>
          <p><span className="font-medium text-ink">Betaling:</span> {offer.paymentTerms}</p>
          <p className="italic">{offer.matchRationale}</p>
        </div>
      )}

      <button onClick={() => setExpanded((v) => !v)} className="-ml-1 mt-2 rounded-lg px-1 py-2 text-xs font-medium text-ink-faint underline underline-offset-2">
        {expanded ? "Minder details" : "Meer details"}
      </button>

      {!compact && (
        <div className="mt-4 flex flex-wrap gap-2">
          {offer.status !== "accepted" && !categoryHasAccepted && (
            <>
              <button
                disabled={pending}
                onClick={() => startTransition(async () => { await swipeOfferAction(offer.id, "shortlisted"); })}
                className="chip-hover inline-flex items-center gap-1.5 rounded-full bg-paper-dim px-3 py-1.5 text-xs font-medium text-ink hover:bg-line"
              >
                <Heart className="size-3.5" /> Shortlist
              </button>
              <button
                disabled={pending}
                onClick={() => startTransition(async () => { await swipeOfferAction(offer.id, "rejected"); })}
                className="chip-hover inline-flex items-center gap-1.5 rounded-full bg-paper-dim px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-line"
              >
                <X className="size-3.5" /> Afwijzen
              </button>
              <button
                disabled={pending}
                onClick={() => startTransition(() => acceptOfferAction(offer.id, "deposit"))}
                title={`Aanbetaling van ${Math.round(DEFAULT_DEPOSIT_PERCENT * 100)}% nu, rest later`}
                className="chip-hover ml-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-clay/50 hover:text-ink"
              >
                <PiggyBank className="size-3.5" /> {Math.round(DEFAULT_DEPOSIT_PERCENT * 100)}% aanbetalen
              </button>
              <button
                disabled={pending}
                onClick={() => startTransition(() => acceptOfferAction(offer.id, "full"))}
                className="chip-hover inline-flex items-center gap-1.5 rounded-full bg-clay px-3.5 py-1.5 text-xs font-medium text-white hover:bg-clay-dark"
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Accepteren →"}
              </button>
            </>
          )}
          {offer.status === "accepted" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
              <CheckCircle2 className="size-4" /> Geaccepteerd
            </span>
          )}
          {offer.status !== "accepted" && categoryHasAccepted && (
            <span className="text-xs text-ink-faint">Je hebt al een andere offerte in deze categorie geaccepteerd.</span>
          )}
        </div>
      )}
    </div>
  );
}
