import { notFound } from "next/navigation";
import {
  getEvent,
  getEventGallery,
  getGalleryMessagesForOrganizer,
  getGalleryPhotosForOrganizer,
  getGalleryRsvps,
} from "@/lib/data/store";
import { formatCurrency, GALLERY_PURCHASE_ENABLED, GALLERY_TIER_ORDER, GALLERY_TIERS, SITE_URL } from "@/lib/config";
import { formatDateNL } from "@/lib/utils";
import { generateQrCodeDataUrl } from "@/lib/qrcode";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CopyGalleryLinkButton } from "@/components/app/CopyGalleryLinkButton";
import { GalleryPurchaseButton } from "@/components/app/GalleryPurchaseButton";
import { GalleryPaymentPendingNotice } from "@/components/app/GalleryPaymentPendingNotice";
import { InvitationEditor } from "@/components/app/InvitationEditor";
import {
  deleteGalleryMessageAction,
  deleteGalleryPhotoAction,
  deleteGalleryRsvpAction,
  moderateGalleryMessageAction,
  moderateGalleryPhotoAction,
} from "@/lib/actions/gallery-actions";
import { GalleryRsvpStatus } from "@/lib/types";
import { Camera, Check, ImageOff, Mail, MessageSquareText, Sparkles, Trash2, UserCheck, X } from "lucide-react";

export const metadata = { title: "Gastenfoto's — Vyra" };

const MODERATION_LABEL: Record<string, { label: string; tone: "warning" | "success" | "danger" }> = {
  pending: { label: "Wacht op goedkeuring", tone: "warning" },
  approved: { label: "Zichtbaar voor gasten", tone: "success" },
  rejected: { label: "Afgekeurd", tone: "danger" },
};

const RSVP_LABEL: Record<GalleryRsvpStatus, { label: string; tone: "success" | "warning" | "danger" }> = {
  yes: { label: "Komt", tone: "success" },
  maybe: { label: "Misschien", tone: "warning" },
  no: { label: "Kan niet", tone: "danger" },
};

