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
