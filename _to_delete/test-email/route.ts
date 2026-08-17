import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getCurrentUser } from "@/lib/auth";
import { EMAIL_ENABLED, EMAIL_FROM } from "@/lib/config";
import { notificationEmailHtml } from "@/lib/email/templates";

/**
 * TIJDELIJKE testroute om na het instellen van RESEND_API_KEY meteen te
 * controleren of de sleutel is opgepikt én Resend 'm daadwerkelijk
 * accepteert — stuurt (in tegenstelling tot sendNotificationEmail(), die
 * fouten bewust stilhoudt) de échte Resend-foutmelding terug, precies wat
 * je nodig hebt bij een eerste keer instellen. Alleen bruikbaar in lokale
 * ontwikkeling (NODE_ENV !== "production"), zodat dit nooit per ongeluk in
 * productie een manier wordt om via de gedeelde sleutel mail te sturen.
 * Weer verwijderen zodra het testen gelukt is.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, reason: "Alleen beschikbaar in lokale ontwikkeling (npm run dev)." }, { status: 404 });
  }

  if (!EMAIL_ENABLED) {
    return NextResponse.json({
      ok: false,
      reason: "RESEND_API_KEY niet gevonden. Controleer of de regel echt in .env.local staat en of je 'npm run dev' opnieuw hebt gestart nadat je 'm toevoegde.",
    });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "Niet ingelogd. Log eerst in op de site in deze browser en open deze pagina dan opnieuw." }, { status: 401 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: user.email,
    subject: "Testmail — je Resend-koppeling werkt",
    html: notificationEmailHtml({
      title: "Testmail",
      body: "Als je dit leest, is de e-mailkoppeling van Vyra correct ingesteld en klaar voor gebruik.",
      href: null,
    }),
  });

  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sentTo: user.email, id: data?.id });
}
