-- ─────────────────────────────────────────────────────────────
-- Vyra — genoemde collecties voor favorieten (migratie 47)
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run"
-- NADAT migratie 46 al is uitgevoerd.
--
-- Spec-item #129: "Mijn leveranciers" (migratie 17) is tot nu toe altijd
-- één platte lijst geweest. Een organisator die meerdere evenementen
-- tegelijk plant (of een leverancier als "backup-optie" wil onthouden
-- zonder die te verwarren met een favoriet voor het eerstvolgende
-- evenement) kan favorieten nu indelen in eigen, benoemde collecties
-- (bv. "Bruiloft 2027", "Backup-opties") — puur organisatorisch, verandert
-- niets aan matching of aan wat een leverancier zelf te zien krijgt.
-- ─────────────────────────────────────────────────────────────

create table if not exists supplier_favorite_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
alter table supplier_favorite_collections enable row level security;

create policy "supplier_favorite_collections: eigenaar beheert" on supplier_favorite_collections for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_supplier_favorite_collections_user on supplier_favorite_collections(user_id);

-- Nullable + `on delete set null`: een favoriet hoeft niet in een collectie
-- te zitten (dan staat 'ie gewoon onder "Niet ingedeeld"), en het
-- verwijderen van een collectie verwijdert nooit de favoriet zelf — alleen
-- de indeling.
alter table supplier_favorites add column if not exists collection_id uuid references supplier_favorite_collections(id) on delete set null;

create index if not exists idx_supplier_favorites_collection on supplier_favorites(collection_id);
