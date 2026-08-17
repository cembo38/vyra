import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppTopBar } from "@/components/app/AppTopBar";
import { SIDEBAR_OFFSET_CLASS } from "@/lib/nav-constants";
import { cn } from "@/lib/utils";

export default async function EventsLayout({ children }: LayoutProps<"/events">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className={cn("flex min-h-screen flex-col bg-paper", SIDEBAR_OFFSET_CLASS)}>
      <AppTopBar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
