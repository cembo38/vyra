-- ─────────────────────────────────────────────────────────────
-- Vyra — Deel C.5: uitnodigingssjablonen (Premium, sep. 2026)
--
-- Voegt aan event_galleries toe wat een organisator instelt voor de
-- gedeelde uitnodigingsafbeelding: welk sjabloon (kolom bestond al sinds
-- 0052), een optionele titel-override, een optionele welkomstzin, en een
-- optioneel eigen foto-pad. Werkt alleen bij tier = 'premium' (afgedwongen
-- server-side in de acties, niet hier in de database — zelfde patroon als
-- de video/gastenboek-checks in submit_gallery_photo/message).
--
-- De organisator-foto gaat naar dezelfde "gallery-media"-bucket als
-- gastenfoto's (geen nieuwe bucket nodig), maar onder een eigen, duidelijk
-- gescheiden pad-schema: `invitations/<event_id>/...` i.p.v.
-- `<upload_token>/...` — zo kan de bestaande gast-uploadpolicy (die op het
-- EERSTE mapniveau al het volledige upload_token verwacht) hier nooit
-- per ongeluk mee overlappen, en heeft de organisator-upload een eigen,
-- simpele eigenaar-check (via events.owner_id) nodig — geen SECURITY
-- DEFINER-omweg nodig, want de organisator is gewoon ingelogd.
--
-- get_gallery_public() moet opnieuw (net als in 0054) met DROP+CREATE,
-- omdat het return-type wijzigt — dit keer om de uitnodigingsvelden erbij
-- te geven aan de publieke deel-pagina (/uitnodiging/[token]).
--
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
-- ─────────────────────────────────────────────────────────────

alter table event_galleries add column if not exists invitation_photo_path text;
alter table event_galleries add column if not exists invitation_title text;
alter table event_galleries add column if not exists invitation_welcome_text text;

create policy "gallery-media: organisator uploadt uitnodigingsfoto" on storage.objects for insert
  with check (
    bucket_id = 'gallery-media'
    and (storage.foldername(name))[1] = 'invitations'
    and exists (select 1 from events e where e.id::text = (storage.foldername(name))[2] and e.owner_id = auth.uid())
  );

create policy "gallery-media: organisator overschrijft eigen uitnodigingsfoto" on storage.objects for update
  using (
    bucket_id = 'gallery-media'
    and (storage.foldername(name))[1] = 'invitations'
    and exists (select 1 from events e where e.id::text = (storage.foldername(name))[2] and e.owner_id = auth.uid())
  );

create policy "gallery-media: organisator verwijdert eigen uitnodigingsfoto" on storage.objects for delete
  using (
    bucket_id = 'gallery-media'
    and (storage.foldername(name))[1] = 'invitations'
    and exists (select 1 from events e where e.id::text = (storage.foldername(name))[2] and e.owner_id = auth.uid())
  );

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
  invitation_photo_path text
)
language sql
security definer
set search_path = public
as $$
  select
    e.name, e.date, e.start_time, e.location_label, p.first_name,
    g.tier, g.theme, g.status, g.expires_at,
    g.invitation_template_key, g.invitation_title, g.invitation_welcome_text, g.invitation_photo_path
  from event_galleries g
  join events e on e.id = g.event_id
  left join profiles p on p.id = e.owner_id
  where g.upload_token = p_upload_token
$$;
grant execute on function public.get_gallery_public(uuid) to anon, authenticated;
