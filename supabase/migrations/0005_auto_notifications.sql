-- ───────────── AUTOMATISCHE HERINNERINGEN ─────────────
-- Ondersteunt "computed on view" auto-notificaties (zie ensureAutoNotifications
-- in lib/data/store.ts): bij het ophalen van iemands meldingen controleert de
-- app zelf op verlopen reactietermijnen, naderende planningsdeadlines en
-- budgetoverschrijding, en maakt daar zo nodig een melding van. dedupe_key
-- voorkomt dat dezelfde situatie telkens opnieuw een melding oplevert.
alter table notifications add column if not exists dedupe_key text;

create unique index if not exists idx_notifications_dedupe
  on notifications(user_id, dedupe_key)
  where dedupe_key is not null;
