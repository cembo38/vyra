-- ─────────────────────────────────────────────────────────────
-- Vyra — zelfbedienings-aanvraag voor een hoger abonnement
--
-- SubscriptionTierPicker.tsx toonde tot nu toe "Work in progress" bij elke
-- upgrade — er was geen enkele manier voor een leverancier om zelf naar een
-- hoger niveau te gaan zonder Cem los te mailen. Deze tabel maakt daar een
-- échte (zij het nog handmatig door Cem goedgekeurde) flow van: een
-- leverancier vraagt aan, Cem keurt goed/af op /admin/leveranciers, en pas
-- bij goedkeuring wordt het abonnement daadwerkelijk omgezet
-- (setSupplierSubscriptionTier). Dit is bewust NIET de uiteindelijke
-- betaalflow (zie het roadmap-item "Echte betaalflow (Stripe/escrow)") —
-- het is de tussenstap die ervoor zorgt dat niemand meer op een dode knop
-- stuit zolang die er nog niet is.
--
-- Zelfde RLS-vorm als `disputes` (migratie 0020): de betrokken leverancier
-- leest/maakt zijn eigen aanvraag, wijzigen (goedkeuren/afwijzen) gebeurt
-- uitsluitend server-side via de service-role-client (zie requireAdmin()
-- in lib/actions/admin-actions.ts) — bewust geen UPDATE-policy voor
-- gewone gebruikers.
--
-- Plak dit hieronder in de Supabase SQL Editor en klik "Run".

create table if not exists supplier_tier_upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  requested_tier text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  admin_response text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_tier_upgrade_requests_supplier on supplier_tier_upgrade_requests(supplier_id);
create index if not exists idx_tier_upgrade_requests_status on supplier_tier_upgrade_requests(status);

alter table supplier_tier_upgrade_requests enable row level security;

create policy "tier-upgrade: eigenaar leest eigen aanvragen" on supplier_tier_upgrade_requests for select
  using (auth.uid() = (select owner_id from suppliers where suppliers.id = supplier_id));

create policy "tier-upgrade: eigenaar maakt eigen aanvraag" on supplier_tier_upgrade_requests for insert
  with check (auth.uid() = (select owner_id from suppliers where suppliers.id = supplier_id));
