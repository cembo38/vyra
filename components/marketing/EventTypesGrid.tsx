import { EVENT_TYPE_LABELS } from "@/lib/types";
import { LinkButton } from "@/components/ui/Button";

const ORDER: (keyof typeof EVENT_TYPE_LABELS)[] = [
  "wedding", "birthday", "corporate_party", "christmas_party", "baby_shower", "bachelor_party",
  "festival", "graduation_party", "anniversary", "garden_party", "kids_party", "new_year_party",
  "dinner", "business_conference", "product_launch", "cultural_event", "private_party", "other",
];

export function EventTypesGrid() {
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

        <div className="mt-10 flex flex-wrap justify-center gap-2.5">
          {ORDER.map((key) => (
            <span
              key={key}
              className="chip-hover rounded-full border border-line bg-white px-4 py-2 text-sm text-ink-soft hover:border-clay/50 hover:text-ink"
            >
              {EVENT_TYPE_LABELS[key]}
            </span>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <LinkButton href="/events/new" variant="outline">
            Of vertel ons iets heel anders →
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
