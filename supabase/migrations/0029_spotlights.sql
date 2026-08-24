-- "Spotlight": een leverancier kan tijdelijk (3 dagen) één van zijn eigen
-- categorieën extra onder de aandacht brengen op /leveranciers — hoger in
-- de resultaten + een "Uitgelicht"-badge. Beschikbaar vanaf Pro, met een
-- oplopende maandelijkse limiet voor Pro/Premium/Enterprise (zie
-- SPOTLIGHT_MONTHLY_QUOTA in lib/config.ts).
--
-- Plak dit hieronder in de Supabase SQL Editor en klik "Run".

create table if not exists spotlights (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  category_key text not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_spotlights_supplier on spotlights(supplier_id);
create index if not exists idx_spotlights_active on spotlights(category_key, expires_at);

alter table spotlights enable row level security;

-- Iedereen mag zien welke leveranciers/categorieën actief zijn uitgelicht
-- (nodig voor de openbare /leveranciers-zoekpagina), maar alleen de
-- eigenaar van het leveranciersaccount mag er zelf één aanmaken.
create policy "spotlights: iedereen leest" on spotlights for select using (true);
create policy "spotlights: eigenaar maakt aan" on spotlights for insert with check (
  auth.uid() = (select owner_id from suppliers where suppliers.id = spotlights.supplier_id)
);
