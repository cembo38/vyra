-- ─────────────────────────────────────────────────────────────
-- Vyra — VyrAI dagelijkse prioriteitenbriefing voor leveranciers (Premium+)
--
-- Eén rij per leverancier per kalenderdag (unique constraint hieronder) —
-- zowel het zelf-genereren op /supplier/dashboard (via
-- generateSupplierBriefingAction, "use server") als de optionele
-- ochtend-cronjob (app/api/cron/supplier-briefings/route.ts, service-role)
-- schrijven hiernaartoe. Cachen voorkomt dat elke paginaweergave opnieuw
-- een AI-aanroep (en dus een dagelijkse-limiet-telling) kost — de
-- briefing hoeft immers maar één keer per dag gegenereerd te worden.
--
-- Plak dit hieronder in de Supabase SQL Editor en klik "Run".

create table if not exists supplier_daily_briefings (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  briefing_date date not null,
  narrative text not null,
  signal_count int not null default 0,
  used_ai boolean not null default false,
  created_at timestamptz not null default now(),
  unique (supplier_id, briefing_date)
);

create index if not exists idx_supplier_daily_briefings_supplier_date on supplier_daily_briefings(supplier_id, briefing_date desc);

alter table supplier_daily_briefings enable row level security;

-- Zelfde "alleen de eigenaar" RLS-vorm als supplier_assistant_usage
-- (migratie 0036) — dit is geen openbare informatie. De ochtend-cronjob
-- schrijft via de service-role client, die RLS toch al omzeilt.
create policy "supplier_daily_briefings: eigenaar leest eigen briefing" on supplier_daily_briefings for select using (
  auth.uid() = (select owner_id from suppliers where suppliers.id = supplier_daily_briefings.supplier_id)
);
create policy "supplier_daily_briefings: eigenaar genereert eigen briefing" on supplier_daily_briefings for insert with check (
  auth.uid() = (select owner_id from suppliers where suppliers.id = supplier_daily_briefings.supplier_id)
);
