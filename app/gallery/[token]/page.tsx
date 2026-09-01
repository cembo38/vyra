import { notFound } from "next/navigation";
import { getGalleryMessagesPublic, getGalleryPhotosPublic, getGalleryPublic } from "@/lib/data/store";
import { Logo } from "@/components/marketing/Logo";
import { GalleryUploadForm } from "@/components/app/GalleryUploadForm";
import { GalleryMessageForm } from "@/components/app/GalleryMessageForm";
import { formatDateNL } from "@/lib/utils";
import { CalendarDays, ImageOff, MessageSquareText } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-paper-dim px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex justify-center"><Logo /></div>

        <div className="rounded-2xl border border-line bg-white p-8 text-center [box-shadow:var(--shadow-card)]">
          <p className="text-sm text-ink-faint">Je bent uitgenodigd om foto&apos;s te delen van</p>
          <h1 className="mt-0.5 font-display text-2xl text-ink">{gallery.eventName}</h1>
          {gallery.eventDate && (
            <div className="mt-2 flex items-center justify-center gap-2 text-sm text-ink-soft">
              <CalendarDays className="size-4 text-ink-faint" /> {formatDateNL(gallery.eventDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          )}
          <p className="mt-3 text-sm text-ink-faint">Upload je mooiste kiekjes — na een korte controle staan ze hier voor iedereen.</p>
        </div>

        <div className="mt-6">
          <GalleryUploadForm uploadToken={token} allowVideo={gallery.allowVideo} maxUploadMb={gallery.maxUploadMb} />
        </div>

        {photos.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 font-display text-lg text-ink">Foto&apos;s van gasten</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo) => (
                <div key={photo.id} className="aspect-square overflow-hidden rounded-xl border border-line bg-white">
                  {photo.isVideo ? (
                    <video src={photo.publicUrl} className="size-full object-cover" controls />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.publicUrl} alt={photo.guestName ? `Foto van ${photo.guestName}` : "Gastenfoto"} className="size-full object-cover" loading="lazy" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {gallery.allowGuestbook && (
          <div className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquareText className="size-4 text-ink-faint" />
              <h2 className="font-display text-lg text-ink">Gastenboek</h2>
            </div>
            <div className="mb-4">
              <GalleryMessageForm uploadToken={token} />
            </div>
            {messages.length > 0 && (
              <div className="space-y-2.5">
                {messages.map((message) => (
                  <div key={message.id} className="rounded-xl border border-line-soft bg-white px-4 py-3">
                    <p className="text-sm text-ink">{message.message}</p>
                    <p className="mt-1 text-xs text-ink-faint">— {message.guestName ?? "Anoniem"}</p>
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
