-- "Profiel aankleden" (spec-vervolg op pakketten, "deel 2"): hoe hoger het
-- abonnement, hoe meer een leverancier zijn openbare profiel kan aankleden
-- als een eigen winkeltje. Drie losse, optionele velden:
--   - tagline: korte pitch naast de bedrijfsnaam (vanaf Groei)
--   - cover_photo_url: grote header-afbeelding boven het profiel (vanaf Pro)
--   - intro_video_url: ingesloten YouTube/Vimeo-video (vanaf Premium)
-- Zie taglineEnabled/coverPhotoEnabled/introVideoEnabled in lib/config.ts.
--
-- Plak dit hieronder in de Supabase SQL Editor en klik "Run".

alter table public.suppliers
  add column if not exists tagline text,
  add column if not exists cover_photo_url text,
  add column if not exists intro_video_url text;
