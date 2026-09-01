import { notFound } from "next/navigation";
import { getGalleryMessagesPublic, getGalleryPhotosPublic, getGalleryPublic } from "@/lib/data/store";
import { Logo } from "@/components/marketing/Logo";
import { GalleryQuickActions } from "@/components/app/GalleryQuickActions";
import { GalleryPhotoGrid } from "@/components/app/GalleryPhotoGrid";
import { formatDateNL } from "@/lib/utils";
import { CalendarDays, Camera, ImageOff, MessageSquareText } from "lucide-react";

export const metadata = { title: "Gastenfoto's — Vyra" };

export default async function PublicGalleryPage(props: PageProps<"/gallery/[token]">) {
  const { token } = await props.params;
  const gallery = await getGalleryPublic(token);
  if (!gallery) notFound();

  if (gallery.status !== "active") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-dim px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="mb-8 flex justify-center"><Logo /></div>
          <div className="rounded-2xl border border-line bg-white p-8 [box-shadow:var(--shadow-card)]">
            <ImageOff className="mx-auto size-8 text-ink-faint" />
            <h1 className="mt-4 font-display text-xl text-ink">Deze pagina is niet meer actief</h1>
            <p className="mt-2 text-sm text-ink-soft">De bewaartermijn van deze gastenfoto-pagina is voorbij.</p>
          </div>
        </div>
      </div>
    );
  }

  const [photos, messages] = await Promise.all([
    getGalleryPhotosPublic(token),
    gallery.allowGuestbook ? getGalleryMessagesPublic(token) : Promise.resolve([]),
  ]);

  const guestbookAvatarTint = ["bg-clay-50 text-clay-dark", "bg-sage-50 text-sage-dark", "bg-warning-50 text-warning"];

  return (
    <div className="min-h-screen bg-paper-dim pb-16">
      {/* Feestelijke kopband — bewust de merkkleuren (clay/sage) i.p.v. een generieke gradient, zodat dit nog steeds als Vyra voelt. */}
      <div className="relative overflow-hidden bg-gradient-to-br from-clay-50 via-paper to-sage-50 px-4 pb-10 pt-8 sm:px-6 sm:pt-10">
        <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-clay/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full bg-sage/10 blur-2xl" />

        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-6 flex justify-center"><Logo /></div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-wide text-clay-dark ring-1 ring-clay/20">
            <Camera className="size-3.5" /> Gastenfoto&apos;s
          </span>
          <h1 className="mt-3 text-balance font-display text-3xl text-ink sm:text-4xl">
            {gallery.eventName}
            {gallery.organizerFirstName && <span className="text-ink-soft"> van {gallery.organizerFirstName}</span>}
          </h1>
          {gallery.eventDate && (
            <div className="mt-2 flex items-center justify-center gap-2 text-sm text-ink-soft">
              <CalendarDays className="size-4 text-ink-faint" /> {formatDateNL(gallery.eventDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          )}
          <p className="mx-auto mt-4 max-w-md text-sm text-ink-soft">
            Deel je mooiste kiekjes van dit feest — na een korte controle staan ze hier voor iedereen, zolang deze pagina online blijft.
          </p>
        </div>
      </div>

      <div className="mx-auto -mt-4 max-w-3xl px-4 sm:px-6">
        <GalleryQuickActions uploadToken={token} allowVideo={gallery.allowVideo} allowGuestbook={gallery.allowGuestbook} maxUploadMb={gallery.maxUploadMb} />

        {photos.length > 0 ? (
          <div className="mt-10">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-lg text-ink">De collage</h2>
              <span className="text-xs text-ink-faint">{photos.length === 1 ? "1 foto" : `${photos.length} foto's`}</span>
            </div>
            <GalleryPhotoGrid photos={photos} />
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-line bg-white/60 px-6 py-10 text-center">
            <ImageOff className="mx-auto size-6 text-ink-faint" />
            <p className="mt-3 text-sm text-ink-soft">Hier verschijnt de collage zodra de eerste foto&apos;s zijn goedgekeurd. Wees de eerste!</p>
          </div>
        )}

        {gallery.allowGuestbook && (
          <div className="mt-10">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquareText className="size-4 text-ink-faint" />
              <h2 className="font-display text-lg text-ink">Gastenboek</h2>
            </div>
            {messages.length === 0 && <p className="mb-4 text-sm text-ink-faint">Nog geen berichtjes — wees de eerste met het knopje hierboven.</p>}
            {messages.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {messages.map((message, i) => (
                  <div key={message.id} className="rounded-2xl border border-line-soft bg-white p-4 [box-shadow:var(--shadow-card)]">
                    <p className="text-sm leading-relaxed text-ink">{message.message}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${guestbookAvatarTint[i % guestbookAvatarTint.length]}`}>
                        {(message.guestName ?? "?").trim().charAt(0).toUpperCase()}
                      </span>
                      <p className="text-xs text-ink-faint">{message.guestName ?? "Anoniem"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
