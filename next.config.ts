import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Livegang-audit (aug. 2026): er stonden hier nog helemaal geen
  // beveiligingsheaders — Vercel voegt op een custom domein wel wat
  // basisbescherming toe, maar niets op app-niveau. Bewust GEEN
  // Content-Security-Policy hier: die is makkelijk te streng in te stellen
  // en breekt dan stilzwijgend Stripe Checkout/embeds, AI-widgets, etc. —
  // dat verdient een eigen, zorgvuldig geteste stap, geen meegenomen
  // regeltje. Onderstaande vier zijn wél veilig als blanket-default, zonder
  // functionaliteit te kunnen breken.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Dwingt de browser om ALTIJD https te gebruiken voor dit domein,
          // ook bij een volgend bezoek via een kale http-link.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Voorkomt dat de browser een bestandstype "raadt" op basis van de
          // inhoud i.p.v. de opgegeven Content-Type — sluit een hele klasse
          // upload-gerelateerde beveiligingsproblemen uit.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Voorkomt dat Vyra in een <iframe> op een andere site wordt
          // ingeladen (clickjacking-bescherming).
          { key: "X-Frame-Options", value: "DENY" },
          // Stuurt geen volledige URL (die soms een token/ID kan bevatten)
          // mee als een gebruiker vanaf Vyra naar een externe link klikt.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Next.js vergelijkt bij elke Server Action (elk formulier dat submit
      // — account aanmaken, inloggen, bericht sturen, etc.) de `Origin`-
      // header van de browser met de `Host`/`X-Forwarded-Host`-header die
      // de server ziet, als CSRF-bescherming. Komt het aangepaste domein
      // (vyra.now) er niet expliciet bij te staan, dan wordt zo'n verzoek
      // afgewezen zodra Vercel/de domeinregistrar het request via een
      // net iets ander pad doorstuurt dan het standaard *.vercel.app-
      // domein — precies de "This page couldn't load"-foutmelding die bij
      // het aanmaken van een account optrad.
      allowedOrigins: ["vyra.now", "*.vyra.now"],
      // Elk formulier dat via een Server Action verstuurd wordt (zoals het
      // leveranciersprofiel: logo + meerdere foto's tegelijk) mag standaard
      // maar 1MB in totaal zijn. Een enkele telefoonfoto is al snel 2-8MB,
      // dus elke poging om een foto te uploaden werd afgewezen — precies
      // dezelfde "This page couldn't load"-foutmelding als bij de twee
      // eerdere bugs, maar dan voor elk formulier met een bestandsupload.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
