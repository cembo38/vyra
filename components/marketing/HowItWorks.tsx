import { MessageCircleQuestion, Sparkles, SwatchBook, CreditCard } from "lucide-react";

const steps = [
  {
    icon: MessageCircleQuestion,
    title: "Vertel je verhaal",
    description: "Beschrijf in gewone taal wat je wilt organiseren. Onze AI begrijpt direct wat voor evenement je voor ogen hebt.",
  },
  {
    icon: Sparkles,
    title: "AI maakt je plan",
    description: "Slimme, korte vervolgvragen — en daarna een compleet plan met alle categorieën die je nodig hebt, met uitleg waarom.",
  },
  {
    icon: SwatchBook,
    title: "Vergelijk & swipe",
    description: "Aanbieders reageren binnen 48 uur. Swipe door de aanbiedingen en bouw moeiteloos je persoonlijke shortlist op.",
  },
  {
    icon: CreditCard,
    title: "Kies & betaal veilig",
    description: "Accepteer offertes en betaal direct via het platform. Eén overzicht van wat besteld, bevestigd en nog openstaat.",
  },
];

export function HowItWorks() {
  return (
    <section id="hoe-het-werkt" className="border-t border-line-soft bg-paper-dim/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-xl text-center">
          <span className="text-sm font-medium uppercase tracking-wide text-clay">Hoe het werkt</span>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink sm:text-4xl">
            Van idee tot compleet geregeld evenement
          </h2>
          <p className="mt-4 text-ink-soft">
            Geen spreadsheets, geen eindeloos rondbellen. Eén plek waar jouw evenement tot leven komt.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <div key={step.title} className="relative rounded-2xl border border-line bg-white p-6 [box-shadow:var(--shadow-card)]">
              <span className="font-display text-4xl text-line">{String(i + 1).padStart(2, "0")}</span>
              <div className="mt-4 flex size-10 items-center justify-center rounded-xl bg-sage-50 text-sage">
                <step.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-lg text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
