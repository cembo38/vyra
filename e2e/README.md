# E2e-tests (Playwright)

Dit zijn "echt door de browser heen"-tests, in aanvulling op de bestaande
`lib/*.test.ts`-tests (vitest, die alleen losse functies controleren zonder
browser). Ze draaien tegen een echt draaiende Vyra en klikken/typen zoals
een echte gebruiker dat zou doen.

## Belangrijk: dit draait tegen je ECHTE Supabase-project

Er is (nog) geen apart test-/staging-project — dat was Cems eigen keuze
(simpelst om nu mee te beginnen). Elke testrun:

1. maakt via de service-role-sleutel één, al-bevestigd wegwerp-testaccount
   aan (`e2e/global-setup.ts`) — het e-mailadres is duidelijk herkenbaar
   als testdata (`e2e-<...>@e2e.vyra-test.invalid`) en dat domein bestaat
   expres niet, dus er kan nooit per ongeluk een echte mail naartoe gaan;
2. logt daarmee in via de normale `/login`-pagina en doorloopt de test(s);
3. verwijdert het account weer (`e2e/global-teardown.ts`) — dankzij
   `on delete cascade` in het schema verdwijnt alles wat de test eronder
   aanmaakte (profiel, evenementen, ...) automatisch mee. Dit gebeurt ook
   als een test faalt.

Er wordt dus nooit bestaande data van echte gebruikers aangeraakt, maar er
verschijnt wel heel kort een testaccount in de database tijdens het draaien.

## Draaien

Eenmalig (per machine):

```
npx playwright install chromium
```

Dan:

```
npm run test:e2e
```

Dit bouwt eerst een productieversie (`next build && next start`) en draait
de tests daar tegenaan — dichter bij hoe vyra.now er live uitziet dan de
dev-server. Dat maakt een testrun wel een paar minuten langer duren dan
alleen de tests zelf.

Sneller tijdens het itereren, tegen een server die al draait (bv. via
`npm run dev` in een ander tabblad op poort 3000):

```
PLAYWRIGHT_REUSE_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
```

Met een interactieve UI (handig om een gefaalde stap terug te spelen):

```
npm run test:e2e:ui
```

Een testrapport (met screenshots/video bij een mislukte stap) verschijnt
na afloop automatisch als `playwright-report/index.html` — dat mapje staat
in `.gitignore`, net als `test-results/` (ruwe traces/screenshots).

## Wat dekt dit (nog) wel/niet

`core-loop.spec.ts` bevat drie tests, oplopend in dekking:

1. inloggen met een echt account en op `/events` terechtkomen;
2. een nieuw evenement starten en een echte (AI of mock) reactie krijgen op
   het eerste bericht;
3. de volledige kernloop tot en met een bevestigde betaling: het hele
   AI-interview doorlopen tot "klaar" (aantal vervolgvragen ligt niet vast
   — de echte AI beslist zelf), het gegenereerde plan bevestigen, een
   aanvraag versturen naar leveranciers, wachten op een (synchroon
   gegenereerde demo-)offerte, die offerte accepteren, en de betaling op de
   afrekenpagina bevestigen.

Dit dekt daarmee de volledige kernloop uit `vervolgplan-vyra.md`
("... tot en met een offerte accepteren"), inclusief het afrekenen erna.
Bewust nog niet gedekt: leveranciers-portaal-flows (een échte leverancier
die zelf reageert op een aanvraag), het geschillenproces, en admin-flows —
mogelijke vervolgstappen als daar behoefte aan is.
