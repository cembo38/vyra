import type { MetadataRoute } from "next";
import { listOpenSupplierIdsForSitemap } from "@/lib/data/store";
import { SITE_URL } from "@/lib/config";

/**
 * Sitemap (spec-item #49) — alleen de openbare, voor iedereen bruikbare
 * pagina's: de marketing-/contentpagina's en elk vindbaar ("open",
 * spec-item #55) leveranciersprofiel. Alle ingelogde/besloten
 * app-schermen (/events, /profile, /supplier/dashboard, /admin, etc.)
 * horen hier bewust NIET in — zie app/robots.ts, dat diezelfde paden
 * expliciet buitensluit voor crawlers.
 *
 * `revalidate` ipv volledig statisch: nieuwe leveranciers moeten
 * uiteindelijk in de sitemap verschijnen zonder dat daar een nieuwe
 * deploy voor nodig is.
 */
export const revalidate = 3600; // 1 uur

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/leveranciers`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/supplier`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/login`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/signup`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/supplier/signup`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/voorwaarden`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
  ];

  const suppliers = await listOpenSupplierIdsForSitemap();
  const supplierEntries: MetadataRoute.Sitemap = suppliers.map((s) => ({
    url: `${SITE_URL}/leveranciers/${s.id}`,
    lastModified: new Date(s.createdAt),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...supplierEntries];
}
