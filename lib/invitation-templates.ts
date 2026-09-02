/**
 * Deel C.5 — de 15 uitnodigingssjablonen die Cem eerder als visuele mockup
 * kreeg (vyra-uitnodigingssjablonen.html) en goedkeurde. Dit bestand is
 * puur data (welke sjablonen bestaan, hun CSS-klasse, categorie en een
 * korte "past bij"-omschrijving voor de kiezer) — de daadwerkelijke opmaak
 * per sjabloon staat in components/app/invitation-templates.css (bijna
 * letterlijk overgenomen uit de mockup) en de structuur per sjabloon in
 * components/app/InvitationCard.tsx.
 */
export interface InvitationTemplateDef {
  key: string;
  label: string;
  category: string;
  fit: string;
  /** CSS-klasse uit invitation-templates.css, bv. "t-klassiek". */
  className: string;
  /** Placeholder/standaardtekst voor het kleine "eyebrow"-regeltje boven de titel, als de organisator zelf nog niets heeft ingevuld. */
  defaultWelcomeText: string;
  /**
   * Tekst op de RSVP-knop. Sinds de "download als PDF"-functie (sep. 2026,
   * zie InvitationEditor.tsx) is dit bewust GEEN sfeervolle, aan-yes-
   * veronderstellende tekst meer (zoals eerder "Ik kom!" of "Bevestig
   * komst") — op de gedownloade PDF is de hele kaart klikbaar (een echte,
   * ingebakken hyperlink, geen QR-omweg), maar dat is voor een ontvanger
   * onzichtbaar. De knoptekst is daarmee het ENIGE zichtbare signaal dat
   * er iets te doen valt, dus moet hij expliciet uitnodigen om te
   * reageren — mét de mogelijkheid om af te zeggen, niet alleen te
   * bevestigen.
   */
  rsvpLabel: string;
}

export const INVITATION_TEMPLATE_CATEGORIES = ["Klassiek & verfijnd", "Speels & kleurrijk", "Rustig & natuurlijk", "Zakelijk & internationaal"] as const;

export const INVITATION_TEMPLATES: InvitationTemplateDef[] = [
  { key: "klassiek", label: "Klassiek Elegant", category: "Klassiek & verfijnd", fit: "Bruiloften, jubilea", className: "t-klassiek", defaultWelcomeText: "U bent van harte uitgenodigd", rsvpLabel: "Laat het weten" },
  { key: "vintage", label: "Warm & Vintage", category: "Klassiek & verfijnd", fit: "Mijlpaal-verjaardagen, reünies", className: "t-vintage", defaultWelcomeText: "", rsvpLabel: "Laat het weten" },
  { key: "chic", label: "Zwart-wit Chic", category: "Klassiek & verfijnd", fit: "Gala's, formele feesten", className: "t-chic", defaultWelcomeText: "Save the date", rsvpLabel: "Laat het weten" },
  { key: "fotolijst", label: "Fotolijst Klassiek", category: "Klassiek & verfijnd", fit: "Elk evenement — de foto staat centraal", className: "t-fotolijst", defaultWelcomeText: "", rsvpLabel: "Laat het weten" },

  { key: "speels", label: "Speels & Kleurrijk", category: "Speels & kleurrijk", fit: "Kinderfeestjes", className: "t-speels", defaultWelcomeText: "", rsvpLabel: "Kom je? Laat het weten" },
  { key: "neon", label: "Neon Nachtfeest", category: "Speels & kleurrijk", fit: "18/21/30-feesten, dansfeesten", className: "t-neon", defaultWelcomeText: "Feest!", rsvpLabel: "Kom je? Laat het weten" },
  { key: "retro", label: "Retro Jaren 70", category: "Speels & kleurrijk", fit: "Verjaardagen, reünies", className: "t-retro", defaultWelcomeText: "Groovy uitnodiging", rsvpLabel: "Laat het weten" },
  { key: "confetti", label: "Feestelijk Confetti", category: "Speels & kleurrijk", fit: "Diploma's, jubilea, pensioen", className: "t-confetti", defaultWelcomeText: "Gefeliciteerd!", rsvpLabel: "Kom je? Laat het weten" },

  { key: "botanisch", label: "Botanisch Minimalistisch", category: "Rustig & natuurlijk", fit: "Babyshowers, housewarmings", className: "t-botanisch", defaultWelcomeText: "", rsvpLabel: "Laat het weten" },
  { key: "scandi", label: "Scandinavisch Chic", category: "Rustig & natuurlijk", fit: "Housewarmings, doopfeesten", className: "t-scandi", defaultWelcomeText: "", rsvpLabel: "Laat het weten" },
  { key: "aquarel", label: "Aquarel Droom", category: "Rustig & natuurlijk", fit: "Verlovingen, bruidsshowers", className: "t-aquarel", defaultWelcomeText: "Save the date", rsvpLabel: "Laat het weten" },
  { key: "vyra", label: "Vyra Signature", category: "Rustig & natuurlijk", fit: "Elk evenement — sluit aan bij de huisstijl van het platform", className: "t-vyra", defaultWelcomeText: "", rsvpLabel: "Laat het weten" },

  { key: "zakelijk", label: "Modern Zakelijk", category: "Zakelijk & internationaal", fit: "Bedrijfsevents, netwerkborrels", className: "t-zakelijk", defaultWelcomeText: "Vyra nodigt uit", rsvpLabel: "Laat het weten" },
  { key: "zomer", label: "Zonnig Zomerfeest", category: "Zakelijk & internationaal", fit: "Tuinfeesten, BBQ's", className: "t-zomer", defaultWelcomeText: "", rsvpLabel: "Kom je? Laat het weten" },
  { key: "tropisch", label: "Tropisch Paradijs", category: "Zakelijk & internationaal", fit: "Destination weddings, zomerfeesten", className: "t-tropisch", defaultWelcomeText: "Destination wedding", rsvpLabel: "Laat het weten" },
];

export function getInvitationTemplate(key: string | null): InvitationTemplateDef | null {
  if (!key) return null;
  return INVITATION_TEMPLATES.find((t) => t.key === key) ?? null;
}

/**
 * De 15 sjablonen gebruiken samen 13 Google Fonts-families die nergens
 * anders in de app voorkomen (Fraunces en Plus Jakarta Sans zijn al
 * zelf-gehost via @fontsource, zie app/layout.tsx — die twee staan hier
 * dus bewust NIET in). Geladen via een gewone <link> (browser-runtime),
 * NIET via next/font/google — dat laatste vereist een netwerkverbinding
 * TIJDENS `next build`/`next dev` en breekt de build in afgesloten
 * omgevingen (zie de toelichting in app/layout.tsx). Een <link> in de
 * pagina zelf laadt pas als een echte browser de pagina bezoekt, dus dat
 * probleem speelt hier niet.
 */
export const INVITATION_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Baloo+2:wght@500;700;800&family=EB+Garamond:ital,wght@0,400;1,400;1,500&family=IBM+Plex+Sans:wght@400;500;600&family=Playfair+Display:ital,wght@0,700;0,900;1,500&family=Bodoni+Moda:wght@500;800;900&family=Fredoka:wght@500;600;700&family=Caveat:wght@500;600;700&family=Fjalla+One&family=DM+Sans:wght@400;500;700&family=Poppins:wght@500;600;700&family=Cormorant:ital,wght@1,500;1,600&family=Righteous&display=swap";
