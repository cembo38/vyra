-- Terugdraaien van migratie 0027 (tegenbod-knop) — de functie is
-- geschrapt vóórdat er ergens data in deze kolommen kon belanden, dus
-- gewoon droppen kan zonder gegevensverlies.
--
-- Plak dit hieronder in de Supabase SQL Editor en klik "Run".

alter table public.offers
  drop column if exists counter_price_cents,
  drop column if exists counter_note,
  drop column if exists countered_at;
