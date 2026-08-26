import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getEvent, getMessages, getRequestsForEvent, resolveSupplierDisplay } from "@/lib/data/store";
import { SupplierAvatar } from "@/components/ui/Avatar";
import { BackLink } from "@/components/ui/BackLink";
import { MessageAttachments } from "@/components/app/MessageAttachments";
import { MessageComposer } from "@/components/app/MessageComposer";
import { RealtimeRefresh } from "@/components/app/RealtimeRefresh";
import { SUPPLIER_CATEGORY_LABELS, SupplierCategory } from "@/lib/types";
import { cn, formatDateNL } from "@/lib/utils";

export default async function MessageThreadPage(props: PageProps<"/events/[id]/messages/[category]">) {
  const { id, category } = await props.params;
  const event = await getEvent(id);
  if (!event) notFound();

  const categoryKey = category as SupplierCategory;
  const label = SUPPLIER_CATEGORY_LABELS[categoryKey];
  if (!label) notFound();

  const requests = await getRequestsForEvent(id);
  const request = requests.find((r) => r.categoryKey === categoryKey);
  const supplierId = request?.targetSupplierId ?? request?.supplierIds[0];
  const supplier = supplierId ? await resolveSupplierDisplay(supplierId) : null;
  const messages = await getMessages(id, categoryKey, supplierId);

  return (
    <div className="mx-auto max-w-2xl">
      <RealtimeRefresh
        table="messages"
        filter={`event_id=eq.${id}`}
        guard={(payload) => {
          const row = (payload.new as Record<string, unknown>) ?? (payload.old as Record<string, unknown>);
          return row?.category_key === categoryKey;
        }}
      />
      <BackLink fallbackHref={`/events/${id}/messages`} label="Alle gesprekken" className="mb-4" />

      <div className="mb-6 flex items-center gap-3">
        {supplier && <SupplierAvatar gradient={supplier.photoGradient} initials={supplier.initials} imageUrl={supplier.logoUrl} verified={supplier.verified} />}
        <div>
          <h1 className="font-display text-xl text-ink">{supplier?.companyName ?? label}</h1>
          <p className="text-sm text-ink-faint">{label}</p>
        </div>
      </div>

      <div className="space-y-3">
        {messages.length === 0 && <p className="text-sm text-ink-faint">Nog geen berichten in dit gesprek.</p>}
        {messages.map((m) => (
          <div key={m.id}>
            {m.sender === "ai_summary" ? (
              <div className="flex items-start gap-2 rounded-2xl bg-sage-50 px-4 py-3 text-sm text-sage-dark">
                <Sparkles className="motion-icon-twinkle mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="mb-0.5 text-xs font-medium uppercase tracking-wide">VyrAI-samenvatting</p>
                  <p>{m.text}</p>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                  m.sender === "customer" ? "ml-auto rounded-tr-sm bg-ink text-paper" : "rounded-tl-sm bg-paper-dim text-ink"
                )}
              >
                {m.text}
                <MessageAttachments attachments={m.attachments} tone={m.sender === "customer" ? "dark" : "light"} />
                <p className={cn("mt-1 text-[11px]", m.sender === "customer" ? "text-paper/60" : "text-ink-faint")}>{formatDateNL(m.createdAt.slice(0, 10))}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Vroeger een zwevende pil met marge (`bottom-6`) — die kon op mobiel
          onder de systeem-thuisbalk terechtkomen. Nu vlak tegen de onderkant
          aan, met een scheidingslijn en de veilige-zone-opvulling zodat hij
          nooit onder de home-indicator hangt. */}
      <div className="sticky bottom-0 mt-6 border-t border-line-soft bg-paper pb-[max(var(--safe-b),0.75rem)] pt-3">
        <MessageComposer eventId={id} categoryKey={categoryKey} supplierId={supplierId ?? ""} />
      </div>
    </div>
  );
}
