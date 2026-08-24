"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface SupplierMapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sub?: string;
  href?: string;
}

/** Voorkomt HTML-injectie via een leverancier-ingevulde bedrijfsnaam/locatie — Leaflet's bindPopup() interpreteert de meegegeven string als ruwe HTML. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Midden van Nederland — startpositie als er (nog) geen markers zijn.
const NL_CENTER: [number, number] = [52.1326, 5.2913];

/**
 * "Locatie op een kaart" (spec-item, Airbnb-geïnspireerd) — hand-gerolde
 * wrapper rond plain Leaflet (niet react-leaflet, om React 19/Next 16-
 * compatibiliteitsrisico te vermijden) met OpenStreetMap-tegels (gratis,
 * geen account nodig — net als de Nominatim-geocoding in lib/geo.ts).
 * Imperatief opgebouwd in useEffect omdat Leaflet bij het inladen al
 * `window`/`document` aanspreekt en dus niet server-side gerenderd mag
 * worden.
 */
export function SupplierMap({
  markers,
  /** Toont een cirkel (werk-/bezorggebied) rond de EERSTE marker — alleen zinvol bij precies 1 marker (individueel leveranciersprofiel). */
  radiusKm,
  height = "24rem",
  zoom,
  className,
}: {
  markers: SupplierMapMarker[];
  radiusKm?: number;
  height?: string;
  zoom?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bijdragers',
        maxZoom: 19,
      }).addTo(map);

      // Eigen pin-vorm i.p.v. Leaflet's standaardmarker — die verwijst naar
      // afbeeldingsbestanden op een relatief pad dat via een bundler niet
      // klopt, en dit sluit meteen beter aan bij de huisstijl (olijfgroen).
      const icon = L.divIcon({
        className: "",
        html:
          '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#6b7a4a;transform:rotate(-45deg);border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 26],
        popupAnchor: [0, -26],
      });

      if (markers.length === 0) {
        map.setView(NL_CENTER, zoom ?? 7);
      } else {
        markers.forEach((m) => {
          const marker = L.marker([m.lat, m.lng], { icon }).addTo(map!);
          const parts = [`<strong>${escapeHtml(m.label)}</strong>`];
          if (m.sub) parts.push(`<br/><span style="color:#6b6b5f">${escapeHtml(m.sub)}</span>`);
          if (m.href) parts.push(`<br/><a href="${m.href}" style="color:#6b7a4a">Bekijk profiel &rarr;</a>`);
          marker.bindPopup(parts.join(""));
        });

        if (radiusKm && markers[0]) {
          L.circle([markers[0].lat, markers[0].lng], {
            radius: radiusKm * 1000,
            color: "#6b7a4a",
            fillColor: "#6b7a4a",
            fillOpacity: 0.08,
            weight: 1.5,
          }).addTo(map);
        }

        if (markers.length === 1) {
          map.setView([markers[0].lat, markers[0].lng], zoom ?? (radiusKm ? 10 : 12));
        } else {
          const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
          map.fitBounds(bounds, { padding: [32, 32] });
        }
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [markers, radiusKm, zoom]);

  return <div ref={containerRef} className={className} style={{ height }} />;
}
