import "server-only";
import QRCode from "qrcode";

/**
 * Genereert een QR-code als data-URL (PNG) voor de deelbare gastenfoto-link
 * — puur server-side (geen clientbibliotheek nodig, dus geen extra
 * JavaScript naar de browser van een gast/organisator). `errorCorrectionLevel:
 * "M"` is de gebruikelijke middenweg: robuust genoeg om te scannen na een
 * paar keer printen/kopiëren, zonder de code onnodig dicht te maken (zoals
 * "H" zou doen) voor een simpele URL.
 *
 * Geeft `null` terug bij een fout i.p.v. te gooien — een QR-code die niet
 * genereert mag nooit de rest van de gastenfoto-pagina laten crashen; de
 * kopieerbare link blijft sowieso altijd beschikbaar als alternatief.
 */
export async function generateQrCodeDataUrl(url: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 320 });
  } catch (err) {
    console.error("[generateQrCodeDataUrl] QR-code genereren mislukt:", err instanceof Error ? err.message : err);
    return null;
  }
}
