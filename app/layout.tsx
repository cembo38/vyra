import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * Bewust GEEN next/font/google hier: dat vereist een netwerkverbinding met
 * fonts.googleapis.com tijdens `next dev`/`next build`, wat in afgesloten
 * omgevingen (CI, sandboxes zonder internet) de build laat falen. In plaats
 * daarvan zelf-hosten we de lettertypes via `@fontsource-variable` — dat
 * zijn heel gewone npm-pakketten die de daadwerkelijke lettertypebestanden
 * meeleveren (opgehaald bij `npm install`, zoals elke andere dependency),
 * dus geen enkele netwerkaanroep meer nodig tijdens `next dev`/`next build`
 * zelf. Fraunces (kopregels) en Plus Jakarta Sans (de rest) zijn variabele
 * lettertypes — dat houdt dit ondanks twee lettertypefamilies licht: één
 * bestand per taalbereik dekt het hele gewicht- (en bij Fraunces ook
 * stijl-)bereik, i.p.v. een apart bestand per gewicht.
 */
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource-variable/plus-jakarta-sans";
import { SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
  // Nodig zodat relatieve URL's in metadata (bv. Open Graph-afbeeldingen)
  // correct worden omgezet naar absolute URL's — zonder dit geeft Next.js
  // hier een waarschuwing over. Ook gebruikt door app/sitemap.ts en
  // app/robots.ts (spec-item #49) voor dezelfde canonieke site-URL.
  metadataBase: new URL(SITE_URL),
  title: "Vyra — Celebrate. Simplified.",
  description:
    "Vertel wat je wilt organiseren. Onze AI ontdekt welke mensen, diensten en producten je nodig hebt, vraagt automatisch aanbiedingen aan en helpt je in enkele swipes de juiste leveranciers te kiezen.",
};

/**
 * Expliciete viewport-configuratie i.p.v. op Next.js' impliciete default te
 * vertrouwen — nodig voor twee mobiele dingen die anders stuk blijven:
 * `viewportFit: "cover"` activeert `env(safe-area-inset-*)` op iOS (zonder
 * dit blijven die altijd 0px, ongeacht de CSS die ernaar verwijst), en
 * `interactiveWidget: "resizes-content"` laat de layout-viewport écht
 * krimpen zodra het schermtoetsenbord opent, zodat "sticky bottom"-balken
 * (chatvensters) niet onder het toetsenbord verdwijnen. Bewust GEEN
 * `maximumScale`/`userScalable: false` — dat blokkeert pinch-zoom, een
 * WCAG 1.4.4-toegankelijkheidsprobleem, en is hier niet nodig.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f7f4ee" }],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
