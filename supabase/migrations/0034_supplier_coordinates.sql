-- "Locatie op een kaart" (spec-item, Airbnb-geïnspireerd): naast de
-- lijstweergave op /leveranciers een kaartweergave, vooral fijn voor
-- locatiegebonden diensten (een zaal, catering met een bezorgstraal). Slaat
-- de coördinaten van `base_location` op — automatisch bepaald via
-- geocodeLocation() (lib/geo.ts, gratis Nominatim/OpenStreetMap, geen
-- account nodig) zodra een leverancier zijn locatie aanmaakt/wijzigt.
--
-- Beide kolommen zijn bewust nullable: geocoding kan mislukken (onherkend
-- adres, Nominatim tijdelijk onbereikbaar) — de leverancier blijft dan
-- gewoon vindbaar via de bestaande lijstweergave, alleen zonder marker op
-- de kaart.
--
-- Plak dit hieronder in de Supabase SQL Editor en klik "Run".

alter table public.suppliers
  add column if not exists lat double precision,
  add column if not exists lng double precision;
