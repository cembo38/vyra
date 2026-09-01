-- ─────────────────────────────────────────────────────────────
-- Vyra — Feedback-FAB: "ik heb een vraag" / "het werkt niet" (sep. 2026)
--
-- Cem wil op elke pagina een kleine knop waarmee zowel ingelogde als
-- anonieme bezoekers meteen een vraag kunnen stellen of een bug kunnen
-- melden — vooral dat laatste, zodat hij het weet zodra iets kapot is.
--
-- feedback_reports is een leaf table (niets anders leest 'm terug via
-- RLS), dus geen SECURITY DEFINER-omweg nodig zoals bij migratie
-- 0052/0053 — alleen een simpele INSERT-policy die voor IEDEREEN openstaat
-- (net als de gastenfoto-upload moet dit ook zonder inloggen werken), met
-- als enige check dat een ingelogde gebruiker geen andere user_id dan
-- zichzelf kan invullen. Lezen/afhandelen gebeurt uitsluitend server-side
-- via de service-role client in de admin-omgeving — exact hetzelfde
-- patroon als disputes (migratie 0020): bewust GEEN SELECT/UPDATE-policy
-- voor gewone gebruikers.
--
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
-- ─────────────────────────────────────────────────────────────

create table if not exists feedback_reports (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('question', 'bug')),
  message text not null,
  page_path text,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  role text,
  user_agent text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  admin_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_reports_status on feedback_reports(status);
create index if not exists idx_feedback_reports_created on feedback_reports(created_at desc);

alter table feedback_reports enable row level security;

create policy "feedback_reports: iedereen meldt" on feedback_reports for insert
  with check (user_id is null or user_id = auth.uid());
