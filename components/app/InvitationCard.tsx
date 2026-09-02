"use client";

import { forwardRef, useRef } from "react";
import { Camera } from "lucide-react";
import { getInvitationTemplate } from "@/lib/invitation-templates";
import "@/components/app/invitation-templates.css";

export interface InvitationCardProps {
  templateKey: string;
  title: string;
  welcomeText: string;
  dateLabel: string | null;
  locationLabel: string | null;
  photoUrl: string | null;
  /** Alleen gebruikt door het "Zwart-wit Chic"-sjabloon (het grote dagnummer) — dag-van-de-maand uit de evenementdatum, of `null` zonder datum. */
  dayNumber?: number | null;
  /** Editor-modus: lege foto-vakjes tonen een "tik om te uploaden"-hint i.p.v. leeg/verborgen te blijven (voor gasten op de publieke deelpagina). */
  editable?: boolean;
  /** Positie (0-100, standaard 50 = gecentreerd) van de foto binnen zijn kader — CSS object-position. */
  photoPositionX?: number;
  photoPositionY?: number;
  /** Alleen aangeroepen tijdens het slepen in `editable`-modus (zie InvitationEditor.tsx) — bewust NIET aangeroepen voor de kleine sjabloon-voorbeelden. */
  onPhotoPositionChange?: (x: number, y: number) => void;
  /** Maakt de RSVP-knop daadwerkelijk klikbaar (alleen op de publieke uitnodigingspagina, zie InvitationRsvpCard.tsx) — in de editor-voorvertoning en de sjabloon-kiezer blijft dit element decoratief. */
  onRsvpClick?: () => void;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function PhotoSlot({
  photoUrl,
  editable,
  optional,
  alt,
  positionX = 50,
  positionY = 50,
  onPositionChange,
}: {
  photoUrl: string | null;
  editable: boolean;
  optional: boolean;
  alt: string;
  positionX?: number;
  positionY?: number;
  onPositionChange?: (x: number, y: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  function updateFromPointer(e: React.PointerEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    onPositionChange?.(clampPercent(((e.clientX - rect.left) / rect.width) * 100), clampPercent(((e.clientY - rect.top) / rect.height) * 100));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!onPositionChange) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e);
  }
  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    updateFromPointer(e);
  }
  function handlePointerUp() {
    draggingRef.current = false;
  }

