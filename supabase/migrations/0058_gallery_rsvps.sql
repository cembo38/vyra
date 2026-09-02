-- ─────────────────────────────────────────────────────────────
-- Vyra — Deel C.5 vervolg: aanmeldingen via de uitnodiging (sep. 2026)
--
-- De "Bevestig komst"-knop op de uitnodiging (/uitnodiging/[token]) deed
-- nog niets. Dit voegt een privé aanmeldingenlijst toe: gasten vullen
-- naam + ja/misschien/nee + aantal personen + optionele opmerking in, de
-- organisator ziet dit terug op het "Gastenfoto's"-tabblad (nieuwe
-- sectie "Aanmeldingen") — bewust ZONDER moderatie en ZONDER publieke
-- weergave (Cems keuze), dus geen moderation_status-kolom zoals bij
-- gallery_photos/gallery_messages.
--
-- Zelfde toegangsmodel als de rest van dit deel: een SECURITY DEFINER
-- functie i.p.v. de tabel rechtstreeks open te zetten voor anonieme
-- bezoekers (zie de toelichting in 0052/0053 over waarom een rechtstreekse
-- RLS-policy met een subquery op event_galleries voor de anon-rol niet
-- werkt).
--
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
-- ─────────────────────────────────────────────────────────────

create table if not exists gallery_rsvps (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references event_galleries(id) on delete cascade,
  guest_name text not null,
  status text not null check (status in ('yes', 'maybe', 'no')),
  guest_count integer not null default 1 check (guest_count between 1 and 20),
  note text,
  created_at timestamptz not null default now()
);
alter table gallery_rsvps enable row level security;

-- Alleen de organisator (via event_galleries -> events) mag deze rijen
-- rechtstreeks lezen/beheren — zelfde patroon als gallery_photos/
-- gallery_messages hierboven.
create policy "gallery_rsvps: owner full access" on gallery_rsvps for all
  using (exists (select 1 from event_galleries g join events e on e.id = g.event_id where g.id = gallery_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from event_galleries g join events e on e.id = g.event_id where g.id = gallery_id and e.owner_id = auth.uid()));

create index if not exists idx_gallery_rsvps_gallery on gallery_rsvps(gallery_id);

-- Aanmelden is bewust alleen mogelijk bij Premium (net als het
-- uitnodigingssjabloon zelf) — server-side herhaald voor het geval iemand
-- deze functie rechtstreeks aanroept i.p.v. via de UI/actie.
create or replace function public.submit_gallery_rsvp(p_upload_token uuid, p_guest_name text, p_status text, p_guest_count integer, p_note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gallery_id uuid;
  v_tier text;
  v_new_id uuid;
begin
  if p_guest_name is null or trim(p_guest_name) = '' then
    raise exception 'Vul je naam in.';
  end if;
  if p_status not in ('yes', 'maybe', 'no') then
    raise exception 'Onbekende status.';
  end if;

  select g.id, g.tier into v_gallery_id, v_tier
  from event_galleries g
  where g.upload_token = p_upload_token and g.status = 'active' and (g.expires_at is null or g.expires_at >= current_date);

  if v_gallery_id is null then
    raise exception 'Deze uitnodiging is niet (meer) actief.';
  end if;
  if v_tier <> 'premium' then
    raise exception 'Aanmelden is alleen beschikbaar bij Premium.';
  end if;

  insert into gallery_rsvps (gallery_id, guest_name, status, guest_count, note)
  values (
    v_gallery_id,
    left(trim(p_guest_name), 100),
    p_status,
    greatest(1, least(coalesce(p_guest_count, 1), 20)),
    nullif(left(trim(coalesce(p_note, '')), 500), '')
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;
grant execute on function public.submit_gallery_rsvp(uuid, text, text, integer, text) to anon, authenticated;
