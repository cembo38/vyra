-- ─────────────────────────────────────────────────────────────
-- Vyra — leveranciers-abonnementenmodel (migratie 25)
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run"
-- NADAT alle eerdere migraties al zijn uitgevoerd.
--
-- SaaS-pivot (spec-item #53, vervolg): vervangt het aan/uit Vyra
-- Pro-vinkje door vijf abonnementsniveaus (Starter/Groei/Pro/Premium/
-- Enterprise) — zie lib/config.ts voor de volledige toelichting en de
-- exacte tarieven/perks per niveau. Bestaande Pro-abonnees
-- (pro_subscribed = true) gaan automatisch naar 'pro', iedereen anders
-- start op 'starter' (de instap-standaard). De oude
-- pro_subscribed/pro_subscribed_at kolommen blijven gewoon bestaan (geen
-- destructieve wijziging) maar worden vanaf nu niet meer door de app
-- gebruikt.
-- ─────────────────────────────────────────────────────────────

alter table suppliers add column if not exists subscription_tier text not null default 'starter'
  check (subscription_tier in ('starter', 'groei', 'pro', 'premium', 'enterprise'));

update suppliers set subscription_tier = 'pro' where pro_subscribed = true and subscription_tier = 'starter';

-- payments.commission_tier moet nu ook de nieuwe niveaus + 'trial' kunnen
-- vastleggen, naast de oude 'intro'/'tiered'/'pro' (die historische rijen
-- kunnen nog bevatten — een CHECK-constraint wordt bij toevoegen ook tegen
-- bestaande rijen gevalideerd, dus de oude waarden blijven toegestaan).
alter table payments drop constraint if exists payments_commission_tier_check;
alter table payments add constraint payments_commission_tier_check
  check (commission_tier in ('intro', 'tiered', 'pro', 'trial', 'starter', 'groei', 'premium', 'enterprise'));
