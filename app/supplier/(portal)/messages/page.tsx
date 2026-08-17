import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMessages, getSupplierAccountByOwner, getSupplierLeads } from "@/lib/data/store";
import { EmptyState } from "@/components/ui/EmptyState";
import { SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { MessageSquare } from "lucide-react";

export const metadata = { title: "Berichten — Vyra voor leveranciers" };

export default async function SupplierMessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) redirect("/supplier/onboarding");

  const leads = await getSupplierLeads(supplier.id);

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="size-6" />}
        title="Nog geen gesprekken"
        description="Zodra een organisator een aanvraag naar je stuurt, kun je hier met ze chatten."
      />
    );
  }

  const threads = await Promise.all(
    leads.map(async (lead) => ({ lead, messages: await getMessages(lead.event.id, lead.request.categoryKey, supplier.id) }))
  );

  // Gesprekken met de recentste activiteit bovenaan; nog-niet-begonnen gesprekken onderaan.
  threads.sort((a, b) => {
    const at = a.messages[a.messages.length - 1]?.createdAt ?? "";
    const bt = b.messages[b.messages.length - 1]?.createdAt ?? "";
    return bt.localeCompare(at);
  });

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-ink">Berichten</h1>
      <p className="mb-6 text-sm text-ink-faint">Gesprekken met organisatoren, per aanvraag.</p>

      <div className="divide-y divide-line-soft rounded-2xl border border-line bg-white">
        {threads.map(({ lead, messages }) => {
          const last = messages[messages.length - 1];
          return (
            <Link
              key={lead.request.id}
              href={`/supplier/messages/${lead.request.id}`}
              className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-paper-dim"
            >
              <div className="min-w-0">
                <p className="font-medium text-ink">{lead.event.name}</p>
                <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-ink-faint">{SUPPLIER_CATEGORY_LABELS[lead.request.categoryKey]}</p>
                <p className="mt-0.5 line-clamp-1 text-sm text-ink-faint">{last ? last.text : "Nog geen berichten — stuur zelf het eerste bericht."}</p>
              </div>
              {messages.length > 0 && <span className="shrink-0 text-xs text-ink-faint">{messages.length} bericht{messages.length !== 1 ? "en" : ""}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
