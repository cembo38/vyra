import type { Metadata } from "next";
import "./globals.css";

/**
 * Bewust GEEN next/font/google hier: dat vereist een netwerkverbinding met
 * fonts.googleapis.com tijdens `next dev`/`next build`, wat in afgesloten
 * omgevingen (CI, sandboxes zonder internet) de build laat falen. In plaats
 * daarvan gebruiken we een zorgvuldig gekozen system-font stack (zie
 * app/globals.css, --font-display / --font-sans) die overal werkt zonder
 * externe afhankelijkheid. Wil je een custom lettertype? Zelf-host het met
 * next/font/local voor dezelfde premium uitstraling zonder netwerkrisico.
 */

export const metadata: Metadata = {
  title: "Vyra — Celebrate. Simplified.",
  description:
    "Vertel wat je wilt organiseren. Onze AI ontdekt welke mensen, diensten en producten je nodig hebt, vraagt automatisch aanbiedingen aan en helpt je in enkele swipes de juiste leveranciers te kiezen.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
