-- ─────────────────────────────────────────────────────────────
-- Vyra — AI-interactielogboek ("beveiligde omgeving")
--
-- Elke AI-aanroep (Event Understanding, Question Generator, Requirement
-- Generator, Timeline/Budget Assistant, Event Manager chat, Supplier
-- Response Assistant) wordt hier gelogd: rol, gebruiker, evenement, de
-- invoer, de uitvoer, of de aanroep gelukt is, en of de invoer als
-- verdacht (mogelijke prompt injection) is gemarkeerd. Dit stelt de
-- platformbeheerder in staat om achteraf mee te lezen als er iets misgaat.
--
-- Er is bewust GEEN RLS-policy die deze tabel voor gewone gebruikers
-- opent: schrijven gebeurt uitsluitend server-side (via de service-role
-- context van de server actions), lezen gebeurt uitsluitend vanuit het
-- admin-dashboard met de Supabase service-role key (die RLS omzeilt).
-- ─────────────────────────────────────────────────────────────

create table if not exists ai_interaction_logs (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  user_id uuid references auth.users(id) on delete set null,
  event_id uuid references events(id) on delete set null,
  input text not null,
  output text,
  succeeded boolean not null default true,
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

alter table ai_interaction_logs enable row level security;

-- Schrijven gebeurt vanuit server actions (met de sessie van de gebruiker
-- die op dat moment een AI-functie gebruikt, ingelogd of anoniem bij een
-- publieke preview) — dus staat insert open. Lezen (select) heeft bewust
-- géén policy: dat kan alleen via de service-role key in het admin-dashboard.
create policy "ai_logs: server kan loggen" on ai_interaction_logs for insert
  with check (true);

create index if not exists idx_ai_logs_created on ai_interaction_logs(created_at desc);
create index if not exists idx_ai_logs_flagged on ai_interaction_logs(flagged) where flagged = true;
create index if not exists idx_ai_logs_user on ai_interaction_logs(user_id);
