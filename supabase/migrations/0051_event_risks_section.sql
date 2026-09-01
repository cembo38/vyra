-- ─────────────────────────────────────────────────────────────
-- Vyra — "section" op event_risks: maakt de gele AI-signaleringen
-- op het evenement-dashboard klikbaar naar het juiste tabblad
-- (migratie 51)
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run"
-- NADAT alle eerdere migraties al zijn uitgevoerd.
--
-- Cems feedback (sep. 2026): de gele waarschuwingskaarten op het
-- evenement-dashboard ("Locatie: indoor/outdoor niet gespecificeerd",
-- "Alle essentiële categorieën staan op 'suggested'", enz.) waren pure
-- tekst zonder actie — een klik deed niets. De AI die deze signaleringen
-- genereert (detectRisks() in lib/ai/planning.ts) geeft er voortaan een
-- "section" bij mee, zodat de kaart als link naar het juiste tabblad kan
-- wijzen i.p.v. dood te zijn. Bestaande rijen (van vóór deze wijziging)
-- krijgen geen waarde — de app valt daar netjes terug op het Plan-tabblad,
-- zie riskSectionHref() in app/events/[id]/page.tsx.
-- ─────────────────────────────────────────────────────────────

alter table event_risks add column if not exists section text
  check (section in ('instellingen', 'plan', 'gasten', 'budget'));
