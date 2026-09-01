"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { GalleryPhoto } from "@/lib/types";

/**
 * De collage-weergave van goedgekeurde gastenfoto's op de publieke
 * gastenfoto-pagina (`/gallery/[token]`) — Cem wilde iets dat aanvoelt als
 * een Instagram-collage (foto's in rijen van drie) waar je nog tijdenlang
 * op kunt terugkijken, in plaats van een kale lijst thumbnails. Dit
 * component voegt daar het "op terug kunnen kijken"-stuk aan toe: klik op
 * een foto en hij opent groot, met pijltjes/toetsenbord om door de hele
 * collage te bladeren — precies zoals je een Instagram-post zou openen.
 */
export function GalleryPhotoGrid({ photos }: { photos: GalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const showPrev = useCallback(() => setOpenIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length)), [photos.length]);
  const showNext = useCallback(() => setOpenIndex((i) => (i === null ? null : (i + 1) % photos.length)), [photos.length]);

  useEffect(() => {
    if (openIndex === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") showPrev();
      if (e.key === "ArrowRight") showNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [openIndex, close, showPrev, showNext]);

  const active = openIndex !== null ? photos[openIndex] : null;

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="group aspect-square overflow-hidden rounded-lg bg-white ring-1 ring-line transition-all duration-200 hover:z-10 hover:scale-[1.04] hover:[box-shadow:var(--shadow-pop)] sm:rounded-xl"
          >
            {photo.isVideo ? (
              <div className="relative size-full">
                <video src={photo.publicUrl} className="size-full object-cover" muted playsInline />
                <span className="absolute inset-0 flex items-center justify-center bg-ink/10 text-2xl text-white opacity-90 transition-opacity group-hover:opacity-100">▶</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.publicUrl}
                alt={photo.guestName ? `Foto van ${photo.guestName}` : "Gastenfoto"}
                className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                loading="lazy"
              />
            )}
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Sluiten"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <X className="size-5" />
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Vorige foto"
                onClick={(e) => {
                  e.stopPropagation();
                  showPrev();
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 sm:left-4"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Volgende foto"
                onClick={(e) => {
                  e.stopPropagation();
                  showNext();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 sm:right-4"
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          )}

          <div className="flex max-h-[85vh] max-w-3xl flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {active.isVideo ? (
              <video src={active.publicUrl} className="max-h-[75vh] max-w-full rounded-xl" controls autoPlay />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.publicUrl} alt={active.guestName ? `Foto van ${active.guestName}` : "Gastenfoto"} className="max-h-[75vh] max-w-full rounded-xl object-contain" />
            )}
            {active.guestName && <p className="mt-3 text-sm text-paper-dim">Gedeeld door {active.guestName}</p>}
          </div>
        </div>
      )}
    </>
  );
}
