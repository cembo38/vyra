import {
  Aperture,
  Armchair,
  Building2,
  Cake,
  Camera,
  ClipboardList,
  Disc3,
  Flower2,
  Guitar,
  Lightbulb,
  Mail,
  MonitorSpeaker,
  PartyPopper,
  Shield,
  Sparkles,
  SprayCan,
  Tent,
  Truck,
  Users,
  UtensilsCrossed,
  Video,
  type LucideIcon,
} from "lucide-react";
import { SupplierCategory } from "@/lib/types";

/**
 * Eén icoon per leverancierscategorie — puur presentationeel, geen database-
 * verandering. Gebruikt door CategoryIconBar.tsx (categorie-iconenbalk op
 * /leveranciers, geïnspireerd op Airbnb's doorschuifbare categorierij) en
 * eventueel later op andere plekken waar categorieën getoond worden.
 */
export const SUPPLIER_CATEGORY_ICONS: Record<SupplierCategory, LucideIcon> = {
  venue: Building2,
  catering: UtensilsCrossed,
  cake: Cake,
  florist: Flower2,
  decoration: Sparkles,
  dj_music: Disc3,
  band: Guitar,
  photography: Camera,
  videography: Video,
  furniture_rental: Armchair,
  lighting_sound: Lightbulb,
  cleaning: SprayCan,
  security: Shield,
  staffing: Users,
  transport: Truck,
  tent_rental: Tent,
  entertainment: PartyPopper,
  planner: ClipboardList,
  photobooth: Aperture,
  invitations: Mail,
  av_equipment: MonitorSpeaker,
};

/**
 * Cem (aug. 2026): "voeg gepaste emojis toe" — voor de categoriebalk op
 * /leveranciers (zie CategoryIconBar.tsx). Los van SUPPLIER_CATEGORY_ICONS
 * hierboven (de Lucide-iconen in de filter-zijbalk blijven ongewijzigd) —
 * een carrousel met 21 tikbare chips leest sneller met een emoji dan met
 * een dunne lijntekening op zo'n kleine schaal.
 */
export const SUPPLIER_CATEGORY_EMOJI: Record<SupplierCategory, string> = {
  venue: "🏛️",
  catering: "🍽️",
  cake: "🎂",
  florist: "💐",
  decoration: "🎈",
  dj_music: "🎧",
  band: "🎸",
  photography: "📷",
  videography: "🎥",
  furniture_rental: "🪑",
  lighting_sound: "💡",
  cleaning: "🧹",
  security: "🛡️",
  staffing: "🤵",
  transport: "🚐",
  tent_rental: "⛺",
  entertainment: "🎉",
  planner: "📋",
  photobooth: "🤳",
  invitations: "💌",
  av_equipment: "🎚️",
};
