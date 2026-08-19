-- ─────────────────────────────────────────────────────────────
-- Vyra — "winkel open/gesloten" + reeks-blokkering (migratie 19)
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run"
-- NADAT alle eerdere migraties al zijn uitgevoerd.
--
-- Onderdeel van spec-item #55: een leverancier kan zichzelf tijdelijk
-- onvindbaar zetten (vakantie, te druk, etc.) met één schakelaar, i.p.v.
-- verplicht elke afzonderlijke datum te moeten blokkeren. Gesloten =
-- uitgesloten van zowel de publieke zoekresultaten als de AI-matching
-- (zie searchSupplierAccounts / findRealMatchingSuppliers in
-- lib/data/store.ts).
-- ─────────────────────────────────────────────────────────────

alter table suppliers add column if not exists store_open boolean not null default true;
create index if not exists idx_suppliers_store_open on suppliers(store_open);
