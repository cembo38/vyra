-- ───────────── GASTENLIJST & RSVP ─────────────
create table if not exists event_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  group_label text,               -- optioneel: "Familie bruid", "Collega's", ...
  plus_ones int not null default 0,
  dietary_notes text,
  rsvp_status text not null default 'pending', -- pending|yes|no|maybe
  invited_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
alter table event_guests enable row level security;

-- De organisator (owner van het event) mag zijn eigen gastenlijst volledig beheren.
create policy "guests: owner full access" on event_guests for all
  using (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()));

create index if not exists idx_guests_event on event_guests(event_id);

-- ───────────── PUBLIEKE RSVP-LINK (zonder inloggen) ─────────────
-- Een gast krijgt een link met daarin alleen zijn eigen (niet-raadbare) uuid
-- — vergelijkbaar met een wachtwoord-reset-link. In plaats van de gasten-
-- tabel rechtstreeks open te zetten voor anonieme bezoekers (wat de hele
-- lijst met namen/e-mails van iedereen zou lekken), lopen lezen én RSVP
-- geven via twee smalle, met SECURITY DEFINER beveiligde functies die
-- alleen de rij met dat specifieke id aanraken.
create or replace function public.get_guest_public(p_guest_id uuid)
returns table (
  id uuid,
  name text,
  event_id uuid,
  event_name text,
  event_date date,
  event_location text,
  rsvp_status text,
  plus_ones int,
  dietary_notes text
)
language sql
security definer
set search_path = public
as $$
  select g.id, g.name, g.event_id, e.name, e.date, e.location_label, g.rsvp_status, g.plus_ones, g.dietary_notes
  from event_guests g
  join events e on e.id = g.event_id
  where g.id = p_guest_id
$$;
grant execute on function public.get_guest_public(uuid) to anon, authenticated;

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
end;
$$;
grant execute on function public.submit_rsvp(uuid, text, int, text) to anon, authenticated;
