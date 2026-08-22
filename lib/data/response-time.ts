/**
 * Berekening van een leverancier's gemiddelde reactietijd — LOS van elke
 * Supabase-aanroep, zodat dit zonder mocks of een testdatabase te
 * unit-testen is (zie response-time.test.ts). De echte IO (berichten
 * ophalen, `suppliers.avg_response_hours` wegschrijven) staat in
 * app/api/cron/recompute-response-times/route.ts, dat deze functie
 * aanroept — dezelfde scheiding als bv. `pickOfferAmountCents` in
 * lib/ai/supplierOffer.ts.
 *
 * AANLEIDING: dit veld stond eerder alleen als handmatig ingevulde
 * seed-waarde in de database (`avg_response_hours`, default 24) en werd
 * nooit bijgewerkt op basis van echte berichten — het "Reageert meestal
 * binnen X uur"-label op een leveranciersprofiel was dus in feite
 * verzonnen. Deze module maakt dat cijfer écht: berekend uit de
 * daadwerkelijke tijd tussen een binnenkomend bericht van de organisator
 * en het eerstvolgende antwoord van de leverancier.
 */

export type ResponseTimeSender = "customer" | "supplier" | "ai_summary";

export interface ResponseTimeMessage {
  sender: ResponseTimeSender;
  /** ISO-tijdstempel, zoals `messages.created_at` uit de database. */
  createdAt: string;
}

/**
 * Berekent de gemiddelde reactietijd in hele uren, uit de berichten van
 * een leverancier — gegroepeerd per gesprek (één "thread" per
 * event+categorie, zie migratie 0001: `messages` heeft geen apart
 * thread-id, de combinatie event_id+category_key+supplier_id bepaalt het
 * gesprek).
 *
 * Telmethode per thread: zodra de EERSTE organisator-bericht in een nog
 * onbeantwoorde reeks binnenkomt, begint de klok te lopen ("wachtend
 * sinds"). Zodra de leverancier antwoordt, stopt de klok en levert dat één
 * meting op; een eventuele TWEEDE organisator-bericht vóór dat antwoord telt
 * niet apart mee (voorkomt dat een ongeduldig dubbel bericht de gemeten
 * reactietijd kunstmatig verlaagt). Na een leveranciersantwoord kan een
 * nieuwe wachtperiode weer beginnen — zo levert een gesprek met meerdere
 * heen-en-weer-uitwisselingen ook meerdere metingen op, voor een preciezer
 * gemiddelde dan alleen de allereerste reactie per gesprek.
 *
 * Berichten van `ai_summary` (automatische samenvattingen, geen van beide
 * partijen) beïnvloeden de wachtstatus niet.
 *
 * Threads verwachten hun berichten al oplopend op tijd gesorteerd (zoals
 * `getMessages()`/de cronjob dat al levert) — deze functie sorteert zelf
 * niet opnieuw.
 *
 * Geeft `null` terug als er geen enkele meting is (bv. een leverancier
 * zonder berichtgeschiedenis, of die nog nooit heeft geantwoord) —
 * bewust GEEN 0, want dat zou zo iemand onterecht als razendsnel laten
 * ogen. De aanroeper laat het bestaande cijfer dan ongemoeid.
 */
export function computeAvgResponseHours(threads: ResponseTimeMessage[][]): number | null {
  const samplesHours: number[] = [];

  for (const thread of threads) {
    let waitingSinceMs: number | null = null;
    for (const message of thread) {
      const t = new Date(message.createdAt).getTime();
      if (Number.isNaN(t)) continue;
      if (message.sender === "customer") {
        if (waitingSinceMs === null) waitingSinceMs = t;
      } else if (message.sender === "supplier") {
        if (waitingSinceMs !== null) {
          samplesHours.push(Math.max(0, (t - waitingSinceMs) / 3_600_000));
          waitingSinceMs = null;
        }
      }
    }
  }

  if (samplesHours.length === 0) return null;
  const avg = samplesHours.reduce((sum, h) => sum + h, 0) / samplesHours.length;
  return Math.round(avg);
}
