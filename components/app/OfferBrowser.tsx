"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Heart, X, ArrowRight, Undo2, Star, ShieldCheck, ListChecks, Rows3, CheckCircle2, Loader2 } from "lucide-react";
import { SupplierAvatar } from "@/components/ui/Avatar";
import { Badge, OfferStatusBadge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/config";
import { swipeOfferAction, acceptOfferAction } from "@/lib/actions/marketplace-actions";
import { cn } from "@/lib/utils";
import { OfferOption, SupplierProfile } from "@/lib/types";

export interface OfferWithSupplier extends OfferOption {
  supplier: SupplierProfile;
}

export function OfferBrowser({ offers, categoryLabel }: { offers: OfferWithSupplier[]; categoryLabel: string }) {
  const [view, setView] = useState<"swipe" | "list">("swipe");
  const undecided = useMemo(() => offers.filter((o) => o.swipeDecision === "none" && o.status !== "accepted"), [offers]);
  const decided = useMemo(() => offers.filter((o) => o.swipeDecision !== "none" || o.status === "accepted"), [offers]);

  if (offers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center text-ink-faint">
        Nog geen offertes ontvangen voor {categoryLabel.toLowerCase()}. Je krijgt bericht zodra een leverancier reageert.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-ink-faint">{offers.length} offerte{offers.length !== 1 ? "s" : ""} voor {categoryLabel.toLowerCase()}</p>
        <div className="flex items-center gap-1 rounded-full border border-line bg-white p-1">
          <button
            onClick={() => setView("swipe")}
            className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors", view === "swipe" ? "bg-ink text-paper" : "text-ink-soft")}
          >
            <Rows3 className="size-3.5" /> Swipe
          </button>
          <button
            onClick={() => setView("list")}
            className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors", view === "list" ? "bg-ink text-paper" : "text-ink-soft")}
          >
            <ListChecks className="size-3.5" /> Lijst
          </button>
        </div>
      </div>

      {view === "swipe" ? <SwipeStack offers={undecided} /> : <OfferList offers={offers} />}

      {decided.length > 0 && view === "swipe" && (
        <div className="mt-10">
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-faint">Beslist</h3>
          <OfferList offers={decided} compact />
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
          <button onClick={undo} className="mx-auto mt-4 flex items-center gap-1.5 text-sm font-medium text-coral">
            <Undo2 className="size-4" /> Vorige terugzetten
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="relative h-[480px]">
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
          className="flex size-14 items-center justify-center rounded-full border border-line bg-white text-danger shadow-sm transition-transform hover:scale-105 active:scale-95"
        >
          <X className="size-6" />
        </button>
        <button
          onClick={undo}
          disabled={history.length === 0}
          aria-label="Ongedaan maken"
          className="flex size-11 items-center justify-center rounded-full border border-line bg-white text-ink-faint shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-30"
        >
          <Undo2 className="size-4.5" />
        </button>
        <button
          onClick={skip}
          aria-label="Volgende"
          className="flex size-11 items-center justify-center rounded-full border border-line bg-white text-ink-faint shadow-sm transition-transform hover:scale-105 active:scale-95"
        >
          <ArrowRight className="size-4.5" />
        </button>
        <button
          onClick={() => decide("shortlisted")}
          disabled={pending}
          aria-label="Toevoegen aan shortlist"
          className="flex size-14 items-center justify-center rounded-full border border-line bg-white text-coral shadow-sm transition-transform hover:scale-105 active:scale-95"
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
              <Star className="size-3.5 fill-gold text-gold" /> {offer.supplier.ratingAvg.toFixed(1)} ({offer.supplier.ratingCount})
              {offer.supplier.verified && <ShieldCheck className="ml-1 size-3.5 text-violet" />}
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

function OfferList({ offers, compact }: { offers: OfferWithSupplier[]; compact?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {offers.map((offer) => (
        <OfferListCard key={offer.id} offer={offer} compact={compact} />
      ))}
    </div>
  );
}

function OfferListCard({ offer, compact }: { offer: OfferWithSupplier; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start gap-3">
        <SupplierAvatar gradient={offer.supplier.photoGradient} initials={offer.supplier.initials} verified={offer.supplier.verified} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium text-ink">{offer.supplier.companyName}</p>
            <OfferStatusBadge status={offer.status} />
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
            <Star className="size-3 fill-gold text-gold" /> {offer.supplier.ratingAvg.toFixed(1)}
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

      <button onClick={() => setExpanded((v) => !v)} className="mt-3 text-xs font-medium text-ink-faint underline underline-offset-2">
        {expanded ? "Minder details" : "Meer details"}
      </button>

      {!compact && (
        <div className="mt-4 flex flex-wrap gap-2">
          {offer.status !== "accepted" && (
            <>
              <button
                disabled={pending}
                onClick={() => startTransition(async () => { await swipeOfferAction(offer.id, "shortlisted"); })}
                className="inline-flex items-center gap-1.5 rounded-full bg-paper-dim px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-line"
              >
                <Heart className="size-3.5" /> Shortlist
              </button>
              <button
                disabled={pending}
                onClick={() => startTransition(async () => { await swipeOfferAction(offer.id, "rejected"); })}
                className="inline-flex items-center gap-1.5 rounded-full bg-paper-dim px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-line"
              >
                <X className="size-3.5" /> Afwijzen
              </button>
              <button
                disabled={pending}
                onClick={() => startTransition(() => acceptOfferAction(offer.id))}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-coral-dark"
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
        </div>
      )}
    </div>
  );
}
