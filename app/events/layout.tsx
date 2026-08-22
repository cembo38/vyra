import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppTopBar } from "@/components/app/AppTopBar";

export default async function EventsLayout({ children }: LayoutProps<"/events">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <AppTopBar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
