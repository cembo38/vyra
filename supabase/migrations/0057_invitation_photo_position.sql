-- ─────────────────────────────────────────────────────────────
-- Vyra — Deel C.5 vervolg: verplaatsbare uitnodigingsfoto (sep. 2026)
--
-- Cem: de geüploade foto werd "lukraak geplaatst" — object-fit: cover
-- knipt standaard vanuit het midden, en er was geen manier om te kiezen
-- welk deel van de foto zichtbaar blijft. Deze migratie voegt twee
-- percentage-kolommen toe (0-100, standaard 50 = gecentreerd) die
-- bijhouden waar de organisator de foto naartoe heeft gesleept — de
-- editor gebruikt dit als CSS object-position, zie InvitationCard.tsx.
--
-- get_gallery_public() moet opnieuw (net als in 0054/0056) met
-- DROP+CREATE, omdat het return-type wijzigt — de publieke deelpagina
-- (/uitnodiging/[token]) moet de foto ook op de juiste positie tonen.
--
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
-- ─────────────────────────────────────────────────────────────

alter table event_galleries add column if not exists invitation_photo_position_x integer not null default 50 check (invitation_photo_position_x between 0 and 100);
alter table event_galleries add column if not exists invitation_photo_position_y integer not null default 50 check (invitation_photo_position_y between 0 and 100);

drop function if exists public.get_gallery_public(uuid);

create or replace function public.get_gallery_public(p_upload_token uuid)
returns table (
  event_name text,
  event_date date,
  event_start_time text,
  event_location_label text,
  organizer_first_name text,
  tier text,
  theme text,
  status text,
  expires_at date,
  invitation_template_key text,
  invitation_title text,
  invitation_welcome_text text,
  invitation_photo_path text,
  invitation_photo_position_x integer,
  invitation_photo_position_y integer
)
language sql
security definer
set search_path = public
as $$
  select
    e.name, e.date, e.start_time, e.location_label, p.first_name,
    g.tier, g.theme, g.status, g.expires_at,
    g.invitation_template_key, g.invitation_title, g.invitation_welcome_text,
    g.invitation_photo_path, g.invitation_photo_position_x, g.invitation_photo_position_y
  from event_galleries g
  join events e on e.id = g.event_id
  left join profiles p on p.id = e.owner_id
  where g.upload_token = p_upload_token
$$;
grant execute on function public.get_gallery_public(uuid) to anon, authenticated;
