-- ─────────────────────────────────────────────────────────────
-- Vyra — zelfbedienings-verzoek tot accountverwijdering (AVG/GDPR)
--
-- Zelfde vorm als supplier_tier_upgrade_requests (migratie 0040): de
-- gebruiker dient zelf een verzoek in (self-service), maar de daadwerkelijke
-- (onomkeerbare!) verwijdering gebeurt pas na handmatige beoordeling door
-- Cem op /admin — bewust GEEN automatische cascade-delete direct vanuit
-- deze actie. Een account kan lopende boekingen, openstaande betalingen of
-- een geschil hebben; die moeten eerst netjes afgehandeld worden voordat
-- er iets onomkeerbaars gebeurt. Dat is precies waarom dit een "verzoek"-
-- tabel is en geen directe DELETE-actie.
--
-- Plak dit hieronder in de Supabase SQL Editor en klik "Run".

create table if not exists account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  admin_response text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_account_deletion_requests_user on account_deletion_requests(user_id);
create index if not exists idx_account_deletion_requests_status on account_deletion_requests(status);

alter table account_deletion_requests enable row level security;

create policy "accountverwijdering: eigenaar leest eigen verzoeken" on account_deletion_requests for select
  using (auth.uid() = user_id);

create policy "accountverwijdering: eigenaar maakt eigen verzoek" on account_deletion_requests for insert
  with check (auth.uid() = user_id);
