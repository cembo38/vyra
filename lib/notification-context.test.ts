import { describe, expect, it } from "vitest";
import { getNotificationContext, NOTIFICATION_CONTEXT_LABELS } from "@/lib/notification-context";

/**
 * Dekt Cems verzoek (aug. 2026): notificaties moeten duidelijk maken of ze
 * bij een evenement (organisatorrol) of bij het leveranciersportaal horen.
 * Elk hier getest href-patroon is 1-op-1 overgenomen van een echte
 * pushNotification()-aanroep in lib/data/store.ts / lib/actions/*.ts, zodat
 * deze test breekt als een toekomstige wijziging daar een mismatch
 * introduceert.
 */
describe("getNotificationContext", () => {
  it("herkent leveranciers-hrefs (nieuwe aanvraag, verificatie, geschil via leverancier)", () => {
    expect(getNotificationContext({ href: "/supplier/requests/abc-123" })).toBe("supplier");
    expect(getNotificationContext({ href: "/supplier/profile" })).toBe("supplier");
    expect(getNotificationContext({ href: "/supplier/orders" })).toBe("supplier");
  });

  it("herkent organisator-hrefs (evenement, offertes, budget, bewaarde zoekopdracht)", () => {
    expect(getNotificationContext({ href: "/events/evt-1/offers/catering" })).toBe("organizer");
    expect(getNotificationContext({ href: "/events/evt-1/budget" })).toBe("organizer");
    expect(getNotificationContext({ href: "/events/evt-1/checkout/pay-1" })).toBe("organizer");
    expect(getNotificationContext({ href: "/leveranciers/sup-1" })).toBe("organizer");
  });

  it("valt terug op organisator-context bij een lege href", () => {
    expect(getNotificationContext({ href: null })).toBe("organizer");
  });

  it("heeft voor beide contexten een leesbaar Nederlands label", () => {
    expect(NOTIFICATION_CONTEXT_LABELS.organizer).toBe("Evenement");
    expect(NOTIFICATION_CONTEXT_LABELS.supplier).toBe("Leveranciersportaal");
  });
});
