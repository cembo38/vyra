import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { UserAvatar } from "@/components/ui/Avatar";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { NavShell, type NavShellItem } from "@/components/app/NavShell";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications, getSupplierAccountByOwner } from "@/lib/data/store";
import { Plus, Search, Store, CalendarHeart, Bell, Heart, HelpCircle } from "lucide-react";

export async function AppTopBar() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [notifications, supplier] = await Promise.all([getNotifications(user.id), getSupplierAccountByOwner(user.id)]);

  // "Leveranciersportaal"/"Ook leverancier worden?" stond eerder als los
  // item tussen deze navigatiepunten — voor iemand met beide rollen voelde
  // dat als twee werelden door elkaar in dezelfde lijst. Heeft iemand al
  // een echt leveranciersprofiel, dan wisselt hij/zij voortaan via het
  // aparte `roleSwitch`-knopje in NavShell; heeft iemand er nog geen, dan
  // blijft "leverancier worden" bereikbaar via `secondaryAction` — een
  // apart, groen-geaccentueerd punt onderaan het menu i.p.v. ertussenin.
  const items: NavShellItem[] = [
    { href: "/events", label: "Mijn evenementen", icon: <CalendarHeart className="size-5 shrink-0" /> },
    { href: "/leveranciers", label: "Leveranciers zoeken", icon: <Search className="size-5 shrink-0" /> },
    { href: "/mijn-leveranciers", label: "Mijn leveranciers", icon: <Heart className="size-5 shrink-0" /> },
    // Het belletje opende een uitklappaneel dat door een positioneringsbug
    // (deels) buiten beeld viel — zie NotificationsBell.tsx. Ook los daarvan
    // is een volwaardige pagina prettiger om oudere notificaties in terug te
    // vinden dan het korte paneel.
    { href: "/notifications", label: "Notificaties", icon: <Bell className="size-5 shrink-0" /> },
    // Cem (aug. 2026): "een volledig zoekbare FAQ / kennisbank... met een
    // ?-icoontje". Zie de toelichting bij hetzelfde item in
    // SupplierTopBar.tsx voor waarom dit onderaan de lijst staat.
    { href: "/help", label: "Help & FAQ", icon: <HelpCircle className="size-5 shrink-0" /> },
  ];

  return (
    <NavShell
      items={items}
      logo={<Logo />}
      menuLabel="Ontdek leveranciers"
      roleSwitch={supplier ? { active: "organizer", organizerHref: "/events", supplierHref: "/supplier/dashboard" } : undefined}
      secondaryAction={!supplier ? { href: "/supplier/onboarding", label: "Ook leverancier worden?", icon: <Store className="size-5 shrink-0" /> } : undefined}
      primaryAction={{ href: "/events/new", label: "Nieuw evenement", icon: <Plus className="size-4" /> }}
      search={{ action: "/leveranciers", name: "q", placeholder: "Zoek een leverancier of dienst..." }}
      utilityRight={
        <>
          {/* Alleen in de topbalk (>= md) zichtbaar — op de telefoon staat
              "Mijn leveranciers" al als gewoon menu-item in de drawer, een
              extra hartje in de krappe mobiele topstrook zou daar juist
              precies het "te veel/te grote knoppen"-gevoel terugbrengen
              dat de mobiele navigatie eerder juist moest oplossen. */}
          <Link
            href="/mijn-leveranciers"
            aria-label="Mijn leveranciers"
            className="icon-pop hidden size-11 items-center justify-center rounded-full text-ink-soft hover:bg-paper-dim hover:text-ink md:flex"
          >
            <Heart className="size-4.5" />
          </Link>
          <NotificationsBell userId={user.id} notifications={notifications} align="right" viewAllHref="/notifications" />
          <Link href="/profile" aria-label="Profiel" className="icon-pop inline-block rounded-full">
            <UserAvatar firstName={user.firstName || "?"} lastName={user.lastName} color={user.avatarColor} />
          </Link>
        </>
      }
      utilityLeft={
        <>
          {/* direction="up": deze knop zit onderaan de mobiele drawer-footer
              — het paneel moet dus omhoog openklappen, anders valt het
              (deels) buiten de viewport. Zie de toelichting bij `direction`
              in NotificationsBell.tsx. */}
          <NotificationsBell userId={user.id} notifications={notifications} align="left" direction="up" viewAllHref="/notifications" />
          <Link href="/profile" aria-label="Profiel" className="icon-pop inline-block rounded-full">
            <UserAvatar firstName={user.firstName || "?"} lastName={user.lastName} color={user.avatarColor} />
          </Link>
        </>
      }
    />
  );
}
