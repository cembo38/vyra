"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Clock, Percent, HeartHandshake } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

const items = [
  { icon: Clock, title: "Binnen 48 uur reactie", description: "Leveranciers reageren gegarandeerd snel — met duidelijke deadlines en herinneringen." },
  // Sinds het abonnementenmodel voor leveranciers (spec-item #53-vervolg,
  // SaaS-pivot) verdient Vyra aan een maandabonnement met leveranciers, niet
  // aan een opslag op jouw boeking — dus geen percentage meer om hier te
  // noemen. Zie app/voorwaarden/page.tsx Artikel 5 voor de volledige
  // toelichting op hoe leveranciers Vyra betalen.
  { icon: Percent, title: "Geen platformkosten voor jou", description: "Je betaalt precies de prijs die de leverancier je biedt — geen opslag, geen verborgen kosten." },
  { icon: ShieldCheck, title: "Geverifieerde aanbieders", description: "Beoordelingen, portfolio's en verificatie zodat je met vertrouwen kiest." },
  { icon: HeartHandshake, title: "Jij houdt de regie", description: "De AI adviseert, jij beslist. Elke aanbeveling is aanpasbaar of af te wijzen." },
];

/** Zelfde lichte scroll-onthulling-stagger als "Hoe het werkt", nu op de
 * vertrouwensbalk — houdt de beweging op de pagina consistent zonder dat
 * dit blok zelf ergens naar de kern van het motion-voorstel behoort. */
export function TrustSection() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <section className="border-y border-line-soft bg-ink py-20 text-paper sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <motion.div
              key={item.title}
              initial={reducedMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.1 }}
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-clay">
                <item.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-lg">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-paper/65">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
