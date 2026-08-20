-- ─────────────────────────────────────────────────────────────
-- Vyra — submit_rsvp() gaf geen foutmelding als de guestId niet bestond.
--
-- BUG die dit fixt: `public.submit_rsvp()` (migratie 0006) deed een kale
-- `update ... where id = p_guest_id` zonder te controleren of er
-- daadwerkelijk een rij werd geraakt. Bij een verlopen/foutieve/geknoeide
-- RSVP-link (guestId hoort niet bij een bestaande gast) deed de UPDATE
-- stilzwijgend niets, maar de functie gaf gewoon succes terug — de gast
-- kreeg dus GEEN foutmelding te zien (ook al is die inmiddels netjes
-- afgehandeld in de app, zie submitPublicRsvpAction in
-- lib/actions/guest-actions.ts en de ?error=1-banner op /rsvp/[guestId]),
-- puur omdat de database zelf nooit meldde dat er niets is gebeurd.
--
-- Fix: `if not found then raise exception` na de UPDATE — Postgres zet
-- `FOUND` automatisch op false als de laatste UPDATE 0 rijen raakte. Die
-- exception komt bij `supabase.rpc("submit_rsvp", ...)` terug als een
-- `error`, waardoor `submitRsvpPublic()` in lib/data/store.ts (die nu al
-- `!error` teruggeeft) voortaan ook in dit geval correct `false`
-- teruggeeft — de al bestaande app-laag-foutafhandeling doet de rest.
-- ─────────────────────────────────────────────────────────────

create or replace function public.submit_rsvp(p_guest_id uuid, p_status text, p_plus_ones int, p_dietary_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('yes', 'no', 'maybe') then
    raise exception 'Ongeldige RSVP-status';
  end if;
  update event_guests
  set rsvp_status = p_status,
      plus_ones = greatest(0, coalesce(p_plus_ones, 0)),
      dietary_notes = p_dietary_notes,
      responded_at = now()
  where id = p_guest_id;

  if not found then
    raise exception 'Gast niet gevonden — deze RSVP-link lijkt niet (meer) geldig te zijn.';
  end if;
end;
$$;
