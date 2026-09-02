import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin doorgeefluik voor de eigen uitnodigingsfoto van de
 * organisator (publieke "gallery-media"-bucket bij Supabase Storage,
 * onder `invitations/<eventId>/...`).
 *
 * Waarom dit nodig is: de "Download als afbeelding"-knop (InvitationEditor,
 * html-to-image) tekent de foto op een <canvas>. Zodra de browser die foto
 * als cross-origin ziet, weigert hij de canvas nog te exporteren ("tainted
 * canvas") — een browserbeveiliging, geen bug in de foto zelf. Of dat
 * gebeurt hangt af van of Supabase Storage CORS-headers meestuurt, en dat
 * bleek in de praktijk niet betrouwbaar genoeg om op te vertrouwen. Door de
 * foto via DEZE route op te halen (hetzelfde domein als de rest van de
 * app), is de foto voor de browser altijd "same origin" — dan speelt dit
 * probleem principieel niet meer, ongeacht wat Supabase zelf doet.
 *
 * Bewust GEEN vrije URL als parameter (dat zou een open proxy zijn, elke
 * willekeurige website zou deze route dan als anonieme doorgeefluik kunnen
 * misbruiken) — alleen een storage-PAD dat met "invitations/" begint; de
 * volledige URL wordt hier zelf opgebouwd. De foto's in deze map zijn
 * sowieso al publiek leesbaar (dezelfde "gallery-media"-bucket als
 * gastenfoto's), dus dit geeft geen toegang tot iets dat nu al niet
 * publiek was.
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");
  if (!path || !/^invitations\/[a-zA-Z0-9/_.-]+$/.test(path)) {
    return NextResponse.json({ error: "Ongeldig pad." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: "Supabase is niet geconfigureerd." }, { status: 500 });
  }

  const objectUrl = `${supabaseUrl}/storage/v1/object/public/gallery-media/${path}`;
  let upstream: Response;
  try {
    upstream = await fetch(objectUrl, { cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "Foto kon niet opgehaald worden." }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Foto niet gevonden." }, { status: 404 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
}
