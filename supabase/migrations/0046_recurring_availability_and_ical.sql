-- ─────────────────────────────────────────────────────────────
-- Vyra — terugkerende beschikbaarheid + iCal-agenda-abonnement (migratie 46)
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
--
-- Twee losse, onafhankelijke features (spec-item #128):
--
-- 1) `supplier_recurring_blocks` — een leverancier kan nu ook een vaste
--    weekdag structureel blokkeren ("ik werk nooit op maandag"), naast de
--    al bestaande eenmalige datums (`supplier_blocked_dates`, migratie 16).
--    Telt vanaf nu net zo mee bij matching als die eenmalige datums — zie
--    `getUnavailableSupplierIds` in lib/data/store.ts.
--
-- 2) `supplier_ical_tokens` — een geheime, ongokbare token per leverancier
--    waarmee externe agenda-apps (Apple/Google Kalender e.d.) een
--    abonnement-URL (.ics-feed) kunnen volgen met daarin de bevestigde
--    boekingen en eenmalige blokkades, ZONDER dat de agenda-app kan
--    inloggen op Vyra. Bewust een aparte tabel i.p.v. een kolom op
--    `suppliers` zelf: die tabel heeft een "iedereen leest"-policy (nodig
--    voor het publieke leveranciersprofiel), dus een geheime token daar
--    zou voor iedereen leesbaar zijn — precies het tegenovergestelde van
--    een geheim. Deze tabel heeft GEEN publieke leespolicy: alleen de
--    eigenaar zelf mag 'm lezen/beheren (voor de "kopieer link"-knop);
--    de .ics-route zelf gebruikt de service-role-sleutel om de tabel op
--    token op te zoeken (zie app/api/supplier/ical/[token]/route.ts).
-- ─────────────────────────────────────────────────────────────

create table if not exists supplier_recurring_blocks (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  -- 0=maandag .. 6=zondag (matcht de Ma-Zo-volgorde in de kalender-UI,
  -- NIET JS' eigen 0=zondag-conventie — zie de toelichting bij
  -- getUnavailableSupplierIds in lib/data/store.ts voor de omrekening).
  weekday smallint not null check (weekday between 0 and 6),
  created_at timestamptz not null default now(),
  unique (supplier_id, weekday)
);
alter table supplier_recurring_blocks enable row level security;

-- Zelfde vorm als supplier_blocked_dates: iedereen mag lezen (nodig voor de
-- matching-query), alleen de eigenaar zelf mag beheren.
create policy "supplier_recurring_blocks: iedereen leest" on supplier_recurring_blocks for select using (true);
create policy "supplier_recurring_blocks: eigenaar beheert" on supplier_recurring_blocks for all
  using (exists (select 1 from suppliers s where s.id = supplier_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from suppliers s where s.id = supplier_id and s.owner_id = auth.uid()));

create index if not exists idx_supplier_recurring_blocks_supplier on supplier_recurring_blocks(supplier_id);
create index if not exists idx_supplier_recurring_blocks_weekday on supplier_recurring_blocks(weekday);

create table if not exists supplier_ical_tokens (
  supplier_id uuid primary key references suppliers(id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table supplier_ical_tokens enable row level security;

-- GEEN publieke leespolicy — expres. Alleen de eigenaar zelf mag zijn eigen
-- token lezen/aanmaken/vervangen (voor de "kopieer link"/"vernieuw
-- link"-knoppen op /supplier/calendar). De .ics-route zelf loopt via de
-- service-role-sleutel (createSupabaseAdminClient), die RLS omzeilt — dat
-- is een bewuste, bestaande aanpak in dit project (zie bv.
-- listPendingAccountDeletionRequests), hier nodig omdat een externe
-- agenda-app geen Vyra-sessie/cookie meestuurt.
create policy "supplier_ical_tokens: eigenaar beheert" on supplier_ical_tokens for all
  using (exists (select 1 from suppliers s where s.id = supplier_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from suppliers s where s.id = supplier_id and s.owner_id = auth.uid()));

create unique index if not exists idx_supplier_ical_tokens_token on supplier_ical_tokens(token);
