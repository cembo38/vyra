-- ─────────────────────────────────────────────────────────────
-- Vyra — referral-programma + losse Spotlight-boost
--
-- Twee samenhangende toevoegingen (vandaar één migratie): allebei geven ze
-- een leverancier extra "bonus_spotlight_credits" bovenop zijn gewone
-- maandelijkse gratis quotum (SPOTLIGHT_MONTHLY_QUOTA, lib/config.ts) —
-- via een vriend uitnodigen die zich aanmeldt, of via een los aangevraagde
-- boost. `bonus_spotlight_credits` wordt verbruikt vóór het gewone quotum
-- niet wordt aangesproken (zie activateSpotlightAction in
-- lib/actions/supplier-actions.ts) en verloopt nooit vanzelf.
--
-- Referral-beloning wordt toegekend op het moment van AANMELDEN van de
-- uitgenodigde gebruiker (niet pas bij een eerste boeking o.i.d.) — een
-- bewuste, eenvoudige eerste versie; zie de toelichting bij
-- grantReferralRewardIfEligible() in lib/data/store.ts voor de afweging.
--
-- Een losse Spotlight-boost kan nog niet écht worden AFGEREKEND (Vyra
-- verwerkt nog geen betalingen zelf, zie de toelichting op de
-- checkout-pagina) — dit is dus, net als een abonnementsupgrade
-- (migratie 0040), een zelfbedienings-AANVRAAG die Cem persoonlijk
-- goedkeurt/afwijst.
--
-- Plak dit hieronder in de Supabase SQL Editor en klik "Run".

alter table profiles add column if not exists referred_by uuid references auth.users(id) on delete set null;
alter table suppliers add column if not exists bonus_spotlight_credits integer not null default 0;

-- Zelfde `handle_new_user()`-functie als migratie 0023, nu ook met
-- `referred_by` uit de signup-metadata. Valideert dat de meegegeven id
-- daadwerkelijk een bestaande gebruiker is (en niet de nieuwe gebruiker
-- zelf) — anders blijft het stil op NULL i.p.v. de hele registratie te
-- laten mislukken op een foutieve/verzonnen referral-link.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  ref_id uuid;
begin
  begin
    ref_id := (new.raw_user_meta_data->>'referred_by')::uuid;
  exception when others then
    ref_id := null;
  end;
  if ref_id is not null and (ref_id = new.id or not exists (select 1 from auth.users where id = ref_id)) then
    ref_id := null;
  end if;

  insert into public.profiles (id, email, first_name, last_name, role, referred_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    case new.raw_user_meta_data->>'role'
      when 'supplier' then 'supplier'
      when 'both' then 'both'
      else 'customer'
    end,
    ref_id
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create table if not exists spotlight_boost_requests (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  admin_response text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_spotlight_boost_requests_supplier on spotlight_boost_requests(supplier_id);
create index if not exists idx_spotlight_boost_requests_status on spotlight_boost_requests(status);

alter table spotlight_boost_requests enable row level security;

create policy "boost-aanvraag: eigenaar leest eigen aanvragen" on spotlight_boost_requests for select
  using (auth.uid() = (select owner_id from suppliers where suppliers.id = supplier_id));

create policy "boost-aanvraag: eigenaar maakt eigen aanvraag" on spotlight_boost_requests for insert
  with check (auth.uid() = (select owner_id from suppliers where suppliers.id = supplier_id));
