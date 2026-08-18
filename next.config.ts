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
    },
  },
};

export default nextConfig;
