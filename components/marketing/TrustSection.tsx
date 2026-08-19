import { ShieldCheck, Clock, Percent, HeartHandshake } from "lucide-react";
import { INTRO_COMMISSION_RATE } from "@/lib/config";

const items = [
  { icon: Clock, title: "Binnen 48 uur reactie", description: "Leveranciers reageren gegarandeerd snel — met duidelijke deadlines en herinneringen." },
  // Was hardcoded op de oude vaste 9,5%-commissie — sinds het gestaffelde
  // model (spec-item #53) bestaat er geen enkel vast percentage meer, dus
  // hier het instaptarief (het laagste, eerste-indruk-tarief) i.p.v. een
  // getal dat niet meer overal hetzelfde is. Zie app/voorwaarden/page.tsx
  // Artikel 5 voor de volledige, dynamische uitleg van alle lagen.
  { icon: Percent, title: `Vanaf ${(INTRO_COMMISSION_RATE * 100).toFixed(0)}% platformkosten`, description: "Transparant en vooraf zichtbaar bij elke offerte. Geen verborgen kosten achteraf." },
  { icon: ShieldCheck, title: "Geverifieerde aanbieders", description: "Beoordelingen, portfolio's en verificatie zodat je met vertrouwen kiest." },
  { icon: HeartHandshake, title: "Jij houdt de regie", description: "De AI adviseert, jij beslist. Elke aanbeveling is aanpasbaar of af te wijzen." },
];

export function TrustSection() {
  return (
    <section className="border-y border-line-soft bg-ink py-20 text-paper sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.title}>
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-clay">
                <item.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-lg">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-paper/65">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
