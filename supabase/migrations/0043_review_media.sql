-- ─────────────────────────────────────────────────────────────
-- Vyra — foto/video bij beoordelingen
--
-- Beoordelingen (migratie 0033) waren tot nu toe alleen sterren + tekst.
-- Net als bij Airbnb/Google Reviews wil een organisator vaak een foto van
-- het eindresultaat (het bloemstuk, de taart, de aankleding) kunnen laten
-- zien — dat overtuigt een volgende organisator veel directer dan tekst
-- alleen. Simpele kolomtoevoeging, geen nieuwe RLS-policies nodig: de
-- bestaande policies op `reviews` (migratie 0033) gelden al voor de hele
-- rij, inclusief deze twee nieuwe kolommen.
--
-- photo_urls wijst naar de publieke "supplier-media"-opslagruimte
-- (dezelfde bucket als een leverancierslogo/-galerij, zie
-- uploadSupplierFile in lib/data/store.ts) — reviews die eenmaal onthuld
-- zijn, zijn sowieso al openbaar, dus geen aparte private bucket nodig
-- zoals bij message_attachments (migratie 0041).
--
-- Plak dit hieronder in de Supabase SQL Editor en klik "Run".

alter table reviews add column if not exists photo_urls text[] not null default '{}';
alter table reviews add column if not exists video_url text;
