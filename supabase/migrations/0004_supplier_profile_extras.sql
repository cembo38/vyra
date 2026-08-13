-- ─────────────────────────────────────────────────────────────
-- Vyra — uitgebreid leveranciersprofiel (migratie 4)
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run"
-- NADAT migraties 1, 2 en 3 al zijn uitgevoerd.
--
-- Voegt toe: KVK-nummer, website, social media-links, meerdere
-- categorieën (+ een vrije "andere categorie"), werkgebied met straal,
-- logo + foto's (via een nieuwe opslagruimte), en de mogelijkheid voor
-- organisatoren om een maatwerkaanvraag rechtstreeks bij één specifieke
-- leverancier in te dienen (in plaats van de automatische matching).
-- ─────────────────────────────────────────────────────────────

-- ───────────── UITBREIDING BEDRIJFSPROFIEL ─────────────
alter table suppliers
  add column if not exists kvk_number text,
  add column if not exists website text,
  add column if not exists social_facebook text,
  add column if not exists social_instagram text,
  add column if not exists social_tiktok text,
  add column if not exists categories text[] not null default '{}',
  add column if not exists category_other text,
  add column if not exists base_location text not null default '',
  add column if not exists service_radius_km int not null default 25,
  add column if not exists logo_url text,
  add column if not exists gallery_urls text[] not null default '{}';

-- Bestaande leveranciers krijgen hun huidige categorie/werkgebied
-- overgezet naar de nieuwe velden, zodat niemand met een leeg profiel
-- achterblijft na deze migratie.
update suppliers set categories = array[category] where categories = '{}';
update suppliers set base_location = service_areas[1] where base_location = '' and array_length(service_areas, 1) > 0;

create index if not exists idx_suppliers_categories on suppliers using gin (categories);

-- ───────────── MAATWERKAANVRAGEN ─────────────
-- Organisatoren kunnen vanaf een leveranciersprofiel een aanvraag
-- rechtstreeks naar die ene leverancier sturen, in plaats van de
-- automatische matching over meerdere leveranciers.
alter table requests
  add column if not exists target_supplier_id uuid references suppliers(id) on delete set null,
  add column if not exists is_direct boolean not null default false;

-- ───────────── OPSLAGRUIMTE VOOR LOGO'S EN FOTO'S ─────────────
-- Publiek leesbare bucket ("supplier-media"): iedereen mag de
-- geüploade logo's/foto's bekijken (nodig om ze op profielen te tonen),
-- maar alleen de eigenaar mag bestanden in zijn eigen map plaatsen,
-- wijzigen of verwijderen (mapnaam = zijn eigen user-id).
insert into storage.buckets (id, name, public)
values ('supplier-media', 'supplier-media', true)
on conflict (id) do nothing;

create policy "supplier-media: publiek leesbaar" on storage.objects for select
  using (bucket_id = 'supplier-media');

create policy "supplier-media: eigenaar uploadt" on storage.objects for insert
  with check (bucket_id = 'supplier-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "supplier-media: eigenaar wijzigt" on storage.objects for update
  using (bucket_id = 'supplier-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'supplier-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "supplier-media: eigenaar verwijdert" on storage.objects for delete
  using (bucket_id = 'supplier-media' and (storage.foldername(name))[1] = auth.uid()::text);
