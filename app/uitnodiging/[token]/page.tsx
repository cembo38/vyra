import { notFound } from "next/navigation";
import Link from "next/link";
import { getGalleryPublic } from "@/lib/data/store";
import { Logo } from "@/components/marketing/Logo";
import { InvitationCard } from "@/components/app/InvitationCard";
import { INVITATION_FONTS_URL } from "@/lib/invitation-templates";
import { formatDateNL } from "@/lib/utils";
import { Camera, MailOpen } from "lucide-react";

export const metadata = { title: "Uitnodiging — Vyra" };

/**
 * Publieke, niet-bewerkbare uitnodigingspagina (Deel C.5) — de "leuke,
 * feestelijke" tegenhanger van de zakelijker georiënteerde
 * `/gallery/[token]`-overzichtspagina. Zelfde toegangsmodel: kennis van de
 * `uploadToken` in de link is de enige toegangscontrole (zie
 * getGalleryPublic), er is bewust geen extra check nodig — wie de link
 * heeft, mag 'm zien, precies zoals bij de gastenfoto-pagina.
 */
export default async function InvitationPage(props: PageProps<"/uitnodiging/[token]">) {
  const { token } = await props.params;
  const gallery = await getGalleryPublic(token);
  if (!gallery) notFound();

  const templateKey = gallery.invitationTemplateKey;
  const notReady = gallery.status !== "active" || gallery.tier !== "premium" || !templateKey;

  if (notReady || !templateKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-dim px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="mb-8 flex justify-center"><Logo /></div>
          <div className="rounded-2xl border border-line bg-white p-8 [box-shadow:var(--shadow-card)]">
            <MailOpen className="mx-auto size-8 text-ink-faint" />
            <h1 className="mt-4 font-display text-xl text-ink">Deze uitnodiging is er nog niet</h1>
            <p className="mt-2 text-sm text-ink-soft">
              {gallery.status !== "active"
                ? "Deze pagina is niet (meer) actief."
                : "De organisator heeft nog geen uitnodiging ingesteld voor dit evenement."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const dateLabel = (() => {
    const d = formatDateNL(gallery.eventDate, { day: "numeric", month: "long", year: "numeric" });
    if (!d) return null;
    return gallery.eventStartTime ? `${d} · ${gallery.eventStartTime}` : d;
  })();
  const dayNumber = gallery.eventDate ? new Date(`${gallery.eventDate}T00:00:00`).getDate() : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-clay-50 via-paper to-sage-50 px-4 py-10 sm:px-6 sm:py-14">
      <link rel="stylesheet" href={INVITATION_FONTS_URL} />
      <div className="pointer-events-none fixed -right-16 -top-20 size-56 rounded-full bg-clay/10 blur-2xl" />
      <div className="pointer-events-none fixed -bottom-24 -left-10 size-56 rounded-full bg-sage/10 blur-2xl" />

      <div className="relative mx-auto max-w-sm">
        <div className="mb-7 flex justify-center"><Logo /></div>

        <InvitationCard
          templateKey={templateKey}
          title={gallery.invitationTitle || gallery.eventName}
          welcomeText={gallery.invitationWelcomeText ?? ""}
          dateLabel={dateLabel}
          locationLabel={gallery.eventLocationLabel}
          photoUrl={gallery.invitationPhotoUrl}
          dayNumber={dayNumber}
          editable={false}
        />

        <div className="mt-7 text-center">
          <Link
            href={`/gallery/${token}`}
            className="lift-hover inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-xs font-medium text-white hover:bg-ink/90"
          >
            <Camera className="size-3.5" /> Bekijk de gastenfoto-pagina
          </Link>
          <p className="mt-3 text-xs text-ink-faint">Deel je eigen foto&apos;s en berichtjes via de knop hierboven.</p>
        </div>
      </div>
    </div>
  );
}
