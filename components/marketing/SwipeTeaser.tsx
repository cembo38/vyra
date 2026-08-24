"use client";

import { useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Heart, X, Star, ShieldCheck, RotateCcw, MoveRight } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/config";

/**
 * "Vyra in Beweging" — richting 3 ("Swipe-gevoel"), toegepast als het
 * "wow-moment" verderop op de homepage in plaats van in de hero zelf (zie
 * de aanbeveling onderaan het voorstel-artefact: richting 1 + 2 blijven in
 * de hero, richting 3 krijgt hier een eigen sectie). Dit is een pure demo —
 * geen server actions, geen echte data, niets wordt opgeslagen. De drie
 * kaarten en hun gegevens zijn ontleend aan echte demo-leveranciers uit
 * lib/data/suppliers.ts (Villa Zonnehof, Sound Collective, Moment
 * Photography) zodat de teaser herkenbaar aanvoelt als "dit is hoe het er
 * straks uitziet", i.p.v. verzonnen placeholder-content.
 *
 * De sleep-mechaniek (drag, dragElastic, whileDrag, AnimatePresence exit)
 * is bewust letterlijk hetzelfde patroon als de echte swipe-interface in
 * components/app/OfferBrowser.tsx — bezoekers die hier oefenen, herkennen
 * het meteen terug zodra ze na het starten van een evenement bij de echte
 * offertes komen.
 */
const DEMO_CARDS = [
  {
    id: "villa-zonnehof",
    companyName: "Villa Zonnehof",
    category: "Locatie",
    gradient: ["#B5674A", "#7C9468"] as const,
    priceCents: 350000,
    rating: 4.8,
    ratingCount: 63,
    verified: true,
    description: "Statige villa met tuin aan de rand van Amsterdam, plek voor tot 150 gasten, binnen en buiten.",
    tags: ["Buiten mogelijk", "Eigen catering toegestaan"],
  },
  {
    id: "sound-collective",
    companyName: "Sound Collective",
    category: "DJ & muziek",
    gradient: ["#7C9468", "#E2A438"] as const,
    priceCents: 65000,
    rating: 4.8,
    ratingCount: 145,
    verified: true,
    description: "Ervaren wedding- en eventdj's met eigen premium geluidsset en lichtshow.",
    tags: ["Open format", "MC mogelijk"],
  },
  {
    id: "moment-photography",
    companyName: "Moment Photography",
    category: "Fotografie",
    gradient: ["#E2A438", "#B5674A"] as const,
    priceCents: 95000,
    rating: 4.9,
    ratingCount: 201,
    verified: true,
    description: "Documentaire trouwfotografie met een tijdloze, natuurlijke stijl.",
    tags: ["Documentair", "Album inbegrepen"],
  },
];
type DemoCard = (typeof DEMO_CARDS)[number];

export function SwipeTeaser() {
  const [queue, setQueue] = useState(DEMO_CARDS);
  const [lastDecision, setLastDecision] = useState<"shortlisted" | "rejected" | null>(null);

  function decide(decision: "shortlisted" | "rejected") {
    setQueue((q) => q.slice(1));
    setLastDecision(decision);
  }

  function reset() {
    setQueue(DEMO_CARDS);
    setLastDecision(null);
  }

  return (
    <section className="border-t border-line-soft bg-paper-dim/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-xl text-center">
          <span className="text-sm font-medium uppercase tracking-wide text-clay">Probeer het zelf</span>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink sm:text-4xl">
            Zo swipe je straks door je offertes
          </h2>
          <p className="mt-4 text-ink-soft">
            Dit zijn drie echte voorbeeldleveranciers uit Vyra. Sleep een kaart naar rechts om te shortlisten, naar
            links als het niks voor je is — precies zoals het werkt zodra jouw eigen aanvragen binnenkomen.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-md">
          <div className="relative h-[min(26rem,58dvh)]">
            <AnimatePresence>
              {queue.length === 0 ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-[28px] border border-dashed border-line bg-white px-8 text-center [box-shadow:var(--shadow-card)]"
                >
                  <p className="font-display text-xl text-ink">Zo simpel is het</p>
                  <p className="mt-2 text-sm text-ink-soft">
                    Bij je eigen evenement wachten er echte aanbiedingen — geen demo-kaarten.
                  </p>
                  <div className="mt-6 flex items-center gap-3">
                    <button
                      onClick={reset}
                      className="icon-pop flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink-soft"
                    >
                      <RotateCcw className="size-3.5" /> Nog een keer
                    </button>
                    <LinkButton href="/events/new" iconRight={<MoveRight className="size-4" />}>
                      Start mijn evenement
                    </LinkButton>
                  </div>
                </motion.div>
              ) : (
                queue
                  .slice(0, 3)
                  .reverse()
                  .map((card, i, arr) => {
                    const isTop = i === arr.length - 1;
                    return (
                      <TeaserCard
                        key={card.id}
                        card={card}
                        stackIndex={arr.length - 1 - i}
                        interactive={isTop}
                        onDecide={decide}
                      />
                    );
                  })
              )}
            </AnimatePresence>
          </div>

          {queue.length > 0 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                onClick={() => decide("rejected")}
                aria-label="Niet interessant"
                className="icon-pop flex size-14 items-center justify-center rounded-full border border-line bg-white text-danger shadow-sm"
              >
                <X className="size-6" />
              </button>
              <button
                onClick={() => decide("shortlisted")}
                aria-label="Toevoegen aan shortlist"
                className="icon-pop flex size-14 items-center justify-center rounded-full border border-line bg-white text-clay shadow-sm"
              >
                <Heart className="size-6" />
              </button>
            </div>
          )}
          <p className="mt-4 text-center text-xs text-ink-faint" aria-live="polite">
            {lastDecision === "shortlisted" && queue.length > 0 && "Toegevoegd aan je shortlist — nog even doorswipen."}
            {lastDecision === "rejected" && queue.length > 0 && "Genoteerd, volgende."}
            {!lastDecision && queue.length > 0 && "Swipe naar rechts om te shortlisten, naar links voor niet interessant."}
          </p>
        </div>
      </div>
    </section>
  );
}

function TeaserCard({
  card,
  stackIndex,
  interactive,
  onDecide,
}: {
  card: DemoCard;
  stackIndex: number;
  interactive: boolean;
  onDecide: (d: "shortlisted" | "rejected") => void;
}) {
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
      <div className="flex h-36 items-end p-5" style={{ background: `linear-gradient(135deg, ${card.gradient[0]}, ${card.gradient[1]})` }}>
        <Badge tone="neutral">{card.category}</Badge>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-xl text-ink">{card.companyName}</h3>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-ink-faint">
              <Star className="size-3.5 fill-ochre text-ochre" /> {card.rating.toFixed(1)} ({card.ratingCount})
              {card.verified && <ShieldCheck className="ml-1 size-3.5 text-sage" />}
            </div>
          </div>
          <p className="font-display text-lg text-ink">vanaf {formatCurrency(card.priceCents)}</p>
        </div>
        <p className="mt-3 line-clamp-2 text-sm text-ink-soft">{card.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.tags.map((tag) => (
            <Badge key={tag} tone="neutral">{tag}</Badge>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
