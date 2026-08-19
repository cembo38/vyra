-- ─────────────────────────────────────────────────────────────
-- Vyra — leveranciersbeschikbaarheid laten meetellen (migratie 16)
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
--
-- Tot nu toe had matching geen enkel besef van tijd: een leverancier die op
-- een bepaalde datum al een bevestigde boeking heeft (of zelf heeft
-- aangegeven niet beschikbaar te zijn) kon alsnog een nieuwe aanvraag voor
-- diezelfde datum krijgen. Deze tabel laat leveranciers zelf specifieke
-- datums blokkeren (vakantie, al elders volgeboekt, etc.) — samen met
-- bestaande bevestigde boekingen (offers met status 'accepted') telt dit nu
-- mee bij het bepalen welke leveranciers een aanvraag krijgen.
-- ─────────────────────────────────────────────────────────────

create table if not exists supplier_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (supplier_id, date)
);
alter table supplier_blocked_dates enable row level security;

-- Iedereen mag lezen (nodig voor de matching-query bij het versturen van een
-- aanvraag door een organisator) — alleen de eigenaar zelf mag zijn eigen
-- datums blokkeren/deblokkeren.
create policy "supplier_blocked_dates: iedereen leest" on supplier_blocked_dates for select using (true);
create policy "supplier_blocked_dates: eigenaar beheert" on supplier_blocked_dates for all
  using (exists (select 1 from suppliers s where s.id = supplier_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from suppliers s where s.id = supplier_id and s.owner_id = auth.uid()));

create index if not exists idx_supplier_blocked_dates_supplier on supplier_blocked_dates(supplier_id);
create index if not exists idx_supplier_blocked_dates_date on supplier_blocked_dates(date);
