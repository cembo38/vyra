-- ─────────────────────────────────────────────────────────────
-- Vyra — Voornaam organisator toevoegen aan de publieke gastenfoto-info
-- (sep. 2026, vervolg op migratie 0052/0053)
--
-- Cem wil de gastenpagina persoonlijker maken: "[Evenementnaam] van
-- [Voornaam]" i.p.v. alleen de evenementnaam. get_gallery_public() gaf tot
-- nu toe geen organisatorgegevens terug (die tabel, profiles, is
-- RLS-beschermd — precies zoals event_galleries dat was vóór migratie
-- 0053 — dus dit moet, net als daar, via de SECURITY DEFINER-bypass).
--
-- Postgres staat geen wijziging van het return-type van een bestaande
-- functie toe via CREATE OR REPLACE, dus eerst droppen.
--
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
-- ─────────────────────────────────────────────────────────────

drop function if exists public.get_gallery_public(uuid);

create or replace function public.get_gallery_public(p_upload_token uuid)
returns table (
  event_name text,
  event_date date,
  organizer_first_name text,
  tier text,
  theme text,
  status text,
  expires_at date
)
language sql
security definer
set search_path = public
as $$
  select e.name, e.date, p.first_name, g.tier, g.theme, g.status, g.expires_at
  from event_galleries g
  join events e on e.id = g.event_id
  left join profiles p on p.id = e.owner_id
  where g.upload_token = p_upload_token
$$;
grant execute on function public.get_gallery_public(uuid) to anon, authenticated;
