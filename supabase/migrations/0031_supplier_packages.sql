-- Pakketten i.p.v. een platte lijst (Fiverr/Etsy-stijl): een leverancier
-- kan tot 3 vaste niveaus (Basis/Standaard/Premium) met eigen naam,
-- omschrijving en prijs op zijn profiel zetten — sneller te vergelijken
-- voor een organisator dan één platte tekstbeschrijving. Beschikbaar vanaf
-- Pro (zie packagesEnabled in lib/config.ts), net als Spotlight.
--
-- Eén jsonb-kolom i.p.v. een aparte tabel: net als `includes`/`gallery_urls`
-- hierboven is dit een kleine, begrensde (max 3), alleen-door-de-eigenaar
-- bewerkte lijst — geen eigen RLS-tabel nodig.
--
-- Plak dit hieronder in de Supabase SQL Editor en klik "Run".

alter table public.suppliers
  add column if not exists packages jsonb not null default '[]'::jsonb;
