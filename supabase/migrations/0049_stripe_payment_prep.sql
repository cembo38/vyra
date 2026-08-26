-- ─────────────────────────────────────────────────────────────
-- Vyra — voorbereiding echte betaalflow via Stripe Connect (migratie 49)
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
--
-- Spec-item #132: dit is NADRUKKELIJK ALLEEN VOORBEREIDING — het
-- datamodel en de RLS-grenzen voor een toekomstige échte betaalflow, niet
-- de betaalflow zelf. Er wordt hier geen geld verwerkt en er is geen
-- Stripe-account nodig om deze migratie te draaien. Zolang
-- STRIPE_WEBHOOK_SECRET niet gezet is (zie .env.example), gebeurt er
-- nergens iets nieuws met deze tabellen/kolommen — de bestaande
-- "reken rechtstreeks af met de leverancier"-checkoutpagina blijft
-- ongewijzigd werken.
--
-- Het beoogde toekomstige model (zodra Cem zelf een Stripe-account
-- aansluit): organisator betaalt het volledige bedrag via Stripe Checkout,
-- Vyra houdt dat bedrag vast op zijn eigen Stripe-balans (vandaar
-- `payout_status = 'held'`), en maakt er ná de dienst een Stripe Connect-
-- transfer van naar de bankrekening van de leverancier, met de
-- Vyra-commissie ingehouden (`payout_status = 'released'`). Dat is ook
-- meteen de "escrow" uit de spec-titel: geen aparte externe
-- escrow-dienst, maar het vertragen van de Connect-transfer tot na
-- levering — een standaard, breed gebruikt Stripe Connect-patroon voor
-- marktplaatsen.
--
-- Twee delen:
--
-- 1) `supplier_stripe_accounts` — koppeling tussen een Vyra-leverancier en
--    zijn Stripe Connect-account (voor uitbetalingen). Aparte tabel i.p.v.
--    kolommen op `suppliers` zelf, om dezelfde reden als
--    `supplier_ical_tokens` (migratie 46): `suppliers` heeft een
--    "iedereen leest"-policy voor het publieke profiel, en een
--    Stripe-account-id hoort daar niet publiek in te staan. Belangrijker
--    verschil met die eerdere tabel: hier mag de leverancier zelf NIETS
--    schrijven (ook geen eigen token/id aanmaken) — `charges_enabled`/
--    `payouts_enabled` zijn beweringen die alleen Stripe zelf kan
--    bevestigen (via de `account.updated`-webhook). Zou de leverancier dit
--    zelf mogen zetten, dan kan hij simpelweg `payouts_enabled = true`
--    invullen zonder dat Stripe dat ooit heeft goedgekeurd. Daarom: wél
--    een select-policy (de leverancier mag zijn eigen koppelstatus zien),
--    geen enkele insert/update/delete-policy (alleen de service-role kan
--    schrijven, dus alleen via app/api/webhooks/stripe/route.ts of een
--    toekomstige onboarding-server-actie).
--
-- 2) Stripe-/uitbetaalkolommen op de bestaande `payments`-tabel, plus een
--    uitbreiding van de bestaande onveranderlijkheids-trigger (migratie 35)
--    zodat die nieuwe kolommen ná aanmaak ALLEEN via de service-role
--    mogen wijzigen — nooit door de organisator zelf, ook niet tijdens de
--    daar al toegestane pending→paid-overgang. Zonder die uitbreiding zou
--    een organisator in dezelfde update ook zelf `payout_status` op
--    "released" kunnen zetten of een verzonnen `stripe_transfer_id`
--    kunnen invullen.
-- ─────────────────────────────────────────────────────────────

create table if not exists supplier_stripe_accounts (
  supplier_id uuid primary key references suppliers(id) on delete cascade,
  stripe_account_id text unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);
alter table supplier_stripe_accounts enable row level security;

-- GEEN insert/update/delete-policy — expres, zie toelichting hierboven.
create policy "supplier_stripe_accounts: eigenaar leest eigen" on supplier_stripe_accounts for select
  using (exists (select 1 from suppliers s where s.id = supplier_id and s.owner_id = auth.uid()));

create index if not exists idx_supplier_stripe_accounts_stripe_account_id on supplier_stripe_accounts(stripe_account_id);

alter table payments add column if not exists stripe_payment_intent_id text;
alter table payments add column if not exists stripe_checkout_session_id text;
alter table payments add column if not exists stripe_transfer_id text;
alter table payments add column if not exists payout_status text not null default 'not_applicable'
  check (payout_status in ('not_applicable', 'held', 'released'));
alter table payments add column if not exists payout_released_at timestamptz;

create unique index if not exists idx_payments_stripe_payment_intent_id on payments(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create unique index if not exists idx_payments_stripe_checkout_session_id on payments(stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create unique index if not exists idx_payments_stripe_transfer_id on payments(stripe_transfer_id) where stripe_transfer_id is not null;

create or replace function public.protect_payment_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if new.event_id is distinct from old.event_id
    or new.offer_id is distinct from old.offer_id
    or new.category_key is distinct from old.category_key
    or new.supplier_amount_cents is distinct from old.supplier_amount_cents
    or new.platform_fee_cents is distinct from old.platform_fee_cents
    or new.total_cents is distinct from old.total_cents
    or new.commission_rate is distinct from old.commission_rate
    or new.commission_tier is distinct from old.commission_tier
    or new.provider is distinct from old.provider
    or new.installment is distinct from old.installment
    or new.parent_payment_id is distinct from old.parent_payment_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'payments: alleen status en paid_at mogen wijzigen na aanmaak';
  end if;

  -- Nieuw in migratie 49: de Stripe-/uitbetaalkolommen mogen ná aanmaak
  -- alleen via de service-role wijzigen (de toekomstige webhook-route),
  -- nooit door de organisator zelf — zie de toelichting bovenaan dit
  -- bestand.
  if auth.role() is distinct from 'service_role' and (
    new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
    or new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id
    or new.stripe_transfer_id is distinct from old.stripe_transfer_id
    or new.payout_status is distinct from old.payout_status
    or new.payout_released_at is distinct from old.payout_released_at
  ) then
    raise exception 'payments: Stripe-/uitbetaalvelden mogen alleen via de service-role wijzigen';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_payment_immutable_fields on payments;
create trigger trg_protect_payment_immutable_fields
  before update on payments
  for each row
  execute function public.protect_payment_immutable_fields();
