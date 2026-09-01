"use server";

import { getCurrentUser } from "@/lib/auth";
import { createFeedbackReport } from "@/lib/data/store";
import { ADMIN_EMAILS, SITE_URL } from "@/lib/config";
import { sendNotificationEmail } from "@/lib/email/send";
import { FeedbackType } from "@/lib/types";

/**
 * Publieke actie achter de "hulp"-FAB (elke pagina, ook zonder inloggen —
 * zelfde soort publieke toegang als de gastenfoto-upload, maar dan zonder
 * token: hier is geen geheim nodig, iedereen mag een melding achterlaten).
 * Bewust GEEN rate-limiting/captcha: dit is v1, en misbruik hier is laag-
 * risico (geen geld, geen PII-lek) — kan later alsnog toegevoegd worden als
 * het probleem blijkt.
 */
export async function submitFeedbackReportAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const type = String(formData.get("type") ?? "");
  if (type !== "question" && type !== "bug") return { ok: false, error: "Ongeldig type." };

  const message = String(formData.get("message") ?? "").trim().slice(0, 2000);
  if (!message) return { ok: false, error: "Schrijf eerst iets in het veld." };

  const pagePath = String(formData.get("pagePath") ?? "").slice(0, 300) || null;
  const enteredEmail = String(formData.get("email") ?? "").trim().slice(0, 200);

  const user = await getCurrentUser();

  const ok = await createFeedbackReport({
    type: type as FeedbackType,
    message,
    pagePath,
    userId: user?.id ?? null,
    email: enteredEmail || user?.email || null,
    role: user?.role ?? null,
  });
  if (!ok) return { ok: false, error: "Versturen is mislukt. Probeer het nog eens." };

  // Best-effort e-mail naar Cem — no-op zolang RESEND_API_KEY niet gezet is
  // (EMAIL_ENABLED-fallback, zie lib/email/send.ts). Faalt de melding zelf
  // opslaan niet mee als de mail hikt, dat gebeurde hierboven al.
  const adminEmail = ADMIN_EMAILS[0];
  if (adminEmail) {
    await sendNotificationEmail({
      to: adminEmail,
      title: type === "bug" ? "Bugmelding op Vyra" : "Nieuwe vraag op Vyra",
      body: `${message}\n\nPagina: ${pagePath ?? "onbekend"}\nVan: ${enteredEmail || user?.email || "anoniem"}`,
      href: `${SITE_URL}/admin/feedback`,
      ctaLabel: "Bekijk in admin",
    });
  }

  return { ok: true };
}
