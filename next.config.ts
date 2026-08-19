import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
