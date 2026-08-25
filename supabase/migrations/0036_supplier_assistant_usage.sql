-- ─────────────────────────────────────────────────────────────
-- Vyra — VyrAI-assistent voor leveranciers: dagelijkse gebruikslimiet
--
-- Vanaf abonnement Pro (spec-item #57, aug. 2026) krijgt een leverancier
-- toegang tot een AI-assistent (chat, conceptantwoorden, offertehulp,
-- en vanaf Premium ook een dagelijkse briefing/prijsadvies/profieltekst-
-- hulp). Elk niveau heeft een dagelijkse gebruikslimiet (Enterprise en de
-- proefperiode: onbeperkt) — zie SUBSCRIPTION_TIERS.assistantDailyLimit in
-- lib/config.ts.
--
-- BEWUST een aparte tabel i.p.v. hergebruik van `ai_interaction_logs`: die
-- tabel heeft géén select-policy voor de gewone sessie-client (alleen
-- leesbaar via de service-role key, zie migratie 0007) — dat is prima voor
-- een audit-log dat alleen de platformbeheerder inziet, maar zou betekenen
-- dat het TELLEN van "hoe vaak heeft déze leverancier dit al gebruikt
-- vandaag" ook via de service-role zou moeten, wat in de praktijk
-- betekent: als SUPABASE_SERVICE_ROLE_KEY niet gezet is, kan de limiet
-- niet gecontroleerd worden. Deze tabel volgt in plaats daarvan hetzelfde
-- patroon als `spotlights` (migratie 0029): een kleine, eigenaar-gescopede
-- tabel die de gewone sessie-client (RLS) direct kan lezen én schrijven —
-- dus werkt de limietcontrole altijd, met of zonder service-role key.
--
-- Plak dit hieronder in de Supabase SQL Editor en klik "Run".

create table if not exists supplier_assistant_usage (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  -- welke assistent-feature: 'chat' | 'reply_draft' | 'offer_helper' |
  -- 'briefing' | 'price_advice' | 'profile_text' — puur informatief/voor
  -- eventuele toekomstige per-feature-inzichten, de limiet zelf telt ze
  -- allemaal samen (zie countSupplierAssistantUsageToday in lib/data/store.ts).
  feature text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_supplier_assistant_usage_supplier_date on supplier_assistant_usage(supplier_id, created_at);

alter table supplier_assistant_usage enable row level security;

-- Alleen de eigenaar van het leveranciersaccount mag zijn eigen
-- gebruik zien en loggen — dit is geen openbare informatie (in
-- tegenstelling tot bv. spotlights, die andere organisatoren mogen zien).
create policy "supplier_assistant_usage: eigenaar leest eigen gebruik" on supplier_assistant_usage for select using (
  auth.uid() = (select owner_id from suppliers where suppliers.id = supplier_assistant_usage.supplier_id)
);
create policy "supplier_assistant_usage: eigenaar logt eigen gebruik" on supplier_assistant_usage for insert with check (
  auth.uid() = (select owner_id from suppliers where suppliers.id = supplier_assistant_usage.supplier_id)
);
