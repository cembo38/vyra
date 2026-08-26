-- ─────────────────────────────────────────────────────────────
-- Vyra — echte platform-cijfers voor de homepage-hero
--
-- De hero (components/marketing/Hero.tsx) toonde tot nu toe twee vaste,
-- verzonnen getallen ("2000+ evenementen", "4.8/5") — niet uit data
-- opgehaald. Deze functie levert de échte aantallen, zodat de hero ze kan
-- tonen zodra er genoeg zijn (en anders eerlijk een niet-cijfermatige
-- vertrouwenszin toont, zie Hero.tsx).
--
-- SECURITY DEFINER naar exact hetzelfde patroon als reviews_revealed()
-- (migratie 0033): geeft alleen een geaggregeerd getal terug, geen losse
-- rijen, dus veilig uitvoerbaar door anonieme bezoekers zonder de
-- onderliggende RLS op `events`/`reviews` te hoeven versoepelen.
--
-- Alleen openbaar-onthulde organisator→leverancier-beoordelingen tellen
-- mee voor het gemiddelde (reviews_revealed(), migratie 0033) — dezelfde
-- beoordelingen die al publiek op een leveranciersprofiel staan.
--
-- Plak dit hieronder in de Supabase SQL Editor en klik "Run".

create or replace function public.platform_stats()
returns table(event_count bigint, avg_rating numeric, rating_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from events),
    (select round(avg(rating)::numeric, 1) from reviews where reviewer_role = 'organizer' and reviews_revealed(offer_id)),
    (select count(*) from reviews where reviewer_role = 'organizer' and reviews_revealed(offer_id));
$$;
grant execute on function public.platform_stats() to authenticated, anon;
