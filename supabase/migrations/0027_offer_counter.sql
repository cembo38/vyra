-- Tegenbod op een offerte: organisator kan een leverancier een ander bedrag
-- voorstellen i.p.v. alleen "accepteren" of "afwijzen". Drie nieuwe, allemaal
-- optionele kolommen op `offers` — geen bestaande rij hoeft aangepast te
-- worden, en er is bewust GEEN check-constraint nodig op `offers.status`
-- (die bestaat al niet voor de bestaande statuswaarden, zie migratie 0001).
--
-- counter_price_cents / counter_note: het voorgestelde bedrag + optionele
-- toelichting van de organisator, zichtbaar voor de leverancier zolang
-- status = 'countered'.
-- countered_at: wanneer het tegenbod is verstuurd (voor eventuele latere
-- "verlopen na X dagen"-logica, nu nog niet gebruikt).
--
-- Plak dit hieronder in de Supabase SQL Editor en klik "Run".

alter table public.offers
  add column if not exists counter_price_cents integer,
  add column if not exists counter_note text,
  add column if not exists countered_at timestamptz;
