# Vyra

**Celebrate. Simplified.**

Een AI-platform voor het organiseren van elk denkbaar evenement — van
bruiloft tot bedrijfsfeest. Beschrijf wat je wilt organiseren, de AI bepaalt
wat je nodig hebt, leveranciers reageren met aanbiedingen, jij kiest — het
platform regelt de rest.

Dit is een werkende MVP-codebase (Next.js) die de volledige kernloop van het
product demonstreert. Zie `docs/ARCHITECTURE.md` voor de productarchitectuur
en scope-keuzes, en `docs/DATABASE_SCHEMA.md` voor het beoogde
productie-databaseschema.

## Snel starten

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. De app werkt direct, zonder enige
configuratie — er is een demo-account met twee realistische
voorbeeldevenementen ("Emma & Lucas' bruiloft" en "Cem's 40ste
verjaardag") vooraf geladen, en alle AI-functionaliteit heeft een
deterministische mock-fallback.

### AI activeren (optioneel)

Zonder `OPENAI_API_KEY` draait alle AI-functionaliteit (event-interview,
plangeneratie, budgetadvies, de AI Event Manager-chat, ...) op zorgvuldig
gebouwde mock-logica — geschikt om het hele product te demonstreren zonder
API-kosten. Wil je de echte OpenAI-integratie gebruiken:

```bash
cp .env.example .env.local
# vul OPENAI_API_KEY in .env.local in
npm run dev
```

Zie `lib/ai/` voor de AI-architectuur: elke AI-rol (Event Understanding,
Question Generator, Requirement Generator, Timeline/Budget Assistant, Event
Manager, Risk Detection, Supplier Response Assistant) heeft een eigen
system-prompt en JSON-schema, en valt automatisch terug op mock-logica als
er geen key is of een aanroep faalt.

### Betalingen

Checkout draait standaard op een mock-flow (zelfde UI, geen echte
transactie). Vul `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
in `.env.local` in om richting een echte Stripe-integratie te bouwen — de
architectuur (`lib/config.ts`, `PLATFORM_COMMISSION_RATE`) is hierop
voorbereid.

## Belangrijkste routes

| Route | Beschrijving |
|---|---|
| `/` | Landing page |
| `/events/new` | AI event interview (start hier de kernloop) |
| `/events` | Mijn evenementen |
| `/events/[id]` | Event dashboard (budget, readiness, taken, AI-assistent) |
| `/events/[id]/plan` | AI-eventplan met ESSENTIEEL/AANBEVOLEN/OPTIONEEL |
| `/events/[id]/requests` | Aanvragen naar leveranciers |
| `/events/[id]/offers/[category]` | Offertes vergelijken + swipen |
| `/events/[id]/shortlist` | Persoonlijke shortlist |
| `/events/[id]/budget`, `/timeline`, `/messages` | Budget, planning, berichten |
| `/events/[id]/checkout/[paymentId]` | Afrekenen (9,5% commissie transparant) |
| `/supplier` | Leveranciersflow (marketing + voorbeeld-inbox + AI-offerte-assistent) |
| `/admin` | Platform-KPI's |

## Projectstructuur

```
app/                    routes (App Router)
components/
  ui/                   herbruikbare designsystem-componenten
  app/                   interactieve productcomponenten (client)
  marketing/             landingspagina-componenten
lib/
  types.ts               centraal datamodel (incl. Provenance-onderscheid)
  config.ts               platformconfiguratie (o.a. commissiepercentage)
  auth.ts                 mock-auth (Supabase-Auth-klaar interface)
  data/                   repository-laag (in-memory demo-store + seed-data)
  ai/                      AI-rollen, prompts, structured-output client
  actions/                Server Actions (mutaties)
docs/
  ARCHITECTURE.md          productbeslissingen & scope
  DATABASE_SCHEMA.md       beoogd Postgres-schema voor productie
```

## Status & vervolg

Dit is een MVP die bewust is afgebakend op de kernloop van het product (zie
`docs/ARCHITECTURE.md`). De leverancier- en adminkant zijn functionele maar
lichte stubs. Een lijst van bewust uitgestelde functionaliteit staat onder
"Future improvements" in datzelfde document.
