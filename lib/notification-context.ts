import { AppNotification } from "@/lib/types";

/**
 * Cem (aug. 2026): op de leverancierspagina zag hij notificaties die
 * eigenlijk over zijn eigen evenementen gaan (organisatorrol) tussen
 * leveranciersgerelateerde meldingen staan, zonder dat duidelijk was welke
 * bij welke rol hoort. Logisch, want getNotifications() in lib/data/store.ts
 * haalt gewoon ALLE meldingen van een user_id op, ongeacht rol — en zowel
 * AppTopBar (organisator) als SupplierTopBar (leverancier) geven diezelfde
 * volledige, ongefilterde lijst door aan NotificationsBell/NotificationsList.
 * Eén centrale inbox is op zich prima (vooral voor een dubbelrol-account
 * zoals dat van Cem zelf), maar dan moet wel elke melding een zichtbaar
 * contextlabel krijgen — dat is wat dit bestand toevoegt.
 *
 * Bewust GEEN nieuwe databasekolom/migratie: elke melding heeft altijd al
 * een `href` die naar de juiste portal-sectie wijst (/supplier/... voor
 * leverancierszaken, /events/... of /leveranciers/... voor
 * organisatorzaken) — geverifineerd tegen ALLE huidige pushNotification()-
 * aanroepen in lib/data/store.ts en lib/actions/*.ts. Die href is dus al een
 * betrouwbare, altijd-actuele bron van waarheid; een apart veld zou dubbele
 * boekhouding worden die op termijn uit de pas kan gaan lopen met de
 * werkelijke bestemming van de link.
 */
export type NotificationContext = "organizer" | "supplier";

export function getNotificationContext(n: Pick<AppNotification, "href">): NotificationContext {
  return n.href != null && n.href.startsWith("/supplier/") ? "supplier" : "organizer";
}

export const NOTIFICATION_CONTEXT_LABELS: Record<NotificationContext, string> = {
  organizer: "Evenement",
  supplier: "Leveranciersportaal",
};
