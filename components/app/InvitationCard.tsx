import { forwardRef } from "react";
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
}

function PhotoSlot({ photoUrl, editable, optional, alt }: { photoUrl: string | null; editable: boolean; optional: boolean; alt: string }) {
  if (photoUrl) {
    return (
      <div className="photo-slot" style={{ border: "none", opacity: 1 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt={alt} crossOrigin="anonymous" />
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

function Rsvp({ children }: { children: React.ReactNode }) {
  return <div className="rsvp">{children}</div>;
}

/**
 * Eén uitnodigingssjabloon, gevuld met de echte gegevens van het
 * evenement. De 15 stijlen (CSS in invitation-templates.css) komen bijna
 * letterlijk uit de mockup die Cem eerder goedkeurde — hier alleen de
 * structuur per stijl, met props i.p.v. de voorbeeldtekst uit de mockup.
 * `forwardRef` zodat de editor de DOM-node kan pakken voor de
 * "download als afbeelding"-knop (html-to-image, zie InvitationEditor.tsx).
 */
export const InvitationCard = forwardRef<HTMLDivElement, InvitationCardProps>(function InvitationCard(
  { templateKey, title, welcomeText, dateLabel, locationLabel, photoUrl, dayNumber = null, editable = false },
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

  let inner: React.ReactNode;
  switch (tpl.className) {
    case "t-klassiek":
      inner = (
        <>
          {eyebrow && <div className="eyebrow2">{eyebrow}</div>}
          <PhotoSlot photoUrl={photoUrl} editable={editable} optional={false} alt={title} />
          <h2>{title}</h2>
          <div className="rule" />
          {meta}
          <Rsvp>{rsvpLabel}</Rsvp>
        </>
      );
      break;

    case "t-speels":
      inner = (
        <>
          <div className="top">
            <PhotoSlot photoUrl={photoUrl} editable={editable} optional={false} alt={title} />
          </div>
          <div className="bottom">
            <h2>{title}</h2>
            {meta}
            <Rsvp>{rsvpLabel}</Rsvp>
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
          <PhotoSlot photoUrl={photoUrl} editable={editable} optional alt={title} />
          <Rsvp>{rsvpLabel}</Rsvp>
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
            <PhotoSlot photoUrl={photoUrl} editable={editable} optional alt={title} />
          </div>
          <Rsvp>{rsvpLabel}</Rsvp>
        </>
      );
      break;
    }

    case "t-vintage":
      inner = (
        <>
          <PhotoSlot photoUrl={photoUrl} editable={editable} optional={false} alt={title} />
          <h2>{title}</h2>
          {meta}
          <Rsvp>{rsvpLabel}</Rsvp>
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
            <PhotoSlot photoUrl={photoUrl} editable={editable} optional alt={title} />
          </div>
          <Rsvp>{rsvpLabel}</Rsvp>
        </>
      );
      break;

    case "t-zomer":
      inner = (
        <>
          <PhotoSlot photoUrl={photoUrl} editable={editable} optional={false} alt={title} />
          <h2>{title}</h2>
          {meta}
          <Rsvp>{rsvpLabel}</Rsvp>
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
          <PhotoSlot photoUrl={photoUrl} editable={editable} optional alt={title} />
          <Rsvp>{rsvpLabel}</Rsvp>
        </>
      );
      break;

    case "t-aquarel":
      inner = (
        <>
          {eyebrow && <div className="eyebrow2">{eyebrow}</div>}
          <PhotoSlot photoUrl={photoUrl} editable={editable} optional={false} alt={title} />
          <h2>{title}</h2>
          {meta}
          <Rsvp>{rsvpLabel}</Rsvp>
        </>
      );
      break;

    case "t-neon":
      inner = (
        <>
          {eyebrow && <div className="eyebrow2">{eyebrow}</div>}
          <h2>{title}</h2>
          {meta}
          <PhotoSlot photoUrl={photoUrl} editable={editable} optional={false} alt={title} />
          <Rsvp>{rsvpLabel}</Rsvp>
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
          <PhotoSlot photoUrl={photoUrl} editable={editable} optional alt={title} />
          <Rsvp>{rsvpLabel}</Rsvp>
        </>
      );
      break;

    case "t-retro":
      inner = (
        <>
          {eyebrow && <div className="eyebrow2">{eyebrow}</div>}
          <PhotoSlot photoUrl={photoUrl} editable={editable} optional={false} alt={title} />
          <h2>{title}</h2>
          {meta}
          <Rsvp>{rsvpLabel}</Rsvp>
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
          <PhotoSlot photoUrl={photoUrl} editable={editable} optional={false} alt={title} />
          <Rsvp>{rsvpLabel}</Rsvp>
        </>
      );
      break;

    case "t-confetti":
      inner = (
        <>
          {eyebrow && <div className="eyebrow2">{eyebrow}</div>}
          <PhotoSlot photoUrl={photoUrl} editable={editable} optional={false} alt={title} />
          <h2>{title}</h2>
          {meta}
          <Rsvp>{rsvpLabel}</Rsvp>
        </>
      );
      break;

    case "t-fotolijst":
      inner = (
        <>
          <PhotoSlot photoUrl={photoUrl} editable={editable} optional={false} alt={title} />
          <h2>{title}</h2>
          {meta}
          <Rsvp>{rsvpLabel}</Rsvp>
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
