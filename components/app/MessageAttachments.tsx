import { FileText } from "lucide-react";
import { MessageAttachment } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Toont de bijlages (foto/pdf) van één bericht — gebruikt in zowel de
 * organisator- als leverancierskant van een gesprek (zie
 * app/events/[id]/messages/[category]/page.tsx en
 * app/supplier/(portal)/messages/[requestId]/page.tsx).
 *
 * `url` per bijlage is een tijdelijk ondertekende Supabase Storage-URL
 * (1 uur geldig, zie getMessages() in lib/data/store.ts) — bij een
 * verlopen link (bv. een heel oud gesprek dat lang open blijft staan in
 * een tabblad) is `url` gewoon nog steeds de laatst opgehaalde link; een
 * verse paginalading haalt automatisch een nieuwe op.
 */
export function MessageAttachments({ attachments, tone }: { attachments: MessageAttachment[]; tone: "light" | "dark" }) {
  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => a.mimeType.startsWith("image/"));
  const others = attachments.filter((a) => !a.mimeType.startsWith("image/"));

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((a) =>
            a.url ? (
              <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="img-zoom-wrap block size-20 overflow-hidden rounded-lg border border-line-soft/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.fileName} className="img-zoom h-full w-full object-cover" />
              </a>
            ) : (
              <div key={a.id} className="flex size-20 items-center justify-center rounded-lg border border-dashed border-line-soft/50 text-[10px] text-ink-faint">
                Niet meer beschikbaar
              </div>
            )
          )}
        </div>
      )}
      {others.map((a) =>
        a.url ? (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium underline-offset-2 hover:underline",
              tone === "dark" ? "border-paper/25 text-paper" : "border-line-soft text-ink"
            )}
          >
            <FileText className="size-3.5 shrink-0" />
            <span className="max-w-[10rem] truncate">{a.fileName}</span>
          </a>
        ) : (
          <span key={a.id} className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs", tone === "dark" ? "border-paper/25 text-paper/70" : "border-line-soft text-ink-faint")}>
            <FileText className="size-3.5 shrink-0" /> {a.fileName} (niet meer beschikbaar)
          </span>
        )
      )}
    </div>
  );
}
