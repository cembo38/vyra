import { NextRequest, NextResponse } from "next/server";

/**
 * TIJDELIJK diagnose-endpoint (sep. 2026) — NIET permanent, wordt in de
 * eerstvolgende sync weer verwijderd zodra CRON_SECRET goed staat.
 *
 * Doel: de "curl geeft 401 met én zonder wachtwoord"-puzzel oplossen zonder
 * dat Cem het echte wachtwoord ooit hoeft te delen. Toont NOOIT de waarde
 * van CRON_SECRET of de meegestuurde header zelf — alleen of ze bestaan en
 * hoe lang ze zijn, genoeg om een lege variabele, een verkeerde deployment,
 * of een spatie/regeleinde in de waarde van elkaar te onderscheiden.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET ?? null;
  const authHeader = request.headers.get("authorization");
  const bearerValue = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  return NextResponse.json({
    cronSecretIsSet: cronSecret !== null,
    cronSecretLength: cronSecret?.length ?? null,
    authHeaderPresent: authHeader !== null,
    authHeaderFormatIsBearer: bearerValue !== null,
    bearerValueLength: bearerValue?.length ?? null,
    exactMatch: cronSecret !== null && bearerValue !== null && cronSecret === bearerValue,
    verwachteLengte: 64,
  });
}
