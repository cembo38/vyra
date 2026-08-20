-- ─────────────────────────────────────────────────────────────
-- Vyra — Dagelijks AI-team-rapport voor de platformeigenaar (spec-item
-- #52 vervolg).
--
-- Cem heeft weinig tijd om zelf dagelijks door /admin te spitten. Deze
-- twee tabellen dragen een dagelijks, door een cronjob gegenereerd
-- rapport ("admin_briefings") met daaronder losse punten
-- ("admin_briefing_items") — nieuwe leveranciersaanmeldingen,
-- openstaande verificaties, geschillen, gemarkeerde AI-interacties,
-- financiële samenvatting. Elk punt heeft een eigen status (open/
-- approved/dismissed) zodat een eenmaal afgehandeld punt niet elke dag
-- opnieuw verschijnt.
--
-- Zelfde pattern als ai_interaction_logs (0007): platformbrede, puur
-- interne data. Schrijven gebeurt uitsluitend server-side via de
-- service-role client (de cronjob in app/api/cron/daily-briefing, of de
-- "Genereer nu"-server action) en lezen/wijzigen (goedkeuren/afwijzen)
-- uitsluitend vanuit het admin-dashboard, ook via de service-role
-- client (zie requireAdmin() in lib/actions/admin-actions.ts). Bewust
-- GEEN RLS-policy voor gewone gebruikers.
-- ─────────────────────────────────────────────────────────────

create table if not exists admin_briefings (
  id uuid primary key default gen_random_uuid(),
  coordinator_summary text not null,
  -- Eén korte kopzin per "teamlid", bv. {"Leveranciers & Verificatie": "..."}
  -- — apart van admin_briefing_items zodat een team ook zonder punten
  -- toch "even inchecken" met een kopzin (bv. "Niets te melden vandaag.").
  team_headlines jsonb not null default '{}'::jsonb,
  since timestamptz not null,
  used_ai boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists admin_briefing_items (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references admin_briefings(id) on delete cascade,
  team_member text not null,
  kind text not null check (kind in ('supplier_verification', 'dispute', 'new_supplier', 'new_users', 'flagged_ai', 'financial')),
  title text not null,
  description text not null,
  requires_approval boolean not null default false,
  related_type text,
  related_id text,
  status text not null default 'open' check (status in ('open', 'approved', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table admin_briefings enable row level security;
alter table admin_briefing_items enable row level security;

create index if not exists idx_admin_briefings_created on admin_briefings(created_at desc);
create index if not exists idx_admin_briefing_items_briefing on admin_briefing_items(briefing_id);
create index if not exists idx_admin_briefing_items_status on admin_briefing_items(briefing_id, status);
