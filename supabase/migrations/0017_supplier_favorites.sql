-- ─────────────────────────────────────────────────────────────
-- Vyra — favoriete leveranciers (migratie 17)
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run"
-- NADAT alle eerdere migraties al zijn uitgevoerd.
--
-- Onderdeel van spec-item #54 ("organisatoren laten terugkeren"): een
-- organisator kan een leverancier waar hij tevreden over was opslaan als
-- favoriet, en die later vanaf één overzichtspagina met één klik opnieuw
-- benaderen voor een volgend evenement — in plaats van na een goed gesprek
-- gewoon buiten Vyra om verder te gaan, of iedere keer opnieuw te moeten
-- zoeken.
-- ─────────────────────────────────────────────────────────────

create table if not exists supplier_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, supplier_id)
);
alter table supplier_favorites enable row level security;

create policy "supplier_favorites: eigenaar beheert eigen favorieten" on supplier_favorites for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_supplier_favorites_user on supplier_favorites(user_id);
create index if not exists idx_supplier_favorites_supplier on supplier_favorites(supplier_id);
