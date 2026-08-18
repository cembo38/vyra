import { notFound, redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getMessages, getSupplierAccountByOwner, getSupplierLead } from "@/lib/data/store";
import { BackLink } from "@/components/ui/BackLink";
import { MessageComposer } from "@/components/app/MessageComposer";
import { RealtimeRefresh } from "@/components/app/RealtimeRefresh";
import { EVENT_TYPE_LABELS, SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { cn, formatDateNL } from "@/lib/utils";

export default async function SupplierMessageThreadPage(props: PageProps<"/supplier/messages/[requestId]">) {
  const { requestId } = await props.params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) redirect("/supplier/onboarding");

  const lead = await getSupplierLead(supplier.id, requestId);
  if (!lead) notFound();

  const messages = await getMessages(lead.event.id, lead.request.categoryKey, supplier.id);

  return (
    <div className="mx-auto max-w-2xl">
      <RealtimeRefresh
        table="messages"
        filter={`event_id=eq.${lead.event.id}`}
        guard={(payload) => {
          const row = (payload.new as Record<string, unknown>) ?? (payload.old as Record<string, unknown>);
          return row?.category_key === lead.request.categoryKey;
        }}
      />
      <BackLink fallbackHref="/supplier/messages" label="Alle gesprekken" className="mb-4" />

      <div className="mb-6">
        <h1 className="font-display text-xl text-ink">{lead.event.name}</h1>
        <p className="text-sm text-ink-faint">{EVENT_TYPE_LABELS[lead.event.type]} · {SUPPLIER_CATEGORY_LABELS[lead.request.categoryKey]}</p>
      </div>

      <div className="space-y-3">
        {messages.length === 0 && <p className="text-sm text-ink-faint">Nog geen berichten in dit gesprek — stuur hieronder het eerste bericht.</p>}
        {messages.map((m) => (
          <div key={m.id}>
            {m.sender === "ai_summary" ? (
              <div className="flex items-start gap-2 rounded-2xl bg-sage-50 px-4 py-3 text-sm text-sage-dark">
                <Sparkles className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="mb-0.5 text-xs font-medium uppercase tracking-wide">AI-samenvatting</p>
                  <p>{m.text}</p>
                </div>
              </div>
            ) : (
              // Gespiegeld t.o.v. de organisator-kant: hier staan de eigen
              // (leverancier-)berichten rechts, die van de organisator links.
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                  m.sender === "supplier" ? "ml-auto rounded-tr-sm bg-ink text-paper" : "rounded-tl-sm bg-paper-dim text-ink"
                )}
              >
                {m.text}
                <p className={cn("mt-1 text-[11px]", m.sender === "supplier" ? "text-paper/60" : "text-ink-faint")}>{formatDateNL(m.createdAt.slice(0, 10))}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 mt-6 border-t border-line-soft bg-paper pb-[max(var(--safe-b),0.75rem)] pt-3">
        <MessageComposer eventId={lead.event.id} categoryKey={lead.request.categoryKey} supplierId={supplier.id} sender="supplier" />
      </div>
    </div>
  );
}
