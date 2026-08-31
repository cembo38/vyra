-- ─────────────────────────────────────────────────────────────
-- Vyra — nieuw tarievenmodel voor leveranciers + echte Stripe-facturering
-- (migratie 50)
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run"
-- NADAT alle eerdere migraties al zijn uitgevoerd.
--
-- Op verzoek van Cem (aug. 2026), drie wijzigingen t.o.v. het vijflaags-
-- model van migratie 25 — zie lib/config.ts voor de volledige toelichting
-- en de exacte tarieven/perks per niveau:
--
-- 1) "Enterprise" (voorheen "vanaf €299/maand, op maat") is VERWIJDERD.
--    Premium blijft het hoogste, vast geprijsde niveau. Bestaande
--    'enterprise'-leveranciers gaan naar 'premium' (zie de UPDATE
--    hieronder, vóórdat de CHECK-constraint wordt aangescherpt — exact
--    hetzelfde patroon als migratie 25 destijds voor 'pro_subscribed'
--    gebruikte).
-- 2) Nieuw niveau "Instap" toegevoegd — gratis, geen abonnementsgeld, een
--    vlakke 9%-commissie per boeking. Dit is de nieuwe DEFAULT voor elke
--    nieuwe leverancier (i.p.v. 'starter' voorheen).
-- 3) Leveranciers-abonnementen lopen voortaan via ECHTE Stripe-facturering
--    (i.p.v. dat Cem handmatig een Payment Link stuurt) — vandaar de
--    nieuwe Stripe-/facturatiekolommen hieronder. Dit is een aparte
--    koppeling van de al bestaande `supplier_stripe_accounts`-tabel
--    (migratie 49, die is voor UITBETALEN aan de leverancier via Stripe
--    Connect) — hier gaat het om het BETALEN van de leverancier ZELF aan
--    Vyra voor zijn abonnement, dus een gewone Stripe Customer +
--    Subscription, geen Connect-account.
-- ─────────────────────────────────────────────────────────────

-- Bestaande 'enterprise'-leveranciers eerst verplaatsen, vóórdat de
-- CHECK-constraint die waarde niet meer toestaat.
update suppliers set subscription_tier = 'premium' where subscription_tier = 'enterprise';

alter table suppliers drop constraint if exists suppliers_subscription_tier_check;
alter table suppliers alter column subscription_tier set default 'instap';
alter table suppliers add constraint suppliers_subscription_tier_check
  check (subscription_tier in ('instap', 'starter', 'groei', 'pro', 'premium'));

-- Nieuwe kolommen voor de echte Stripe-abonnementskoppeling. Bewust
-- `subscription_price_cents` als apart, vastgelegd bedrag i.p.v. dit altijd
-- live uit lib/config.ts op te zoeken: een leverancier die vorig jaar voor
-- €49/maand tekende, moet dat bedrag blijven zien/betalen ook als de
-- lijstprijs in lib/config.ts later wijzigt — zelfde gedachte als
-- `payments.commission_tier`, die ook al per boeking wordt vastgelegd i.p.v.
-- live herberekend.
alter table suppliers add column if not exists stripe_customer_id text;
alter table suppliers add column if not exists stripe_subscription_id text;
alter table suppliers add column if not exists subscription_status text not null default 'active'
  check (subscription_status in ('active', 'past_due', 'canceled', 'incomplete'));
alter table suppliers add column if not exists billing_interval text
  check (billing_interval in ('monthly', 'annual'));
alter table suppliers add column if not exists subscription_price_cents integer;

create unique index if not exists idx_suppliers_stripe_customer_id on suppliers(stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists idx_suppliers_stripe_subscription_id on suppliers(stripe_subscription_id) where stripe_subscription_id is not null;

-- payments.commission_tier moet nu ook 'instap' kunnen vastleggen. De oude
-- waarden ('intro'/'tiered'/'enterprise', zie migratie 25) blijven
-- toegestaan zodat historische rijen van vóór deze migratie geldig blijven
-- — nooit bestaande data laten breken.
alter table payments drop constraint if exists payments_commission_tier_check;
alter table payments add constraint payments_commission_tier_check
  check (commission_tier in ('intro', 'tiered', 'pro', 'trial', 'instap', 'starter', 'groei', 'premium', 'enterprise'));