export default async function EventGalleryPage(props: PageProps<"/events/[id]/gallery">) {
  const { id } = await props.params;
  const event = await getEvent(id);
  if (!event) notFound();

  const searchParams = await props.searchParams;
  const purchaseSuccess = searchParams.purchaseSuccess === "1";
  const purchaseCanceled = searchParams.purchaseCanceled === "1";

  const gallery = await getEventGallery(id);

  if (!gallery || gallery.status === "pending_payment") {
    // Net terug van Stripe, maar de webhook heeft de betaling nog niet
    // verwerkt (of de organisator kwam op een ander moment op deze pagina
    // terwijl er toevallig al een pending_payment-rij bestond, bv. een
    // eerdere afgebroken poging) — toon dan NOOIT stilzwijgend de
    // koopknoppen opnieuw, dat oogt na het betalen alsof er niets is
    // gebeurd. Zie GalleryPaymentPendingNotice.tsx.
    if (purchaseSuccess && gallery) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="font-display text-2xl text-ink">Gastenfoto-pagina</h1>
            <p className="mt-1 text-sm text-ink-faint">Voor {event.name}.</p>
          </div>
          <GalleryPaymentPendingNotice />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl text-ink">Gastenfoto-pagina</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Een eigen, deelbare webpagina voor {event.name} waar gasten via een link of QR-code rechtstreeks foto&apos;s (en bij Premium video&apos;s)
            kunnen uploaden — leuk voor de gasten, leuk om te blijven herinneren.
          </p>
        </div>

        {purchaseCanceled && (
          <div className="rounded-xl bg-warning-50 px-4 py-2.5 text-sm text-warning">Betaling geannuleerd — je kunt het opnieuw proberen wanneer je wilt.</div>
        )}

        {!GALLERY_PURCHASE_ENABLED && (
          <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning">
            Betalen is op dit moment nog niet ingesteld. Zodra dat klaarstaat, kun je hier direct een gastenfoto-pagina kopen.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {GALLERY_TIER_ORDER.map((tier) => {
            const def = GALLERY_TIERS[tier];
            return (
              <Card key={tier} className={tier === "premium" ? "border-clay/40" : undefined}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-lg text-ink">{def.label}</h2>
                  {tier === "premium" && <Badge tone="clay">Meest compleet</Badge>}
                </div>
                <p className="mt-2 font-display text-3xl text-ink">{formatCurrency(def.priceCents)}</p>
                <p className="text-xs text-ink-faint">eenmalig per evenement</p>
                <ul className="mt-4 space-y-2 text-sm text-ink-soft">
                  {def.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-sage" />
                      {perk}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  <GalleryPurchaseButton eventId={id} tier={tier} label={`${def.label} kopen`} disabled={!GALLERY_PURCHASE_ENABLED} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  if (gallery.status === "expired") {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
        <ImageOff className="mx-auto size-8 text-ink-faint" />
        <h2 className="mt-4 font-display text-xl text-ink">Deze gastenfoto-pagina is verlopen</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
          De bewaartermijn van je {GALLERY_TIERS[gallery.tier].label}-pakket is voorbij en de foto&apos;s zijn opgeruimd. Neem contact op als je een
          nieuwe gastenfoto-pagina voor dit evenement wilt.
        </p>
      </div>
    );
  }

  const def = GALLERY_TIERS[gallery.tier];
  const galleryUrl = `${SITE_URL}/gallery/${gallery.uploadToken}`;
  // Basis voor de knop-hyperlink die zo dadelijk in de gedownloade PDF wordt
  // gebakken (zie InvitationEditor.tsx) — altijd het echte publieke domein
  // (SITE_URL), nooit window.location.origin: een lokaal geteste
  // localhost-link zou voor een echte gast een dode link zijn.
  const invitationUrl = `${SITE_URL}/uitnodiging/${gallery.uploadToken}`;
  const [photos, messages, rsvps, qrCodeDataUrl] = await Promise.all([
    getGalleryPhotosForOrganizer(gallery.id),
    def.allowGuestbook ? getGalleryMessagesForOrganizer(gallery.id) : Promise.resolve([]),
    gallery.tier === "premium" ? getGalleryRsvps(gallery.id) : Promise.resolve([]),
    generateQrCodeDataUrl(galleryUrl),
  ]);
  const pendingPhotos = photos.filter((p) => p.moderationStatus === "pending");
  const decidedPhotos = photos.filter((p) => p.moderationStatus !== "pending");
  const pendingMessages = messages.filter((m) => m.moderationStatus === "pending");
  const decidedMessages = messages.filter((m) => m.moderationStatus !== "pending");
  const confirmedGuestCount = rsvps.filter((r) => r.status === "yes").reduce((sum, r) => sum + r.guestCount, 0);

  return (
    <div className="space-y-8">
      {purchaseSuccess && <div className="rounded-xl bg-success-50 px-4 py-2.5 text-sm text-success">Gastenfoto-pagina geactiveerd — deel de link hieronder met je gasten.</div>}

      <Card className="bg-ink text-paper">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
              <Sparkles className="motion-icon-twinkle size-3.5" /> {def.label}-pakket actief
            </div>
            <h1 className="font-display text-2xl">Gastenfoto-pagina voor {event.name}</h1>
            <p className="mt-1.5 text-sm text-white/70">
              Zichtbaar tot {gallery.expiresAt ? formatDateNL(gallery.expiresAt, { day: "numeric", month: "long", year: "numeric" }) : "onbekend"}.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-5">
              <CopyGalleryLinkButton uploadToken={gallery.uploadToken} />
            </div>
          </div>

          {qrCodeDataUrl && (
            <div className="shrink-0 rounded-2xl bg-white p-3 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeDataUrl} alt={`QR-code naar de gastenfoto-pagina van ${event.name}`} className="size-32 sm:size-36" />
              <p className="mt-1.5 text-[11px] font-medium text-ink-soft">Scan om foto&apos;s te delen</p>
            </div>
          )}
        </div>
      </Card>

      {gallery.tier === "premium" && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Mail className="size-4 text-ink-faint" />
            <h2 className="font-display text-lg text-ink">Uitnodiging</h2>
          </div>
          <p className="mb-4 text-sm text-ink-faint">
            Kies een stijl, vul je eigen tekst en foto in, en deel de uitnodiging als link of download &apos;m als PDF.
          </p>
          <InvitationEditor
            eventId={id}
            eventName={event.name}
            eventDate={event.date}
            eventStartTime={event.startTime}
            eventLocationLabel={event.locationLabel}
            initialTemplateKey={gallery.invitationTemplateKey}
            initialTitle={gallery.invitationTitle}
            initialWelcomeText={gallery.invitationWelcomeText}
            initialPhotoUrl={gallery.invitationPhotoUrl}
            initialPhotoPositionX={gallery.invitationPhotoPositionX}
            initialPhotoPositionY={gallery.invitationPhotoPositionY}
            shareUrl={invitationUrl}
          />
        </div>
      )}

      {gallery.tier === "premium" && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <UserCheck className="size-4 text-ink-faint" />
            <h2 className="font-display text-lg text-ink">Aanmeldingen</h2>
            {confirmedGuestCount > 0 && <Badge tone="success">{confirmedGuestCount} {confirmedGuestCount === 1 ? "persoon komt" : "personen komen"}</Badge>}
          </div>
          {rsvps.length === 0 ? (
            <p className="text-sm text-ink-faint">Nog geen aanmeldingen via de &quot;Bevestig komst&quot;-knop op je uitnodiging.</p>
          ) : (
            <div className="space-y-2.5">
              {rsvps.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {r.guestName}
                        {r.status !== "no" && r.guestCount > 1 && <span className="text-ink-faint"> (+{r.guestCount - 1})</span>}
                      </p>
                      {r.note && <p className="mt-1 text-sm text-ink-soft">{r.note}</p>}
                      <p className="mt-1 text-xs text-ink-faint">{formatDateNL(r.createdAt, { day: "numeric", month: "short" })}</p>
                    </div>
                    <Badge tone={RSVP_LABEL[r.status].tone}>{RSVP_LABEL[r.status].label}</Badge>
                  </div>
                  <div className="mt-3">
                    <form action={deleteGalleryRsvpAction.bind(null, id, r.id)}>
                      <SubmitButton iconOnly pendingLabel="…" className="chip-hover flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-ink-faint hover:bg-paper-dim hover:text-danger">
                        <Trash2 className="size-3.5" />
                      </SubmitButton>
                    </form>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Camera className="size-4 text-ink-faint" />
          <h2 className="font-display text-lg text-ink">Foto&apos;s{def.allowVideo ? " & video's" : ""}</h2>
          {pendingPhotos.length > 0 && <Badge tone="warning">{pendingPhotos.length} te beoordelen</Badge>}
        </div>
        {photos.length === 0 ? (
          <p className="text-sm text-ink-faint">Nog geen foto&apos;s geüpload. Zodra gasten de link gebruiken, verschijnen ze hier.</p>
        ) : (
          <div className="space-y-6">
            {pendingPhotos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {pendingPhotos.map((photo) => (
                  <GalleryPhotoCard key={photo.id} eventId={id} photo={photo} />
                ))}
              </div>
            )}
            {decidedPhotos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {decidedPhotos.map((photo) => (
                  <GalleryPhotoCard key={photo.id} eventId={id} photo={photo} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {def.allowGuestbook && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <MessageSquareText className="size-4 text-ink-faint" />
            <h2 className="font-display text-lg text-ink">Gastenboek</h2>
            {pendingMessages.length > 0 && <Badge tone="warning">{pendingMessages.length} te beoordelen</Badge>}
          </div>
          {messages.length === 0 ? (
            <p className="text-sm text-ink-faint">Nog geen berichten van gasten.</p>
          ) : (
            <div className="space-y-2.5">
              {[...pendingMessages, ...decidedMessages].map((message) => (
                <Card key={message.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-ink">{message.message}</p>
                      <p className="mt-1 text-xs text-ink-faint">
                        {message.guestName ?? "Anonieme gast"} · {formatDateNL(message.createdAt, { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <Badge tone={MODERATION_LABEL[message.moderationStatus].tone}>{MODERATION_LABEL[message.moderationStatus].label}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    {message.moderationStatus !== "approved" && (
                      <form action={moderateGalleryMessageAction.bind(null, id, message.id, "approved")}>
                        <SubmitButton pendingLabel="…" className="chip-hover flex items-center gap-1 rounded-full bg-success-50 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/10">
                          <Check className="size-3.5" /> Goedkeuren
                        </SubmitButton>
                      </form>
                    )}
                    {message.moderationStatus !== "rejected" && (
                      <form action={moderateGalleryMessageAction.bind(null, id, message.id, "rejected")}>
                        <SubmitButton pendingLabel="…" className="chip-hover flex items-center gap-1 rounded-full bg-danger-50 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10">
                          <X className="size-3.5" /> Afkeuren
                        </SubmitButton>
                      </form>
                    )}
                    <form action={deleteGalleryMessageAction.bind(null, id, message.id)}>
                      <SubmitButton iconOnly pendingLabel="…" className="chip-hover flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-ink-faint hover:bg-paper-dim hover:text-danger">
                        <Trash2 className="size-3.5" />
                      </SubmitButton>
                    </form>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GalleryPhotoCard({ eventId, photo }: { eventId: string; photo: { id: string; publicUrl: string; storagePath: string; isVideo: boolean; guestName: string | null; moderationStatus: string } }) {
  const status = MODERATION_LABEL[photo.moderationStatus];
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-paper-dim">
      {photo.isVideo ? (
        <video src={photo.publicUrl} className="size-full object-cover" muted />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.publicUrl} alt={photo.guestName ? `Foto van ${photo.guestName}` : "Gastenfoto"} className="size-full object-cover" />
      )}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-1.5">
        <Badge tone={status.tone} className="bg-white/90">{status.label}</Badge>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        {photo.moderationStatus !== "approved" && (
          <form action={moderateGalleryPhotoAction.bind(null, eventId, photo.id, "approved")}>
            <SubmitButton iconOnly pendingLabel="…" className="flex size-7 items-center justify-center rounded-full bg-white/90 text-success hover:bg-white">
              <Check className="size-3.5" />
            </SubmitButton>
          </form>
        )}
        {photo.moderationStatus !== "rejected" && (
          <form action={moderateGalleryPhotoAction.bind(null, eventId, photo.id, "rejected")}>
            <SubmitButton iconOnly pendingLabel="…" className="flex size-7 items-center justify-center rounded-full bg-white/90 text-danger hover:bg-white">
              <X className="size-3.5" />
            </SubmitButton>
          </form>
        )}
        <form action={deleteGalleryPhotoAction.bind(null, eventId, photo.id, photo.storagePath)}>
          <SubmitButton iconOnly pendingLabel="…" className="flex size-7 items-center justify-center rounded-full bg-white/90 text-ink-soft hover:bg-white hover:text-danger">
            <Trash2 className="size-3.5" />
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
