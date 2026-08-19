-- Spec-item #50: geschillen/klachten kunnen melden en escaleren.
--
-- `disputes` is een leaf table (wordt niet vanuit de RLS-policies van
-- `events` of `suppliers` teruggelezen), dus GEEN security-definer-functie
-- nodig om recursie te voorkomen (zie het patroon in 0009/0010 voor wanneer
-- dat wél nodig is). Alleen de betrokken organisator (via events.owner_id)
-- of de betrokken leverancier (via suppliers.owner_id, met een ::text-cast
-- omdat offers.supplier_id/disputes.supplier_id "text" is — kan ook naar een
-- statische demo-catalogus-id verwijzen) mogen lezen/melden. Wijzigen
-- (oplossen/afwijzen) gebeurt uitsluitend server-side via de service-role
-- client (zie requireAdmin() in lib/actions/admin-actions.ts) — bewust geen
-- UPDATE-policy voor gewone gebruikers.
create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  offer_id uuid not null references offers(id) on delete cascade,
  supplier_id text not null,
  filed_by uuid not null references auth.users(id) on delete cascade,
  filed_by_role text not null check (filed_by_role in ('customer', 'supplier')),
  category text not null check (category in ('no_show', 'quality', 'payment', 'communication', 'other')),
  description text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  admin_response text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists disputes_payment_id_idx on disputes (payment_id);
create index if not exists disputes_event_id_idx on disputes (event_id);
create index if not exists disputes_supplier_id_idx on disputes (supplier_id);
create index if not exists disputes_status_idx on disputes (status);

alter table disputes enable row level security;

create policy "disputes: betrokkenen lezen" on disputes for select
  using (
    exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid())
    or exists (select 1 from suppliers s where s.id::text = supplier_id and s.owner_id = auth.uid())
  );

create policy "disputes: betrokkenen melden" on disputes for insert
  with check (
    filed_by = auth.uid()
    and (
      exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid())
      or exists (select 1 from suppliers s where s.id::text = supplier_id and s.owner_id = auth.uid())
    )
  );
