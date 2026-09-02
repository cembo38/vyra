-- ─────────────────────────────────────────────────────────────
-- Vyra — Aanmeldingen via de uitnodiging ook in de Gastenlijst (sep. 2026)
--
-- Cems melding: hij klikte "Ik kom" op de uitnodiging, en zag dat niet
-- terug in het tabblad "Gastenlijst" — alleen in de "Aanmeldingen"-sectie
-- onder "Gastenfoto's" (migratie 0058). Dat was ook precies de bedoeling
-- toen (bewust een aparte, private lijst, zie de toelichting in 0058) —
-- maar Cem wil nu dat een aanmelding ook meteen als gast meetelt.
--
-- Fix: `submit_gallery_rsvp()` maakt voortaan ATOMAIR (binnen dezelfde
-- functie/transactie) naast de gallery_rsvps-rij ook een echte
-- event_guests-rij aan — met group_label 'Via uitnodiging' zodat in de
-- Gastenlijst meteen duidelijk is dat dit geen handmatig toegevoegde gast
-- is. De twee rijen worden aan elkaar gekoppeld via de nieuwe
-- gallery_rsvps.guest_id-kolom, zodat "verwijderen" bij Aanmeldingen ook
-- de bijbehorende Gastenlijst-rij opruimt (zie deleteGalleryRsvp in
-- lib/data/store.ts) — zonder die koppeling zouden de twee lijsten na een
-- verwijdering uit elkaar gaan lopen.
--
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
-- ─────────────────────────────────────────────────────────────

alter table gallery_rsvps add column if not exists guest_id uuid references event_guests(id) on delete set null;

create or replace function public.submit_gallery_rsvp(p_upload_token uuid, p_guest_name text, p_status text, p_guest_count integer, p_note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gallery_id uuid;
  v_event_id uuid;
  v_tier text;
  v_clean_name text;
  v_clean_note text;
  v_guest_count int;
  v_guest_id uuid;
  v_new_id uuid;
begin
  if p_guest_name is null or trim(p_guest_name) = '' then
    raise exception 'Vul je naam in.';
  end if;
  if p_status not in ('yes', 'maybe', 'no') then
    raise exception 'Onbekende status.';
  end if;

  select g.id, g.event_id, g.tier into v_gallery_id, v_event_id, v_tier
  from event_galleries g
  where g.upload_token = p_upload_token and g.status = 'active' and (g.expires_at is null or g.expires_at >= current_date);

  if v_gallery_id is null then
    raise exception 'Deze uitnodiging is niet (meer) actief.';
  end if;
  if v_tier <> 'premium' then
    raise exception 'Aanmelden is alleen beschikbaar bij Premium.';
  end if;

  v_clean_name := left(trim(p_guest_name), 100);
  v_clean_note := nullif(left(trim(coalesce(p_note, '')), 500), '');
  v_guest_count := greatest(1, least(coalesce(p_guest_count, 1), 20));

  -- Meteen ook een gast aanmaken, zodat deze aanmelding meetelt in de
  -- Gastenlijst-tab (zie toelichting hierboven).
  insert into event_guests (event_id, name, group_label, plus_ones, dietary_notes, rsvp_status, responded_at)
  values (v_event_id, v_clean_name, 'Via uitnodiging', v_guest_count - 1, v_clean_note, p_status, now())
  returning id into v_guest_id;

  insert into gallery_rsvps (gallery_id, guest_name, status, guest_count, note, guest_id)
  values (v_gallery_id, v_clean_name, p_status, v_guest_count, v_clean_note, v_guest_id)
  returning id into v_new_id;

  return v_new_id;
end;
$$;
grant execute on function public.submit_gallery_rsvp(uuid, text, text, integer, text) to anon, authenticated;
