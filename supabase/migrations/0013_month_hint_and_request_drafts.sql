-- ─────────────────────────────────────────────────────────────
-- Vyra — datumhint uit het AI-interview bewaren + conceptbericht per
-- aanvraagcategorie
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
--
-- 1) `events.month_hint`: als iemand tijdens het AI-interview een maand
--    noemt ("ergens in juni") zonder een exacte datum, werd dat tot nu toe
--    wél herkend door de AI maar nergens opgeslagen — het antwoord ging
--    letterlijk nergens heen. Dit veld bewaart die maand-indicatie apart
--    van de echte datum (`events.date`), zodat de informatie niet meer
--    verloren gaat totdat iemand de exacte datum invult.
--
-- 2) `event_requirements.draft_message`: het conceptbericht dat de AI
--    voorstelt om met leveranciers te delen voor een categorie (bv.
--    "Op zoek naar catering voor 80 gasten..."), dat de organisator kan
--    lezen en aanpassen vóórdat er daadwerkelijk een aanvraag verstuurd
--    wordt. Voorheen bestond dit conceptbericht niet — leveranciers zagen
--    alleen de kale categorienaam plus wat iemand er handmatig bij typte.
-- ─────────────────────────────────────────────────────────────

alter table events add column if not exists month_hint text;
alter table event_requirements add column if not exists draft_message text;
