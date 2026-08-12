import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent, getMessages, getRequestsForEvent, getRequirements } from "@/lib/data/store";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageSquare } from "lucide-react";

export default async function MessagesOverviewPage(props: PageProps<"/events/[id]/messages">) {
  const { id } = await props.params;
  const event = getEvent(id);
  if (!event) notFound();

  const requests = getRequestsForEvent(id);
  const requirements = getRequirements(id);

  if (requests.length === 0) {
    return <EmptyState icon={<MessageSquare className="size-6" />} title="Nog geen gesprekken" description="Zodra je een aanvraag verstuurt naar leveranciers, kun je hier met ze chatten." />;
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-ink">Berichten</h1>
      <p className="mb-6 text-sm text-ink-faint">Gesprekken met leveranciers, per categorie.</p>

      <div className="divide-y divide-line-soft rounded-2xl border border-line bg-white">
        {requests.map((req) => {
          const messages = getMessages(id, req.categoryKey);
          const label = requirements.find((r) => r.categoryKey === req.categoryKey)?.label ?? req.categoryKey;
          const last = messages[messages.length - 1];
          return (
            <Link key={req.id} href={`/events/${id}/messages/${req.categoryKey}`} className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-paper-dim">
              <div>
                <p className="font-medium text-ink">{label}</p>
                <p className="mt-0.5 line-clamp-1 text-sm text-ink-faint">{last ? last.text : "Nog geen berichten"}</p>
              </div>
              {messages.length > 0 && <span className="text-xs text-ink-faint">{messages.length} bericht{messages.length !== 1 ? "en" : ""}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
