import { Card } from "@/components/ui/Card";
import { ADMIN_EMAILS } from "@/lib/config";
import { ShieldCheck, Users } from "lucide-react";

export const metadata = { title: "Instellingen — Vyra Admin" };

/**
 * Alleen-lezen (spec-item #52 vervolg): Cem noemde het kunnen geven van
 * adminrechten aan andere mensen expliciet "eventueel" — dus bewust nog
 * geen volledig rechtenbeheer bouwen, alleen laten zien wie er nu toegang
 * heeft en dat uitbreiding hiervan op de planning staat. `ADMIN_EMAILS`
 * wordt beheerd via een Vercel-omgevingsvariabele, niet via deze pagina —
 * dat voorkomt dat een verkeerde klik hier zichzelf per ongeluk buitensluit.
 */
export default function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Instellingen</h1>
      <p className="mt-1 text-ink-soft">Wie toegang heeft tot dit admin-dashboard, en wat er nog op de planning staat.</p>

      <div className="mt-8">
        <Card>
          <div className="mb-1 flex items-center gap-2">
            <ShieldCheck className="size-4.5 text-sage" />
            <h2 className="font-display text-lg text-ink">Toegang tot /admin</h2>
          </div>
          <p className="mb-4 text-xs text-ink-faint">
            Alleen deze e-mailadressen kunnen op <code className="rounded bg-paper-dim px-1 py-0.5 text-xs">/admin/login</code> inloggen. Beheerd via de{" "}
            <code className="rounded bg-paper-dim px-1 py-0.5 text-xs">ADMIN_EMAILS</code>-omgevingsvariabele in Vercel — hier alleen zichtbaar, niet aan te
            passen (zo kan een verkeerde klik hier je niet per ongeluk zelf buitensluiten).
          </p>
          <div className="space-y-2">
            {ADMIN_EMAILS.map((email) => (
              <div key={email} className="flex items-center gap-2 rounded-xl border border-line-soft px-3.5 py-2.5 text-sm">
                <Users className="size-4 shrink-0 text-ink-faint" />
                <span className="font-medium text-ink">{email}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <h2 className="font-display text-lg text-ink">Op de planning</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Andere mensen zelf, vanuit deze pagina, rechten geven — in plaats van via een omgevingsvariabele die alleen in Vercel is aan te passen — staat als
            vervolgstap op de planning, inclusief het kunnen instellen welke onderdelen iemand mag zien of aanpassen.
          </p>
        </Card>
      </div>
    </div>
  );
}
