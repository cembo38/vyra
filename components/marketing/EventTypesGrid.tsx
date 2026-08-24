"use client";

import { motion } from "framer-motion";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { LinkButton } from "@/components/ui/Button";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

const ORDER: (keyof typeof EVENT_TYPE_LABELS)[] = [
  "wedding", "birthday", "corporate_party", "christmas_party", "baby_shower", "bachelor_party",
  "festival", "graduation_party", "anniversary", "garden_party", "kids_party", "new_year_party",
  "dinner", "business_conference", "product_launch", "cultural_event", "private_party", "other",
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.025 } },
};
const chipVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.94 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

/** Chips komen niet allemaal tegelijk in beeld maar rollen kort na elkaar in
 * (staggerChildren) — een lichte, snelle onthulling die past bij hoeveel
 * chips het er tegelijk zijn, zonder de bezoeker lang te laten wachten. */
export function EventTypesGrid() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <section id="evenementen" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-xl text-center">
          <span className="text-sm font-medium uppercase tracking-wide text-clay">Voor elk evenement</span>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink sm:text-4xl">
            Eén platform, ieder denkbaar evenement
          </h2>
          <p className="mt-4 text-ink-soft">
            Of het nu klein en intiem is of groots en zakelijk — vertel ons wat je wilt vieren.
          </p>
        </div>

        <motion.div
          className="mt-10 flex flex-wrap justify-center gap-2.5"
          initial={reducedMotion ? false : "hidden"}
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={containerVariants}
        >
          {ORDER.map((key) => (
            <motion.span
              key={key}
              variants={chipVariants}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="chip-hover rounded-full border border-line bg-white px-4 py-2 text-sm text-ink-soft hover:border-clay/50 hover:text-ink"
            >
              {EVENT_TYPE_LABELS[key]}
            </motion.span>
          ))}
        </motion.div>

        <div className="mt-10 flex justify-center">
          <LinkButton href="/events/new" variant="outline">
            Of vertel ons iets heel anders →
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
