/**
 * Kleine, dependency-vrije iCalendar (RFC 5545) bouwhelper — spec-item
 * #128. Bewust geen npm-package (bv. `ical-generator`) voor zoiets kleins:
 * we genereren alleen simpele DATE-only (hele-dag) VEVENTs, wat met een
 * paar tientallen regels net zo betrouwbaar met de hand kan.
 *
 * Bewuste vereenvoudiging: alle VEVENTs zijn hele-dag-afspraken (VALUE=DATE)
 * i.p.v. met exacte tijd + tijdzone (VTIMEZONE). Een boeking met een bekende
 * start-/eindtijd krijgt die tijd wél zichtbaar in de titel (bv. "14:00–
 * 18:00"), maar niet als losse DTSTART/DTEND-tijdstippen — dat scheelt de
 * nodige complexiteit (VTIMEZONE-blokken, zomertijd) voor een eerste versie,
 * en een hele-dag-blok in de eigen agenda van de leverancier ("dit is een
 * werkdag, plan er niks anders op") is voor het doel van deze feature
 * (voorkomen van dubbelboekingen) net zo bruikbaar als een exact tijdvak.
 */

export interface IcsEvent {
  /** Stabiel en uniek binnen deze kalender — MOET hetzelfde blijven bij elke herberekening, anders ontstaan dubbele afspraken in de agenda-app bij elke sync. */
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  /** YYYY-MM-DD — hele-dag-afspraak. */
  date: string;
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 §3.1: regels mogen niet langer zijn dan 75 octets — langere regels worden "gevouwen" met een newline gevolgd door een spatie. We rekenen in UTF-16 code units, wat voor de Nederlandse teksten hier (geen surrogate pairs) gelijk staat aan tekens; ruim binnen de marge omdat we bewust op 70 knippen i.p.v. de volle 75. */
function foldIcsLine(line: string): string {
  if (line.length <= 70) return line;
  const parts: string[] = [];
  let rest = line;
  let first = true;
  while (rest.length > 0) {
    const chunkLen = first ? 70 : 69; // 69 + 1 leidende spatie = 70
    parts.push((first ? "" : " ") + rest.slice(0, chunkLen));
    rest = rest.slice(chunkLen);
    first = false;
  }
  return parts.join("\r\n");
}

function dateToIcs(date: string): string {
  return date.replaceAll("-", "");
}

/** DTSTART/DTEND zijn bij hele-dag-afspraken exclusief aan het eind — DTEND moet dus de dag ná `date` zijn (RFC 5545 §3.6.1). */
function nextDateKey(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Bouwt een compleet VCALENDAR-document met hele-dag VEVENTs. `dtstamp` moet
 * door de aanroeper worden meegegeven (i.p.v. hier zelf `new Date()` op te
 * roepen) zodat deze functie zuiver/deterministisch getest kan worden.
 */
export function buildIcsCalendar(opts: { calendarName: string; events: IcsEvent[]; dtstamp: Date }): string {
  const dtstamp = opts.dtstamp.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vyra//Leveranciersagenda//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(opts.calendarName)}`,
    // Vraagt agenda-apps die dit ondersteunen (bv. Google/Outlook) om
    // ongeveer elk uur opnieuw op te halen — hoe vaak dit werkelijk gebeurt
    // is aan de agenda-app zelf, dit is slechts een hint.
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const ev of opts.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${dateToIcs(ev.date)}`,
      `DTEND;VALUE=DATE:${dateToIcs(nextDateKey(ev.date))}`,
      `SUMMARY:${escapeIcsText(ev.summary)}`
    );
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
    // OPAQUE ("bezet") i.p.v. TRANSPARENT: dit zijn juist afspraken die
    // horen te blokkeren in de agenda van de leverancier (boeking of
    // zelf-ingestelde onbeschikbaarheid) — geen informatieve "vrije tijd"-
    // afspraak zoals een verjaardag.
    lines.push("TRANSP:OPAQUE", "END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
