/**
 * "Locatie op een kaart" (spec-item, Airbnb-geïnspireerd) — adres-naar-
 * coördinaten-stap die nog ontbrak (zie scratchpad/marktplaatspatronen.html:
 * "Vereist wel eerst een adres-naar-coördinaten-stap die er nog niet is").
 *
 * Bewust Nominatim (OpenStreetMap) i.p.v. Google Maps/Mapbox: geen account,
 * geen API-key nodig — Cem hoeft hier dus zelf niets voor aan te maken. Wel
 * onderworpen aan Nominatim's fair-use-beleid (max. ~1 request/seconde, en
 * een herkenbare User-Agent verplicht), dus dit wordt uitsluitend aangeroepen
 * wanneer een leverancier zijn locatie daadwerkelijk aanmaakt/wijzigt — nooit
 * bij elke profielweergave of -opslag. Zie updateSupplierProfileAction en
 * createSupplierProfileAction in lib/actions/supplier-actions.ts.
 */
export interface GeoPoint {
  lat: number;
  lng: number;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

/**
 * Zoekt de coördinaten van een vrije-tekst locatie (plaatsnaam, postcode,
 * adres) op via Nominatim. Geeft `null` terug bij geen match, een netwerk-
 * fout, of een onverwacht antwoord — dit mag NOOIT een profiel-opslag laten
 * mislukken, alleen de kaart-marker ontbreekt dan.
 */
export async function geocodeLocation(query: string): Promise<GeoPoint | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", trimmed);
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "nl");

    const res = await fetch(url.toString(), {
      headers: {
        // Nominatim's gebruiksvoorwaarden vereisen een herkenbare
        // User-Agent (geen browser-UA-spoofing) zodat misbruik te herleiden
        // is naar de aanroepende applicatie.
        "User-Agent": "VyraApp/1.0 (event-planning marketplace; contact via vyra.app)",
      },
      // Nominatim-resultaten veranderen zelden — een korte cache voorkomt
      // onnodige herhaalde calls als iemand snel achter elkaar opslaat.
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;

    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    if (!first) return null;

    const lat = Number.parseFloat(first.lat);
    const lng = Number.parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  } catch {
    return null;
  }
}
