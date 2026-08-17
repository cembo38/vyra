import "server-only";
import { Resend } from "resend";
import { EMAIL_ENABLED, EMAIL_FROM } from "@/lib/config";
import { notificationEmailHtml } from "@/lib/email/templates";

let client: Resend | null | undefined;

function getClient(): Resend | null {
  if (client === undefined) {
    client = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  }
  return client;
}

/**
 * Verstuurt één meldingsmail. Faalt nooit hardop — een hikkende
 * e-mailprovider mag nooit de eigenlijke actie (aanvraag versturen,
 * offerte indienen, ...) laten mislukken, dus fouten worden alleen
 * gelogd. Zonder RESEND_API_KEY (EMAIL_ENABLED = false) wordt er
 * stilzwijgend niets verstuurd — precies zoals de AI/betalingen-laag
 * zonder hun sleutel gewoon terugvalt op geen-effect in plaats van een
 * crash.
 */
export async function sendNotificationEmail(params: { to: string; title: string; body: string; href: string | null; ctaLabel?: string }) {
  if (!EMAIL_ENABLED) return;
  const resend = getClient();
  if (!resend) return;

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: params.title,
      html: notificationEmailHtml({ title: params.title, body: params.body, href: params.href, ctaLabel: params.ctaLabel }),
    });
  } catch (err) {
    console.error("[email] versturen mislukt:", err);
  }
}
