import { redirect } from "next/navigation";
import { AppTopBar } from "@/components/app/AppTopBar";
import { FaqPage } from "@/components/app/FaqPage";
import { getCurrentUser } from "@/lib/auth";
import { ORGANIZER_FAQ } from "@/lib/faq-content";

export const metadata = { title: "Help & FAQ — Vyra" };

const SUGGESTIONS = ["Hoe werkt het plannen van mijn evenement met AI?", "Hoe betaal ik een leverancier?", "Hoe vergelijk ik offertes?"];

export default async function OrganizerHelpPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-paper">
      <AppTopBar />
      {/* md:pl-[var(--nav-sidebar-w)]: ruimte voor de permanente zijbalk, zie app/globals.css. */}
      <div className="transition-[padding-left] duration-200 ease-in-out md:pl-[var(--nav-sidebar-w)]">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <FaqPage
            audience="organizer"
            title="Help & FAQ"
            intro="Alles wat je wilt weten over plannen, leveranciers en betalen op Vyra."
            categories={ORGANIZER_FAQ}
            suggestions={SUGGESTIONS}
          />
        </div>
      </div>
    </div>
  );
}
