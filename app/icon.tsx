import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Genereert het tabblad-icoon (favicon) op basis van dezelfde "V"-merkbadge
 * als <Logo>/<LogoMark> in components/marketing/Logo.tsx: een afgeronde,
 * donkere ("ink") badge met een cursieve Fraunces "V" in de papierkleur.
 * Zo blijft het tabblad-icoon automatisch in lijn met de huisstijl-tokens
 * in app/globals.css, zonder een los, met de hand bijgehouden .ico-bestand.
 *
 * Het lettertype-bestand in app/_assets is een build-time-vriendelijke
 * (ttf) omzetting van hetzelfde @fontsource-variable/fraunces-pakket dat de
 * site zelf gebruikt — de ImageResponse-renderer (satori) ondersteunt geen
 * woff2, vandaar deze losse kopie i.p.v. rechtstreeks uit node_modules lezen.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#24271a",
          borderRadius: 8,
        }}
      >
        <span
          style={{
            fontFamily: "Fraunces",
            fontStyle: "italic",
            fontSize: 22,
            color: "#fbf7ea",
            lineHeight: 1,
            transform: "translateY(-1px)",
          }}
        >
          V
        </span>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Fraunces",
          data: readFileSync(join(process.cwd(), "app/_assets/fraunces-italic.ttf")),
          style: "italic",
        },
      ],
    }
  );
}
