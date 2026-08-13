-- ───────────── FIX: "infinite recursion detected in policy for relation requests" ─────────────
-- Zelfde probleem als in migratie 0009, maar dan één laag dieper: de
-- policy "request_targets: organisator beheert via aanvraag" (migratie
-- 0002) doet een rechtstreekse subquery op requests + events, en de
-- policy "requests: leverancier leest gerichte aanvragen" (migratie
-- 0002) doet op zijn beurt een rechtstreekse subquery op request_targets.
-- Zodra Postgres beide moet evalueren (zoals bij het versturen van een
-- aanvraag naar leveranciers), ontstaat weer een oneindige cirkel — nu
-- tussen requests en request_targets.
--
-- Oplossing: opnieuw dezelfde aanpak — de subqueries verplaatsen naar
-- SECURITY DEFINER functies, zodat ze de RLS-policy van de andere tabel
-- niet opnieuw triggeren.

create or replace function public.is_request_owner(p_request_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from requests r
    join events e on e.id = r.event_id
    where r.id = p_request_id and e.owner_id = auth.uid()
  );
$$;
grant execute on function public.is_request_owner(uuid) to authenticated;

create or replace function public.is_supplier_targeted_for_request(p_request_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from request_targets rt
    join suppliers s on s.id = rt.supplier_id
    where rt.request_id = p_request_id and s.owner_id = auth.uid()
  );
$$;
grant execute on function public.is_supplier_targeted_for_request(uuid) to authenticated;

-- request_targets: organisator-policy niet meer rechtstreeks op requests
-- + events laten query'en.
drop policy if exists "request_targets: organisator beheert via aanvraag" on request_targets;
create policy "request_targets: organisator beheert via aanvraag" on request_targets for all
  using (is_request_owner(request_id))
  with check (is_request_owner(request_id));

-- requests: leverancier-select-policy niet meer rechtstreeks op
-- request_targets laten query'en.
drop policy if exists "requests: leverancier leest gerichte aanvragen" on requests;
create policy "requests: leverancier leest gerichte aanvragen" on requests for select
  using (is_supplier_targeted_for_request(requests.id));

-- Zelfde functie ook hergebruiken in de offerte-insert-policy, zodat
-- ook die niet meer via een rechtstreekse subquery afhankelijk is van
-- request_targets' eigen RLS-evaluatie (voorkomt een vergelijkbare bug
-- op deze plek in de toekomst).
drop policy if exists "offers: leverancier dient eigen offerte in" on offers;
create policy "offers: leverancier dient eigen offerte in" on offers for insert
  with check (
    exists (select 1 from suppliers s where s.owner_id = auth.uid() and s.id::text = offers.supplier_id)
    and is_supplier_targeted_for_request(offers.request_id)
  );
