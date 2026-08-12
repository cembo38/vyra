import { AppTopBar } from "@/components/app/AppTopBar";

export default function EventsLayout({ children }: LayoutProps<"/events">) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <AppTopBar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
