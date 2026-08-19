-- ─────────────────────────────────────────────────────────────
-- Vyra — nieuw commissiemodel (migratie 18)
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run"
-- NADAT alle eerdere migraties al zijn uitgevoerd.
--
-- Onderdeel van spec-item #53 ("ander model dan de vlakke 9,5%
-- commissie"): vervangt het ene vaste percentage door drie lagen —
-- een laag instaptarief voor een leverancier zijn eerste boekingen, een
-- gestaffeld tarief afhankelijk van het boekingsbedrag daarna, en een
-- optioneel "Vyra Pro"-abonnement (vast maandbedrag i.p.v. commissie) voor
-- grote/veelboekende leveranciers. Zie lib/config.ts voor de volledige
-- toelichting en de exacte tarieven.
-- ─────────────────────────────────────────────────────────────

alter table suppliers add column if not exists pro_subscribed boolean not null default false;
alter table suppliers add column if not exists pro_subscribed_at timestamptz;

-- Bewaart welke laag gold op het moment dat een betaling werd aangemaakt
-- (naast het al bestaande `commission_rate`) — puur informatief/auditeerbaar,
-- zodat je later kunt terugzien of een betaling tegen instap-, gestaffeld-
-- of Pro-tarief liep. Bestaande rijen krijgen 'tiered' als nette default
-- (het oude, vlakke 9,5%-tarief hoort qua vorm het dichtst bij deze laag).
alter table payments add column if not exists commission_tier text not null default 'tiered'
  check (commission_tier in ('intro', 'tiered', 'pro'));
