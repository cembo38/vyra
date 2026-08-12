-- ─────────────────────────────────────────────────────────────
-- Vyra — leveranciersaccounts (migratie 2)
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run"
-- NADAT migratie 1 (0001_init.sql) al is uitgevoerd.
--
-- Voegt echte, inlogbare leveranciersaccounts toe naast de bestaande
-- statische demo-catalogus. Die demo-catalogus (lib/data/suppliers.ts)
-- blijft gewoon meedraaien in de matching/simulatie — zo blijft de
-- organisator-flow altijd werken, ook zolang er nog weinig echte
-- leveranciers zijn aangemeld. Zodra een aanvraag ook een échte
-- leverancier matcht, krijgt die leverancier een eigen, RLS-beveiligde
-- "aanvraag-toewijzing" en kan hij zelf een offerte indienen.
-- ─────────────────────────────────────────────────────────────

-- ───────────── LEVERANCIERS (echte accounts) ─────────────
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  company_name text not null,
  contact_person text not null default '',
  category text not null,
  service_areas text[] not null default '{}',
  description text not null default '',
  min_price_cents bigint not null default 0,
  avg_price_cents bigint not null default 0,
  rating_avg numeric(2,1) not null default 0,
  rating_count int not null default 0,
  verified boolean not null default false,
  avg_response_hours int not null default 24,
  accepted_offer_rate numeric(4,3) not null default 0,
  tags text[] not null default '{}',
  years_active int not null default 0,
  portfolio_highlights text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table suppliers enable row level security;

-- Iedereen die is ingelogd mag leveranciersprofielen lezen (nodig voor de
-- AI-matching bij het versturen van aanvragen door organisatoren). Alleen
-- de eigenaar zelf mag zijn eigen profiel aanmaken/wijzigen/verwijderen.
create policy "suppliers: iedereen leest" on suppliers for select using (true);
create policy "suppliers: eigenaar maakt aan" on suppliers for insert with check (auth.uid() = owner_id);
create policy "suppliers: eigenaar wijzigt" on suppliers for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "suppliers: eigenaar verwijdert" on suppliers for delete using (auth.uid() = owner_id);

create index if not exists idx_suppliers_owner on suppliers(owner_id);
create index if not exists idx_suppliers_category on suppliers(category);

-- ───────────── AANVRAAG-TOEWIJZINGEN ─────────────
-- Koppelt een échte leverancier aan een specifieke aanvraag (`requests`),
-- zodat we via RLS precies kunnen regelen welke leverancier welke aanvraag
-- (en het bijbehorende evenement) mag inzien.
create table if not exists request_targets (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'responded', 'expired')),
  created_at timestamptz not null default now(),
  unique (request_id, supplier_id)
);
alter table request_targets enable row level security;

create policy "request_targets: organisator beheert via aanvraag" on request_targets for all
  using (exists (select 1 from requests r join events e on e.id = r.event_id where r.id = request_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from requests r join events e on e.id = r.event_id where r.id = request_id and e.owner_id = auth.uid()));

create policy "request_targets: leverancier leest eigen toewijzingen" on request_targets for select
  using (exists (select 1 from suppliers s where s.id = supplier_id and s.owner_id = auth.uid()));

create policy "request_targets: leverancier werkt eigen status bij" on request_targets for update
  using (exists (select 1 from suppliers s where s.id = supplier_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from suppliers s where s.id = supplier_id and s.owner_id = auth.uid()));

create index if not exists idx_request_targets_request on request_targets(request_id);
create index if not exists idx_request_targets_supplier on request_targets(supplier_id);

-- ───────────── UITBREIDING BESTAANDE RLS ─────────────
-- Deze policies komen BOVENOP de bestaande organisator-policies uit
-- migratie 1 (die blijven ongewijzigd) — een leverancier krijgt zo alleen
-- extra, beperkte leestoegang tot precies de aanvragen/evenementen waar
-- hij voor is uitgenodigd, en mag alleen zijn eigen offertes indienen.

create policy "events: leverancier leest gerichte evenementen" on events for select
  using (exists (
    select 1 from requests r
    join request_targets rt on rt.request_id = r.id
    join suppliers s on s.id = rt.supplier_id
    where r.event_id = events.id and s.owner_id = auth.uid()
  ));

create policy "requests: leverancier leest gerichte aanvragen" on requests for select
  using (exists (
    select 1 from request_targets rt
    join suppliers s on s.id = rt.supplier_id
    where rt.request_id = requests.id and s.owner_id = auth.uid()
  ));

create policy "offers: leverancier dient eigen offerte in" on offers for insert
  with check (
    exists (select 1 from suppliers s where s.owner_id = auth.uid() and s.id::text = offers.supplier_id)
    and exists (
      select 1 from request_targets rt
      join suppliers s on s.id = rt.supplier_id
      where rt.request_id = offers.request_id and s.owner_id = auth.uid()
    )
  );

create policy "offers: leverancier leest eigen offertes" on offers for select
  using (exists (select 1 from suppliers s where s.owner_id = auth.uid() and s.id::text = offers.supplier_id));

create policy "payments: leverancier leest eigen uitbetalingen" on payments for select
  using (exists (
    select 1 from offers o
    join suppliers s on s.owner_id = auth.uid() and s.id::text = o.supplier_id
    where o.id = payments.offer_id
  ));

create index if not exists idx_offers_supplier on offers(supplier_id);

-- ───────────── ROL MEENEMEN BIJ REGISTRATIE ─────────────
-- Zelfde trigger als in migratie 1, nu ook met de rol (customer/supplier)
-- die is meegegeven bij het aanmelden.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'customer')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;
