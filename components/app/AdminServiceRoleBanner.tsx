import { AlertTriangle } from "lucide-react";

/**
 * Gedeelde waarschuwing, gebruikt op elke admin-subpagina die
 * platformbrede (dus service-role-vereisende) data toont — geëxtraheerd uit
 * het oorspronkelijke, ééndelige `app/admin/page.tsx` toen dat werd
 * opgesplitst in losse subroutes (spec-item #52 vervolg), zodat de tekst op
 * één plek staat i.p.v. op elke subpagina apart gedupliceerd te worden.
 */
export function AdminServiceRoleBanner() {
  return (
    <div className="mb-6 flex items-start gap-2.5 rounded-xl bg-ochre-50 px-4 py-3 text-sm text-ink">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-ochre" />
      <div>
        <p className="font-medium">Platformbrede weergave nog niet actief</p>
        <p className="mt-0.5 text-ink-soft">
          Zonder <code className="rounded bg-white/60 px-1 py-0.5 text-xs">SUPABASE_SERVICE_ROLE_KEY</code> in <code className="rounded bg-white/60 px-1 py-0.5 text-xs">.env.local</code> zie je
          hier alleen jouw eigen data. Te vinden via Supabase → Settings → API → &quot;service_role&quot;.
        </p>
      </div>
    </div>
  );
}
