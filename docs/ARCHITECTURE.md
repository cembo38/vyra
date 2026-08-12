# Vyra — productarchitectuur

Dit document is de "FASE 1/2"-samenvatting die aan de bouw voorafging:
productbeslissingen, scope-keuzes en de architectuur, zodat duidelijk is
*waarom* de code is zoals hij is.

## Kernprincipe

> De gebruiker moet zo min mogelijk zelf hoeven uitzoeken. Van complex event
> planning een simpele, begeleide ervaring maken.

Alles — van de conversational interview tot de swipe-flow — is ontworpen om
cognitieve belasting te minimaliseren: één vraag tegelijk, progressive
disclosure, slimme defaults, en de gebruiker houdt altijd de regie (elke
AI-aanbeveling is aan/uit te zetten).

## De kernloop (waar dit MVP zich op focust)

```
Beschrijven → AI begrijpt → AI interviewt → AI genereert plan
   → gebruiker selecteert → aanvraag naar leveranciers (max 3-5, anti-spam)
   → offertes binnen (48u) → swipe/vergelijk → shortlist → accepteren
   → betalen (9,5% commissie transparant) → dashboard bewaakt het evenement
```

Zoals gevraagd is dit **eerst en volledig** uitgewerkt, met de leverancier-
en adminkant als lichtere, ondersteunende stub eromheen — niet andersom.

## MVP-scope: wat is uitgewerkt, wat is bewust een stub

**Volledig uitgewerkt (organizer-flow):**
- Landing page, onboarding, AI event interview, AI-eventplan met
  ESSENTIEEL/AANBEVOLEN/OPTIONEEL, automatische leveranciersmatching,
  aanvragen met 48u-deadline, offertevergelijking (lijst + swipe), shortlist,
  event dashboard (readiness score, budget, taken, risico's, AI event
  manager chat), planning/timeline, berichten, checkout met commissie-
  uitsplitsing, profiel.

**Bewust een lichte stub (aanwezig, niet diep uitgewerkt):**
- Supplier-dashboard: één pagina met voorbeeld-inbox + AI-offerte-assistent,
  in plaats van een volledig los account-systeem met registratieflow,
  beschikbaarheidskalender, etc.
- Admin-dashboard: read-only KPI-overzicht (GMV, revenue, conversie, etc.),
  zonder moderatie-acties.
- Berichten: één gesprek per categorie (niet per individuele leverancier).

**Bewust weggelaten uit de MVP (zie "Future improvements" hieronder), maar
architectuur houdt er rekening mee:** guest management/RSVP, seating plans,
wedding website generator, ticketing/QR check-in, multi-organizer
collaboration, financing/insurance partnerships, geavanceerde supplier-
verificatie (KvK-koppeling), i18n UI (structuur is er, alleen NL is ingevuld).

## Technische architectuur

- **Next.js 16 (App Router) + TypeScript + Tailwind v4**, Server Components
  als standaard, Server Actions voor mutaties (geen aparte REST-laag nodig
  voor interne mutaties — minder boilerplate, minder plekken waar business-
  logica kan verwateren).
- **Data-laag**: `lib/data/store.ts` — een in-memory, repository-achtige
  store met exact dezelfde functienamen als een echte backend zou hebben.
  Zie `docs/DATABASE_SCHEMA.md` voor het Postgres-schema waar dit 1-op-1
  naartoe migreert.
- **AI-laag**: geen "één grote chatbot"-prompt. Losse rollen met eigen
  system-prompt en JSON-schema (`lib/ai/prompts.ts`, `lib/ai/*.ts`):
  Event Understanding, Question Generator, Requirement Generator, Timeline
  Generator, Budget Assistant, Event Manager, Change Detection, Risk
  Detection, Supplier Response Assistant. Elke rol gaat door
  `callStructuredAI()` (`lib/ai/client.ts`): met `OPENAI_API_KEY` gaat de
  aanroep naar OpenAI met `response_format: json_schema`; zonder key —of bij
  een fout— draait een deterministische mock-versie. Dit is bewust zo
  gebouwd zodat (a) de app altijd werkt, ook zonder AI-key of bij een
  storing, en (b) de UI en databronnen niet weten of een AI-aanroep "echt"
  of "mock" was — het `usedAI`-veld is puur informatief.
- **Provenance overal**: `lib/types.ts` maakt structureel onderscheid tussen
  user-, AI-, supplier- en systeemdata (`Provenance`-type), zichtbaar in de
  UI via de paarse "AI-aanbeveling"-badge (`components/ui/Badge.tsx` →
  `AiTag`). Dit is de directe implementatie van de eis dat AI-output nooit
  als bevestigd feit gepresenteerd mag worden.
- **Payments**: `lib/config.ts` bevat `PLATFORM_COMMISSION_RATE = 0.095` als
  enige bron van waarheid (niet verspreid gehardcode) plus
  `calculateCommission()`. De checkout-pagina en het admin-dashboard lezen
  beide hieruit. Stripe-integratie is voorbereid (`STRIPE_SECRET_KEY` in
  `.env.example`, `PAYMENTS_ENABLED`-vlag) maar draait nu op een mock-flow
  met identieke UI.
- **Auth**: mock (`lib/auth.ts`, cookie-based), met dezelfde interface
  (`getCurrentUser()`) als een Supabase Auth-implementatie zou hebben.

## Belangrijke productbeslissingen (afwijkingen/verbeteringen t.o.v. de letterlijke spec)

1. **Anti-spam matching**: een aanvraag gaat naar maximaal 3-5 gematchte
   leveranciers per categorie (`SUPPLIERS_PER_REQUEST` in `lib/config.ts`),
   nooit naar het hele netwerk — expliciet genoemd risico in de opdracht,
   hier structureel opgelost via `findMatchingSuppliers()`.
2. **Demo-offertes komen versneld binnen** i.p.v. na echte 48 uur, zodat de
   kernloop in één sessie te ervaren en te demonstreren is. De
   deadline/countdown-logica zelf is wel echt 48 uur — dit is puur een
   demo-versnelling van leveranciersreacties, geen wijziging van het
   productmodel.
3. **Event Score / readiness engine en AI Risk Detection** zijn toegevoegd
   als onderscheidende features, zoals de opdracht zelf voorstelde
   (`computeReadiness()`, `detectRisks()`).
4. **Swipe is één van twee gelijkwaardige manieren** om offertes te
   bekijken (lijst-modus is qua informatiedichtheid rijker) — dit voorkomt
   dat het platform "kinderachtig" aanvoelt, zoals de opdracht expliciet
   vroeg.

## Future improvements (bewust niet in MVP)

- Guest management, RSVP, seating plans, wedding website generator
- Ticketing / QR check-in
- Multi-organizer collaboration (rollen: `EVENT_PLANNER`, `TEAM_MEMBER`,
  `CORPORATE_ADMIN` — datamodel staat dit al toe via `event_members`)
- Premium supplier profiles / featured placement / lead fees
- Subscription-tier voor professionele planners, corporate plans
- Insurance- en financieringspartnerships
- Volledige leverancier-onboarding (KvK-koppeling, identiteitscontrole,
  Stripe Connect voor uitbetalingen)
- Volwaardige dispute-workflow met admin-acties (nu: alleen lege staat)
- E-mail- en pushnotificaties (nu: alleen in-app)
- Meertaligheid (architectuur ondersteunt het — `language`-veld bestaat al
  — maar UI-copy is nu alleen Nederlands)
