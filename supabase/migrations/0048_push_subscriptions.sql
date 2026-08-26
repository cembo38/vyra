-- ─────────────────────────────────────────────────────────────
-- Vyra — browser-pushmeldingen (migratie 48)
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run"
-- NADAT migratie 47 al is uitgevoerd.
--
-- Spec-item #131: "e-mail/push bij proactieve Enterprise-signalen" — de
-- cronjob in app/api/cron/supplier-proactive-signals stuurde tot nu toe
-- alleen in-app-meldingen. Deze tabel bewaart Web Push-abonnementen (het
-- resultaat van de browser-eigen `PushManager.subscribe()`, geen externe
-- partij nodig) zodat die cronjob straks ook een échte browser-melding kan
-- afvuren, zelfs als de leverancier Vyra niet open heeft staan.
-- ─────────────────────────────────────────────────────────────

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;

create policy "push_subscriptions: eigenaar beheert eigen abonnementen" on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);
