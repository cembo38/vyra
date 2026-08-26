import "server-only";
import webpush from "web-push";
import { ADMIN_EMAILS, PUSH_ENABLED, VAPID_PUBLIC_KEY } from "@/lib/config";

/**
 * Web Push (spec-item #131) — zelfde "graceful fallback zonder sleutels"-
 * patroon als lib/email/send.ts: zonder VAPID-sleutels (PUSH_ENABLED=false)
 * doet dit stilzwijgend niets, de rest van de app blijft gewoon werken.
 * Geen externe partij/account nodig (in tegenstelling tot Stripe/Resend) —
 * het VAPID-sleutelpaar is puur zelf-gegenereerde cryptografie, zie de
 * toelichting bij PUSH_ENABLED in lib/config.ts.
 */

let configured = false;

function ensureConfigured() {
  if (configured || !PUSH_ENABLED) return;
  // mailto: is verplicht in de VAPID-spec (contactadres voor push-diensten
  // bij misbruik) — het eerste ADMIN_EMAILS-adres hergebruiken i.p.v. een
  // aparte env var erbij te verzinnen voor iets dat nooit zichtbaar is voor
  // eindgebruikers.
  webpush.setVapidDetails(`mailto:${ADMIN_EMAILS[0]}`, VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  authKey: string;
}

/**
 * Verstuurt één pushmelding. Geeft `{ ok, expired }` terug i.p.v. te gooien
 * — de aanroeper (de cronjob) gebruikt `expired` om een niet meer geldig
 * abonnement (de gebruiker heeft de site-toestemming ingetrokken, of de
 * browser/het OS heeft het abonnement zelf opgeruimd) meteen op te ruimen
 * i.p.v. bij elke toekomstige cron-run opnieuw tegen dezelfde 404/410 aan
 * te lopen.
 */
export async function sendPushNotification(
  sub: PushSubscriptionKeys,
  payload: { title: string; body: string; href: string | null }
): Promise<{ ok: boolean; expired: boolean }> {
  if (!PUSH_ENABLED) return { ok: false, expired: false };
  ensureConfigured();

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.authKey } },
      JSON.stringify({ title: payload.title, body: payload.body, href: payload.href })
    );
    return { ok: true, expired: false };
  } catch (err) {
    // 404/410: het abonnement bestaat niet meer aan de kant van de
    // push-dienst (browser/OS) — geen echte fout, gewoon opruimen.
    const statusCode = (err as { statusCode?: number } | null)?.statusCode;
    const expired = statusCode === 404 || statusCode === 410;
    if (!expired) console.error("[push] versturen mislukt:", err);
    return { ok: false, expired };
  }
}
