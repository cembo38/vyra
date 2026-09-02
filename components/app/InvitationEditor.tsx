"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { domToCanvas } from "modern-screenshot";
import { jsPDF } from "jspdf";
import { Check, Download, ImagePlus, Link2, Loader2, Move, Trash2 } from "lucide-react";
import { InvitationCard } from "@/components/app/InvitationCard";
import { Field, Input } from "@/components/ui/Form";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";
import {
  removeInvitationPhotoAction,
  setInvitationTemplateAction,
  updateInvitationPhotoPositionAction,
  updateInvitationTextAction,
  uploadInvitationPhotoAction,
} from "@/lib/actions/gallery-actions";
import { INVITATION_TEMPLATES, INVITATION_TEMPLATE_CATEGORIES, INVITATION_FONTS_URL } from "@/lib/invitation-templates";
import { formatDateNL } from "@/lib/utils";

export function InvitationEditor({
  eventId,
  eventName,
  eventDate,
  eventStartTime,
  eventLocationLabel,
  initialTemplateKey,
  initialTitle,
  initialWelcomeText,
  initialPhotoUrl,
  initialPhotoPositionX,
  initialPhotoPositionY,
  shareUrl,
}: {
  eventId: string;
  eventName: string;
  eventDate: string | null;
  eventStartTime: string | null;
  eventLocationLabel: string | null;
  initialTemplateKey: string | null;
  initialTitle: string | null;
  initialWelcomeText: string | null;
  initialPhotoUrl: string | null;
  initialPhotoPositionX: number;
  initialPhotoPositionY: number;
  /** Publieke uitnodigingslink (`${SITE_URL}/uitnodiging/<token>`), server-side opgebouwd in gallery/page.tsx — het doel van de klikbare link die in de gedownloade PDF wordt gebakken (zie downloadPdf hieronder) én van de "Kopieer link"-knop. */
  shareUrl: string;
}) {
  const [templateKey, setTemplateKey] = useState(initialTemplateKey ?? INVITATION_TEMPLATES[0].key);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [welcomeText, setWelcomeText] = useState(initialWelcomeText ?? "");
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [photoPositionX, setPhotoPositionX] = useState(initialPhotoPositionX);
  const [photoPositionY, setPhotoPositionY] = useState(initialPhotoPositionY);
  const [savedTick, setSavedTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const positionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dateLabel = useMemo(() => {
    const d = formatDateNL(eventDate, { day: "numeric", month: "long", year: "numeric" });
    if (!d) return null;
    return eventStartTime ? `${d} · ${eventStartTime}` : d;
  }, [eventDate, eventStartTime]);

  const dayNumber = eventDate ? new Date(`${eventDate}T00:00:00`).getDate() : null;

  function pickTemplate(key: string) {
    setTemplateKey(key);
    startTransition(async () => {
      await setInvitationTemplateAction(eventId, key);
    });
  }

  function saveText() {
    setError(null);
    const formData = new FormData();
    formData.set("title", title);
    formData.set("welcomeText", welcomeText);
    startTransition(async () => {
      const result = await updateInvitationTextAction(eventId, formData);
      if (result.ok) setSavedTick((n) => n + 1);
      else setError(result.error ?? "Opslaan is mislukt.");
    });
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > 8 * 1024 * 1024) {
      setError("Dit bestand is groter dan de toegestane 8MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPhotoUrl(previewUrl);
    // Een nieuwe foto begint altijd gecentreerd — een eerder ingestelde
    // sleeppositie hoorde bij de vorige foto (zie ook uploadInvitationPhoto
    // in lib/data/store.ts, die dit server-side hetzelfde doet).
    setPhotoPositionX(50);
    setPhotoPositionY(50);
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadInvitationPhotoAction(eventId, formData);
      if (!result.ok) setError(result.error ?? "Uploaden is mislukt.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function removePhoto() {
    setPhotoUrl(null);
    setPhotoPositionX(50);
    setPhotoPositionY(50);
    startTransition(async () => {
      await removeInvitationPhotoAction(eventId);
    });
  }

  /**
   * Aangeroepen bij elke sleepbeweging (zie InvitationCard.tsx/PhotoSlot) —
   * de lokale voorvertoning volgt direct mee (optimistic), het opslaan
   * naar de server wordt bewust gedebounced (pas 500ms na de laatste
   * beweging) zodat niet elke pixel sleep een eigen server-aanroep wordt.
   */
  function handlePhotoPositionChange(x: number, y: number) {
    setPhotoPositionX(x);
    setPhotoPositionY(y);
    if (positionSaveTimer.current) clearTimeout(positionSaveTimer.current);
    positionSaveTimer.current = setTimeout(() => {
      startTransition(async () => {
        await updateInvitationPhotoPositionAction(eventId, Math.round(x), Math.round(y));
      });
    }, 500);
  }

  /**
   * "Download als PDF" (Cem, sep. 2026: eerst "Download als afbeelding",
   * later omgezet naar PDF). De achtergrond van twee eerdere fixes:
   *
   * 1) Een eerste vermoeden ("tainted canvas": de browser weigert een
   *    <canvas> te exporteren zodra er een cross-origin afbeelding op
   *    getekend is) bleek NIET de oorzaak — de foto ophalen via
   *    /api/invitation-photo (ons eigen domein, dus altijd "same origin"
   *    voor de browser, zie de toelichting in dat bestand) loste een
   *    eerdere downloadfout niet op. Deze stap blijft wel gewoon staan: hij
   *    is onschadelijk en sluit één mogelijke foutbron structureel uit.
   * 2) De echte oorzaak van die eerdere fout: de toenmalige bibliotheek
   *    (html-to-image) rastert de hele kaart eerst als één grote
   *    SVG+<foreignObject>-afbeelding en laadt DIE als <img> — dat laden
   *    faalde in Cems browser. Opgelost door over te stappen op
   *    `modern-screenshot`, een onderhouden opvolger die dit exact
   *    probleemgebied aanpakt.
   *
   * PNG → PDF (deze keer): een gedownloade PNG is een platte foto — een
   * knop erop kan nooit klikbaar zijn, wat óók bij WhatsApp/printen alsnog
   * geen actie triggert. Een PDF kan wél een echte, klikbare hyperlink
   * bevatten (een "link annotation", zie jsPDF's `link()`), dus wordt de
   * kaart nu met modern-screenshot naar een <canvas> gerasterd, in een PDF
   * gezet met jsPDF, en krijgt de HELE pagina — niet alleen de knop, dat
   * scheelt precieze coördinaten uitrekenen per sjabloon-layout — een
   * klikbare link naar de publieke uitnodigingspagina (`shareUrl`). Wie
   * de PDF opent (Voorvertoning, Acrobat, de meeste PDF-viewers in de
   * browser) kan dus overal op de kaart tikken om te bevestigen.
   *
   * Als tweede vangnet: mocht de Google Fonts-inbedding zelf de
   * boosdoener zijn, proberen we het nog één keer zonder lettertypen in
   * te sluiten (`font: false`) — dan mist de afbeelding het echte
   * sjabloonlettertype, maar downloadt hij tenminste.
   */
  async function downloadPdf() {
    if (!cardRef.current) return;
    setDownloading(true);
    setError(null);

    const imgEl = cardRef.current.querySelector<HTMLImageElement>(".photo-slot img");
    const originalSrc = imgEl?.src;
    let restoreSrc = false;

    try {
      const storagePathMarker = "/storage/v1/object/public/gallery-media/";
      const markerIndex = originalSrc?.indexOf(storagePathMarker) ?? -1;

      if (imgEl && originalSrc && markerIndex !== -1) {
        try {
          const storagePath = originalSrc.slice(markerIndex + storagePathMarker.length);
          const res = await fetch(`/api/invitation-photo?path=${encodeURIComponent(storagePath)}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`Foto ophalen via /api/invitation-photo gaf status ${res.status}`);
          const blob = await res.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("FileReader mislukt"));
            reader.readAsDataURL(blob);
          });
          imgEl.src = dataUrl;
          restoreSrc = true;
          // Wacht tot de browser de nieuwe data-URL echt heeft gedecodeerd
          // voordat modern-screenshot de kaart rastert — anders bestaat de
          // kans dat de foto nog niet klaar is en leeg meekomt op de PDF.
          if (imgEl.decode) {
            try {
              await imgEl.decode();
            } catch {
              // Negeren — domToCanvas() wacht zelf ook nog op de load van
              // elke afbeelding, dit is puur een extra zekerheidje.
            }
          }
        } catch (fetchErr) {
          console.warn("[InvitationEditor] Foto kon niet via /api/invitation-photo geladen worden, ga door met de originele afbeelding.", fetchErr);
        }
      }

      let canvas: HTMLCanvasElement;
      try {
        canvas = await domToCanvas(cardRef.current, { scale: 3 });
      } catch (firstErr) {
        console.warn("[InvitationEditor] Eerste downloadpoging mislukt, probeer opnieuw zonder lettertypen in te sluiten.", firstErr);
        canvas = await domToCanvas(cardRef.current, { scale: 3, font: false });
      }

      // Eerdere versie zette het PDF-paginaformaat gelijk aan `canvas`'s
      // pixelafmetingen (unit:"px"). `canvas` is het scherm-formaat van de
      // preview × scale:3 — dat heeft niets te maken met een zinnig
      // papierformaat, en werd op Cems laptop (brede preview-kolom) een
      // veel te grote pagina: PDF-lezers tonen zo'n pagina standaard
      // "ingezoomd op passend", waardoor alles (tekst, foto) juist heel
      // klein/uitgezoomd oogt. Alle 15 sjablonen hebben bovendien altijd
      // dezelfde 5:7-verhouding (`.frame { aspect-ratio: 5/7 }` in
      // invitation-templates.css) — dat komt vrijwel exact overeen met
      // een A5-vel (148×210mm, verhouding 5:7.09), dus we zetten de PDF nu
      // gewoon vast op een echt A5-formaat (unit "mm") en laten de
      // kaart-afbeelding die pagina vullen — een voorspelbaar, herkenbaar
      // uitnodigingsformaat ongeacht hoe breed de preview op het scherm
      // toevallig gerenderd werd.
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(canvas, "PNG", 0, 0, pageWidth, pageHeight);
      // De hele pagina is klikbaar (i.p.v. alleen de knop) — dat is veruit
      // de betrouwbaarste manier om dit over 15 heel verschillende
      // sjabloon-layouts heen te garanderen, zonder per sjabloon de exacte
      // positie van de knop te moeten uitrekenen.
      pdf.link(0, 0, pageWidth, pageHeight, { url: shareUrl });
      pdf.save(`uitnodiging-${eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`);
    } catch (err) {
      console.error("[InvitationEditor] Downloaden als PDF definitief mislukt.", err);
      // De technische foutmelding wordt bewust WEL getoond (i.p.v. alleen
      // in de browserconsole te loggen) — Cem is geen developer en kan geen
      // devtools-console openen om 'm door te sturen; met de tekst erbij
      // kan hij gewoon een screenshot sturen en is de oorzaak meteen
      // zichtbaar i.p.v. blind verder te moeten zoeken.
      const detail = err instanceof Error && err.message ? err.message : String(err);
      setError(`Downloaden is niet gelukt — probeer het nog eens. (${detail})`);
    } finally {
      if (restoreSrc && imgEl && originalSrc) imgEl.src = originalSrc;
      setDownloading(false);
    }
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Klembord niet beschikbaar — stil negeren.
    }
  }

  const preview = useMemo(
    () => ({
      title: title || eventName,
      welcomeText,
      dateLabel,
      locationLabel: eventLocationLabel,
      photoUrl,
      dayNumber,
      photoPositionX,
      photoPositionY,
    }),
    [title, eventName, welcomeText, dateLabel, eventLocationLabel, photoUrl, dayNumber, photoPositionX, photoPositionY]
  );

  return (
    <div className="invitation-frame-scope">
      <link rel="stylesheet" href={INVITATION_FONTS_URL} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          {INVITATION_TEMPLATE_CATEGORIES.map((category) => (
            <div key={category} className="mb-5">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">{category}</h3>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
                {INVITATION_TEMPLATES.filter((t) => t.category === category).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => pickTemplate(t.key)}
                    className={`overflow-hidden rounded-lg text-left transition-all ${templateKey === t.key ? "ring-2 ring-clay ring-offset-2 ring-offset-paper" : "opacity-80 hover:opacity-100"}`}
                    title={`${t.label} — ${t.fit}`}
                  >
                    <InvitationCard templateKey={t.key} {...preview} welcomeText={preview.welcomeText || t.defaultWelcomeText} editable={false} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="mx-auto max-w-[220px]">
            <InvitationCard ref={cardRef} templateKey={templateKey} {...preview} editable onPhotoPositionChange={handlePhotoPositionChange} />
          </div>
          {photoUrl && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-faint">
              <Move className="size-3 shrink-0" /> Sleep de foto hierboven om het beeld te verplaatsen
            </p>
          )}

          <div className="mt-5 space-y-3">
            <Field label="Titel" hint={`Standaard: "${eventName}"`}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveText} maxLength={120} placeholder={eventName} />
            </Field>
            <Field label="Welkomstzin" hint="Bv. 'U bent van harte uitgenodigd'">
              <Input value={welcomeText} onChange={(e) => setWelcomeText(e.target.value)} onBlur={saveText} maxLength={80} placeholder="Optioneel" />
            </Field>

            {photoUrl ? (
              <button type="button" onClick={removePhoto} className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-xs font-medium text-ink-soft hover:border-danger/50 hover:text-danger">
                <Trash2 className="size-3.5" /> Foto verwijderen
              </button>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-xs font-medium text-ink-soft hover:border-clay/50">
                <ImagePlus className="size-3.5" /> Eigen foto uploaden
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />

            {pending && <p className="flex items-center gap-1.5 text-xs text-ink-faint"><Loader2 className="size-3 animate-spin" /> Bezig met opslaan…</p>}
            {!pending && savedTick > 0 && <p className="flex items-center gap-1.5 text-xs text-success"><Check className="size-3" /> Opgeslagen</p>}
            {error && <p className="rounded-xl bg-danger-50 px-3 py-2 text-xs text-danger">{error}</p>}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={downloadPdf}
                disabled={downloading}
                className="lift-hover inline-flex items-center gap-1.5 rounded-full bg-clay px-4 py-2 text-xs font-medium text-white hover:bg-clay-dark disabled:opacity-60"
              >
                {downloading ? <VyraMarkSpinner className="text-sm" /> : <Download className="size-3.5" />}
                Download als PDF
              </button>
              <button
                type="button"
                onClick={copyShareLink}
                className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-xs font-medium text-ink-soft hover:border-clay/50"
              >
                {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
                {copied ? "Link gekopieerd" : "Deel-link kopiëren"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
