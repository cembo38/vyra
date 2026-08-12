import { LinkButton } from "@/components/ui/Button";
import { AiTag, Badge, PriorityBadge } from "@/components/ui/Badge";
import { Sparkles, MoveRight, Star } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-coral-50 via-violet-50/60 to-transparent blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl gap-14 px-6 pb-16 pt-16 md:grid-cols-[1.05fr_0.95fr] md:items-center md:pb-24 md:pt-24">
        <div className="animate-rise">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink-soft shadow-sm">
            <Sparkles className="size-3.5 text-violet" />
            Nieuw: AI plant je hele evenement mee
          </div>
          <h1 className="font-display text-[2.6rem] leading-[1.08] tracking-tight text-ink sm:text-6xl">
            Celebrate.
            <br />
            <span className="italic text-coral">Simplified.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
            Vertel ons wat je wilt organiseren en onze AI ontdekt welke mensen, diensten en producten je nodig hebt —
            van bruiloft tot bedrijfsfeest. Aanbieders reageren, jij kiest, wij regelen de rest.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <LinkButton href="/events/new" size="lg" iconRight={<MoveRight className="size-4" />}>
              Start mijn evenement
            </LinkButton>
            <LinkButton href="/#hoe-het-werkt" size="lg" variant="outline">
              Bekijk hoe het werkt
            </LinkButton>
          </div>
          <div className="mt-10 flex items-center gap-6 text-sm text-ink-faint">
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-2">
                {["#FF5A46", "#6D5CF0", "#1C8A54", "#B8892B"].map((c) => (
                  <div key={c} className="size-7 rounded-full border-2 border-paper" style={{ backgroundColor: c }} />
                ))}
              </div>
              <span>Al gebruikt voor 2.000+ evenementen</span>
            </div>
            <div className="hidden items-center gap-1 sm:flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="size-3.5 fill-gold text-gold" />
              ))}
              <span className="ml-1">4,8 / 5</span>
            </div>
          </div>
        </div>

        <div className="relative animate-rise [animation-delay:150ms]">
          <div className="rounded-[28px] border border-line bg-white p-5 [box-shadow:var(--shadow-pop)] sm:p-6">
            <div className="mb-4 flex items-center gap-2 border-b border-line-soft pb-4">
              <div className="flex size-8 items-center justify-center rounded-full bg-violet-50 text-violet">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">AI Event Interview</p>
                <p className="text-xs text-ink-faint">Emma & Lucas&apos; bruiloft</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-paper-dim px-4 py-2.5 text-sm text-ink">
                Ik wil in juni een luxe bruiloft organiseren voor ongeveer 120 mensen in Amsterdam.
              </div>
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-ink px-4 py-2.5 text-sm text-paper">
                Wat feestelijk! Wil je een formele of informele sfeer, en heb je al een locatie op het oog?
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-paper-dim px-4 py-2.5 text-sm text-ink">
                Formeel diner, met een feestavond erna. Nog geen locatie.
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-line-soft bg-paper p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Jouw AI-eventplan</span>
                <AiTag />
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "Locatie", priority: "essential" as const },
                  { label: "Catering", priority: "essential" as const },
                  { label: "Fotografie", priority: "essential" as const },
                  { label: "Bloemist", priority: "recommended" as const },
                ].map((c) => (
                  <div key={c.label} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
                    <span className="text-ink">{c.label}</span>
                    <PriorityBadge priority={c.priority} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-line bg-white px-4 py-3 shadow-lg sm:block">
            <p className="text-xs text-ink-faint">Reacties binnen</p>
            <p className="font-display text-lg text-ink">48 uur</p>
          </div>
          <div className="absolute -right-4 -top-4 hidden rounded-2xl border border-line bg-white px-4 py-3 shadow-lg sm:block">
            <Badge tone="success">3 offertes ontvangen</Badge>
          </div>
        </div>
      </div>
    </section>
  );
}
