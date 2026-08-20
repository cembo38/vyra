import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

/**
 * robots.txt (spec-item #49) — sluit alle ingelogde/besloten app-schermen
 * uit van crawlers (ze zijn toch niet te bereiken zonder in te loggen, en
 * horen niet in zoekresultaten), houdt de publieke marketing-/contentkant
 * (home, leveranciersgids, individuele leveranciersprofielen, voorwaarden,
 * privacy, login/signup) gewoon open. `/rsvp/*` bevat gastspecifieke,
 * niet-geraden tokens in de URL — expliciet uitgesloten zodat zo'n link
 * nooit in een zoekmachine-cache terechtkomt.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/admin",
        "/events",
        "/profile",
        "/notifications",
        "/mijn-leveranciers",
        "/onboarding",
        "/rsvp/",
        "/wachtwoord-vergeten/verzonden",
        "/wachtwoord-vergeten/nieuw",
        "/signup/check-email",
        "/supplier/signup/check-email",
        "/supplier/dashboard",
        "/supplier/calendar",
        "/supplier/messages",
        "/supplier/notifications",
        "/supplier/orders",
        "/supplier/profile",
        "/supplier/requests",
        "/supplier/onboarding",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
