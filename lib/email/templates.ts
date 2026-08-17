import { SITE_URL } from "@/lib/config";

/**
 * Eén generieke, merkgetrouwe e-mailtemplate voor alle meldingsmails —
 * hergebruikt bewust dezelfde `title`/`body`/`href` die ook al voor de
 * in-app-melding worden geschreven (zie pushNotification() in
 * lib/data/store.ts), zodat er nooit twee losse teksten voor hetzelfde
 * moment onderhouden hoeven te worden.
 *
 * Bewust géén react-email of andere buildstap: e-mailclients zijn
 * berucht onvoorspelbaar met moderne CSS, dus platte, met de hand
 * geschreven HTML met inline-stijlen (tabellen-vrij, maar wel met
 * `!important`-vrije inline `style`-attributen) is voor dit soort simpele,
 * korte transactionele mails het betrouwbaarste startpunt.
 */
export function notificationEmailHtml(params: { title: string; body: string; href: string | null; ctaLabel?: string }) {
  const absoluteHref = params.href ? (params.href.startsWith("http") ? params.href : `${SITE_URL}${params.href}`) : null;

  return `<!DOCTYPE html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body style="margin:0; padding:32px 16px; background-color:#f6f2e7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px; margin:0 auto; background-color:#ffffff; border-radius:20px; overflow:hidden; border:1px solid #e5ded0;">
      <div style="padding:28px 32px 20px 32px;">
        <div style="width:36px; height:36px; border-radius:10px; background-color:#24271a; color:#fbf7ea; font-style:italic; font-weight:700; font-size:19px; line-height:36px; text-align:center; margin-bottom:20px;">V</div>
        <h1 style="margin:0 0 12px 0; font-size:19px; line-height:1.4; color:#24271a;">${escapeHtml(params.title)}</h1>
        <p style="margin:0 0 24px 0; font-size:15px; line-height:1.6; color:#4b4a3f;">${escapeHtml(params.body)}</p>
        ${
          absoluteHref
            ? `<a href="${absoluteHref}" style="display:inline-block; background-color:#24271a; color:#fbf7ea; text-decoration:none; font-size:14px; font-weight:600; padding:11px 22px; border-radius:999px;">${escapeHtml(params.ctaLabel ?? "Bekijk in Vyra")}</a>`
            : ""
        }
      </div>
      <div style="padding:16px 32px; border-top:1px solid #efe9db; background-color:#faf7f0;">
        <p style="margin:0; font-size:12px; line-height:1.5; color:#8a8874;">Je ontvangt deze e-mail omdat je een account hebt op Vyra. Meldingen beheer je in de app onder het belletje rechtsboven.</p>
      </div>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
