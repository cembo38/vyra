-- ───────────── FIX: "infinite recursion detected in policy for relation events" ─────────────
-- Oorzaak: de policy "events: leverancier leest gerichte evenementen"
-- (migratie 0002) doet een subquery op requests, en de policy
-- "requests: via parent event" (migratie 0001) doet op zijn beurt een
-- subquery terug op events. Zodra Postgres beide policies binnen dezelfde
-- query moet evalueren (bijvoorbeeld bij een join, of een geneste select
-- zoals Supabase die gebruikt), ontstaat een oneindige cirkel tussen de
-- RLS-checks van events en requests — vandaar de foutmelding die de site
-- liet vastlopen met "Onze AI reageert nu niet".
--
-- Oplossing: dezelfde beproefde aanpak als bij de RSVP-functies in
-- migratie 0006 — de subqueries verplaatsen naar SECURITY DEFINER
-- functies. Zulke functies draaien met de rechten van de functie-
-- eigenaar (die RLS mag omzeilen), dus hun interne query triggert niet
-- opnieuw de RLS-policy van de andere tabel — de cirkel wordt doorbroken.

create or replace function public.is_event_owner(p_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from events e where e.id = p_event_id and e.owner_id = auth.uid()
  );
$$;
grant execute on function public.is_event_owner(uuid) to authenticated;

create or replace function public.is_supplier_targeted_for_event(p_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from requests r
    join request_targets rt on rt.request_id = r.id
    join suppliers s on s.id = rt.supplier_id
    where r.event_id = p_event_id and s.owner_id = auth.uid()
  );
$$;
grant execute on function public.is_supplier_targeted_for_event(uuid) to authenticated;

-- events: leverancier-policy niet meer rechtstreeks op requests laten
-- query'en (dat liet requests' eigen policy weer terugvallen op events).
drop policy if exists "events: leverancier leest gerichte evenementen" on events;
create policy "events: leverancier leest gerichte evenementen" on events for select
  using (is_supplier_targeted_for_event(events.id));

-- requests: "via parent event" niet meer rechtstreeks op events laten
-- query'en.
drop policy if exists "requests: via parent event" on requests;
create policy "requests: via parent event" on requests for all
  using (is_event_owner(event_id))
  with check (is_event_owner(event_id));