  if (photoUrl) {
    return (
      <div
        ref={containerRef}
        className="photo-slot"
        style={{ border: "none", opacity: 1, cursor: onPositionChange ? "grab" : undefined, touchAction: onPositionChange ? "none" : undefined }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt={alt} crossOrigin="anonymous" draggable={false} style={{ objectPosition: `${positionX}% ${positionY}%` }} />
      </div>
    );
  }
  if (editable) {
    return (
      <div className="photo-slot">
        <Camera size={11} /> Foto{optional ? " (optioneel)" : ""}
      </div>
    );
  }
  if (optional) return null;
  return <div className="photo-slot" style={{ border: "none", opacity: 0.14, background: "currentColor" }} />;
}

function Rsvp({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  if (onClick) {
    return (
      <button type="button" className="rsvp" onClick={onClick}>
        {children}
      </button>
    );
  }
  return <div className="rsvp">{children}</div>;
}

/**
 * Eén uitnodigingssjabloon, gevuld met de echte gegevens van het
 * evenement. De 15 stijlen (CSS in invitation-templates.css) komen bijna
 * letterlijk uit de mockup die Cem eerder goedkeurde — hier alleen de
 * structuur per stijl, met props i.p.v. de voorbeeldtekst uit de mockup.
 * `forwardRef` zodat de editor de DOM-node kan pakken voor de
 * "download als afbeelding"-knop (modern-screenshot, zie InvitationEditor.tsx).
 */
export const InvitationCard = forwardRef<HTMLDivElement, InvitationCardProps>(function InvitationCard(
  {
    templateKey,
    title,
    welcomeText,
    dateLabel,
    locationLabel,
    photoUrl,
    dayNumber = null,
    editable = false,
    photoPositionX = 50,
    photoPositionY = 50,
    onPhotoPositionChange,
    onRsvpClick,
  },
  ref
) {
  const tpl = getInvitationTemplate(templateKey);
  if (!tpl) return null;
  const rsvpLabel = tpl.rsvpLabel;
  const eyebrow = welcomeText || tpl.defaultWelcomeText;

  const meta = (
    <>
      {dateLabel && <p className="meta">{dateLabel}</p>}
      {locationLabel && <p className="meta">{locationLabel}</p>}
    </>
  );

  // Eén keer opgebouwd i.p.v. bij elk van de 15 sjabloon-cases hieronder
  // herhaald — de foto-positie is alleen versleepbaar in editable-modus, de
  // RSVP-knop alleen klikbaar wanneer de aanroeper (InvitationRsvpCard) dat
  // expliciet wil.
  const photoSlotRequired = (
    <PhotoSlot
      photoUrl={photoUrl}
      editable={editable}
      optional={false}
      alt={title}
      positionX={photoPositionX}
      positionY={photoPositionY}
      onPositionChange={editable ? onPhotoPositionChange : undefined}
    />
  );
  const photoSlotOptional = (
    <PhotoSlot
      photoUrl={photoUrl}
      editable={editable}
      optional
      alt={title}
      positionX={photoPositionX}
      positionY={photoPositionY}
      onPositionChange={editable ? onPhotoPositionChange : undefined}
    />
  );
  const rsvpElement = <Rsvp onClick={onRsvpClick}>{rsvpLabel}</Rsvp>;

  let inner: React.ReactNode;
  switch (tpl.className) {
    case "t-klassiek":
      inner = (
        <>
          {eyebrow && <div className="eyebrow2">{eyebrow}</div>}
          {photoSlotRequired}
          <h2>{title}</h2>
          <div className="rule" />
          {meta}
          {rsvpElement}
        </>
      );
      break;

    case "t-speels":
      inner = (
        <>
          <div className="top">
            {photoSlotRequired}
          </div>
          <div className="bottom">
            <h2>{title}</h2>
            {meta}
            {rsvpElement}
          </div>
        </>
      );
      break;

    case "t-botanisch":
      inner = (
        <>
          <svg viewBox="0 0 48 48" fill="none" stroke="#7c9468" strokeWidth="1.4">
            <path d="M24 42V10" />
            <path d="M24 16c0-6 6-9 12-8-1 7-6 11-12 9" />
            <path d="M24 24c0-6-6-9-12-8 1 7 6 11 12 9" />
            <path d="M24 32c0-6 6-9 12-8-1 7-6 11-12 9" />
          </svg>
          {eyebrow && <div className="eyebrow2">{eyebrow}</div>}
          <h2>{title}</h2>
          {meta}
          {photoSlotOptional}
          {rsvpElement}
        </>
      );
      break;

    case "t-zakelijk": {
      const grid: React.CSSProperties = {
        backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)",
      };
      inner = (
        <>
          {eyebrow && <div className="eyebrow2">{eyebrow}</div>}
          <div style={grid}>
            <h2>{title}</h2>
            {meta}
            {photoSlotOptional}
          </div>
          {rsvpElement}
        </>
      );
      break;
    }

    case "t-vintage":
      inner = (
        <>
          {photoSlotRequired}
          <h2>{title}</h2>
          {meta}
          {rsvpElement}
        </>
      );
      break;

    case "t-chic":
      inner = (
        <>
          {eyebrow && <div className="eyebrow2">{eyebrow}</div>}
          <div>
            {dayNumber !== null && <div className="big">{String(dayNumber).padStart(2, "0")}</div>}
            <h2>{title}</h2>
            {meta}
            {photoSlotOptional}
          </div>
          {rsvpElement}
        </>
      );
      break;

    case "t-zomer":
      inner = (
        <>
          {photoSlotRequired}
          <h2>{title}</h2>
          {meta}
          {rsvpElement}
        </>
      );
      break;

    case "t-vyra":
      inner = (
        <>
          <div className="mark">
            <span>V</span>
          </div>
          <h2>{title}</h2>
          {meta}
          {photoSlotOptional}
          {rsvpElement}
        </>
      );
      break;

    case "t-aquarel":
      inner = (
        <>
          {eyebrow && <div className="eyebrow2">{eyebrow}</div>}
          {photoSlotRequired}
          <h2>{title}</h2>
          {meta}
          {rsvpElement}
        </>
      );
      break;

    case "t-neon":
      inner = (
        <>
          {eyebrow && <div className="eyebrow2">{eyebrow}</div>}
          <h2>{title}</h2>
          {meta}
          {photoSlotRequired}
          {rsvpElement}
        </>
      );
      break;

    case "t-scandi":
      inner = (
        <>
          <svg viewBox="0 0 48 48" fill="none" stroke="#9a968c" strokeWidth="1.3">
            <circle cx="24" cy="24" r="15" />
            <path d="M24 9v30M9 24h30" />
          </svg>
          {eyebrow && <div className="eyebrow2">{eyebrow}</div>}
          <h2>{title}</h2>
          {meta}
          {photoSlotOptional}
          {rsvpElement}
        </>
      );
      break;

    case "t-retro":
      inner = (
        <>
          {eyebrow && <div className="eyebrow2">{eyebrow}</div>}
          {photoSlotRequired}
          <h2>{title}</h2>
          {meta}
          {rsvpElement}
        </>
      );
      break;

    case "t-tropisch":
      inner = (
        <>
          <svg viewBox="0 0 48 48" fill="#ffb87a">
            <path d="M24 44c0-14 8-22 8-22s-14 2-14 16c0 3 2 6 6 6z" />
            <path d="M24 44c0-14-8-22-8-22s14 2 14 16c0 3-2 6-6 6z" opacity=".7" />
          </svg>
          {eyebrow && <div className="eyebrow2">{eyebrow}</div>}
          <h2>{title}</h2>
          {meta}
          {photoSlotRequired}
          {rsvpElement}
        </>
      );
      break;

    case "t-confetti":
      inner = (
        <>
          {eyebrow && <div className="eyebrow2">{eyebrow}</div>}
          {photoSlotRequired}
          <h2>{title}</h2>
          {meta}
          {rsvpElement}
        </>
      );
      break;

    case "t-fotolijst":
      inner = (
        <>
          {photoSlotRequired}
          <h2>{title}</h2>
          {meta}
          {rsvpElement}
        </>
      );
      break;

    default:
      inner = <h2>{title}</h2>;
  }

  return (
    <div ref={ref} className="invitation-frame-scope">
      <div className={`frame ${tpl.className}`}>{inner}</div>
    </div>
  );
});
