-- Wederzijdse beoordelingen (spec-item, Airbnb-geïnspireerd): na een
-- geaccepteerde boeking beoordelen organisator én leverancier elkaar. Beide
-- beoordelingen blijven verborgen tot ALLEBEI hebben ingevuld (of een
-- deadline verstrijkt, zie REVIEW_REVEAL_WINDOW_DAYS in lib/config.ts) —
-- voorkomt dat de één zijn oordeel laat afhangen van wat de ander al
-- schreef. Dit vult meteen een bestaand gat: er stond al een sterrenscore
-- (rating_avg/rating_count) op elk leveranciersprofiel, maar nergens een
-- plek om die daadwerkelijk achter te laten.
--
-- Eenmaal geschreven is een beoordeling niet meer te wijzigen of te
-- verwijderen (bewust geen update/delete-policy) — anders zou iemand een
-- milde beoordeling kunnen posten, de onthulling afwachten, en 'm dan
-- alsnog aanpassen, wat het hele "blind tot allebei"-idee ondermijnt.
--
-- Plak dit hieronder in de Supabase SQL Editor en klik "Run".

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  reviewer_role text not null check (reviewer_role in ('organizer', 'supplier')),
  rating smallint not null check (rating between 1 and 5),
  comment text,
  -- Alleen relevant/gezet voor reviewer_role = 'supplier': een leverancier
  -- kan hiermee een organisator melden die niet kwam opdagen.
  no_show boolean not null default false,
  created_at timestamptz not null default now(),
  -- Eén beoordeling per kant per boeking.
  unique (offer_id, reviewer_role)
);

alter table reviews enable row level security;

create index if not exists idx_reviews_offer on reviews(offer_id);
create index if not exists idx_reviews_supplier on reviews(supplier_id, created_at desc);

-- "Onthuld"-regel als functie: allebei ingevuld, óf de deadline (14 dagen
-- na de evenementdatum) is verstreken. SECURITY DEFINER, zodat de interne
-- queries (op reviews/offers/events) RLS omzeilen i.p.v. opnieuw de
-- policies hieronder te triggeren — dezelfde, al eerder beproefde aanpak
-- tegen RLS-recursie als is_event_owner()/is_supplier_targeted_for_event()
-- in migratie 0009 ("infinite recursion detected in policy").
create or replace function public.reviews_revealed(p_offer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  has_organizer boolean;
  has_supplier boolean;
  ev_date date;
begin
  select
    exists(select 1 from reviews where offer_id = p_offer_id and reviewer_role = 'organizer'),
    exists(select 1 from reviews where offer_id = p_offer_id and reviewer_role = 'supplier')
  into has_organizer, has_supplier;

  if has_organizer and has_supplier then
    return true;
  end if;

  select e.date into ev_date from offers o join events e on e.id = o.event_id where o.id = p_offer_id;
  if ev_date is null then
    return false;
  end if;

  return now() > (ev_date::timestamptz + make_interval(days => 14));
end;
$$;
grant execute on function public.reviews_revealed(uuid) to authenticated, anon;

-- Iedereen (ook uitgelogde bezoekers) leest een organisator-beoordeling
-- zodra die onthuld is — dit is precies wat er straks op het openbare
-- leveranciersprofiel wordt getoond. De leverancier→organisator-kant is
-- bewust NIET openbaar (er is geen openbaar organisatorprofiel).
create policy "reviews: openbaar zodra onthuld" on reviews for select
  using (reviewer_role = 'organizer' and reviews_revealed(offer_id));

-- De auteur leest zijn eigen beoordeling altijd, onthuld of niet.
create policy "reviews: auteur leest eigen beoordeling" on reviews for select
  using (
    (reviewer_role = 'organizer' and auth.uid() = (select owner_id from events where events.id = reviews.event_id))
    or (reviewer_role = 'supplier' and auth.uid() = (select owner_id from suppliers where suppliers.id = reviews.supplier_id))
  );

-- De organisator leest de (niet-openbare) leverancier→organisator-
-- beoordeling over zichzelf zodra die onthuld is.
create policy "reviews: organisator leest eigen onthulde beoordeling" on reviews for select
  using (
    reviewer_role = 'supplier'
    and auth.uid() = (select owner_id from events where events.id = reviews.event_id)
    and reviews_revealed(offer_id)
  );

-- Belangrijk: naast de eigenaarscontrole (wie ben ik?) valideert dit ook
-- dat offer_id/event_id/supplier_id écht bij elkaar horen (een bestaande,
-- geaccepteerde boeking) — zonder die koppeling zou iemand met een eigen
-- event_id (of eigen supplier_id) een willekeurige, ándermans offer_id
-- kunnen invullen: de eigenaarscontrole alléén zou dat toestaan, en de
-- unique-constraint hierboven zou de échte betrokkene daarna permanent
-- blokkeren om zelf nog te reviewen (een denial-of-service op de eigenlijke
-- beoordelaar). offers.supplier_id is `text` (zie migratie 0001 —
-- ondersteunt ook de statische demo-catalogus, die geen echte rij in
-- `suppliers` heeft), vandaar de expliciete cast.
create policy "reviews: eigen beoordeling aanmaken" on reviews for insert
  with check (
    exists (
      select 1 from offers o
      where o.id = reviews.offer_id
        and o.event_id = reviews.event_id
        and o.supplier_id = reviews.supplier_id::text
        and o.status = 'accepted'
    )
    and (
      (reviewer_role = 'organizer' and auth.uid() = (select owner_id from events where events.id = reviews.event_id))
      or (reviewer_role = 'supplier' and auth.uid() = (select owner_id from suppliers where suppliers.id = reviews.supplier_id))
    )
    -- "Niet komen opdagen" is alleen een leverancier-die-organisator-meldt-concept.
    and (reviewer_role = 'supplier' or no_show = false)
  );
