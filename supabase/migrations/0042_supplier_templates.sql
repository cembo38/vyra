-- ─────────────────────────────────────────────────────────────
-- Vyra — opgeslagen sjablonen voor offertes/berichten
--
-- Leveranciers typen vaak dezelfde soort tekst opnieuw uit — een vaste
-- omschrijving van hun cateringpakket, een standaard welkomstbericht bij
-- een nieuwe aanvraag, enzovoort. Dit tabel laat een leverancier zulke
-- tekst één keer opslaan (met een herkenbare titel) en daarna met één
-- klik hergebruiken in SupplierOfferForm.tsx (kind='offer') of
-- MessageComposer.tsx (kind='message', alleen op de leverancierskant —
-- zie TemplatePicker.tsx).
--
-- Volledig eigen data, geen goedkeuringsstap nodig zoals bij
-- supplier_tier_upgrade_requests (migratie 0040) — dus hier WEL een
-- update/delete-policy voor de eigenaar zelf, i.p.v. uitsluitend
-- server-side wijzigen.
--
-- Plak dit hieronder in de Supabase SQL Editor en klik "Run".

create table if not exists supplier_templates (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  kind text not null check (kind in ('offer', 'message')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_supplier_templates_supplier on supplier_templates(supplier_id, kind);

alter table supplier_templates enable row level security;

create policy "sjablonen: eigenaar leest eigen sjablonen" on supplier_templates for select
  using (auth.uid() = (select owner_id from suppliers where suppliers.id = supplier_id));

create policy "sjablonen: eigenaar maakt eigen sjabloon" on supplier_templates for insert
  with check (auth.uid() = (select owner_id from suppliers where suppliers.id = supplier_id));

create policy "sjablonen: eigenaar verwijdert eigen sjabloon" on supplier_templates for delete
  using (auth.uid() = (select owner_id from suppliers where suppliers.id = supplier_id));
