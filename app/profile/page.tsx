import Link from "next/link";
import { redirect } from "next/navigation";
import { AppTopBar } from "@/components/app/AppTopBar";
import { PrivacyDataSection } from "@/components/app/PrivacyDataSection";
import { ReferralSection } from "@/components/app/ReferralSection";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Form";
import { UserAvatar } from "@/components/ui/Avatar";
import { getCurrentUser } from "@/lib/auth";
import { countReferrals, getPendingAccountDeletionRequest, getSupplierAccountByOwner, listEventsForUser } from "@/lib/data/store";
import { updateProfileAction, updateRoleAction, logoutAction } from "@/lib/actions/auth-actions";
import { SITE_URL } from "@/lib/config";
import { USER_ROLE_LABELS } from "@/lib/types";

export const metadata = { title: "Profiel — Vyra" };

export default async function ProfilePage(props: PageProps<"/profile">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const searchParams = await props.searchParams;
  const [events, supplier, pendingDeletionRequest, referralCount] = await Promise.all([
    listEventsForUser(user.id),
    getSupplierAccountByOwner(user.id),
    getPendingAccountDeletionRequest(user.id),
    countReferrals(user.id),
  ]);
  const errorCode = typeof searchParams.error === "string" ? searchParams.error : undefined;

  return (
    <div className="min-h-screen bg-paper">
      <AppTopBar />
      {/* md:pl-[var(--nav-sidebar-w)]: ruimte voor de permanente zijbalk, zie app/globals.css. */}
      <div className="transition-[padding-left] duration-200 ease-in-out md:pl-[var(--nav-sidebar-w)]">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-6 flex items-center gap-4">
          <UserAvatar firstName={user.firstName} lastName={user.lastName} color={user.avatarColor} size={56} />
          <div>
            <h1 className="font-display text-2xl text-ink">{user.firstName} {user.lastName}</h1>
            <p className="text-sm text-ink-faint">{user.email}</p>
          </div>
        </div>

        {searchParams.saved && (
          <div className="mb-4 rounded-xl bg-success-50 px-4 py-2.5 text-sm text-success">Je profiel is bijgewerkt.</div>
        )}

        <Card>
          <h2 className="mb-4 font-display text-lg text-ink">Persoonlijke gegevens</h2>
          <form action={updateProfileAction} className="space-y-4">
            <input type="hidden" name="userId" value={user.id} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Voornaam"><Input name="firstName" defaultValue={user.firstName} /></Field>
              <Field label="Achternaam"><Input name="lastName" defaultValue={user.lastName} /></Field>
            </div>
            <Field label="E-mailadres">
              <Input value={user.email} disabled className="opacity-60" />
            </Field>
            <Field label="Land">
              <Select name="country" defaultValue={user.country}>
                <option value="NL">Nederland</option>
                <option value="BE">België</option>
                <option value="DE">Duitsland</option>
                <option value="FR">Frankrijk</option>
                <option value="GB">Verenigd Koninkrijk</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Voorkeurstaal">
                <Select name="language" defaultValue={user.language}>
                  <option value="nl">Nederlands</option>
                  <option value="en">English</option>
                </Select>
              </Field>
              <Field label="Valuta">
                <Select name="currency" defaultValue={user.currency}>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                </Select>
              </Field>
            </div>
            <button type="submit" className="lift-hover rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink/90">
              Wijzigingen opslaan
            </button>
          </form>
        </Card>

        <Card className="mt-6">
          <h2 className="mb-2 font-display text-lg text-ink">Account</h2>
          <p className="text-sm text-ink-soft">{events.length} evenement{events.length !== 1 ? "en" : ""} · {USER_ROLE_LABELS[user.role]}-account (gratis)</p>
          <p className="mt-1 text-xs text-ink-faint">Een account aanmaken en evenementen plannen is altijd gratis — ook bij het boeken van een leverancier betaal je precies de prijs die de leverancier je biedt, zonder platformkosten of opslag.</p>
          <div className="mt-4 flex gap-3">
            <form action={logoutAction}>
              <button type="submit" className="lift-hover rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:bg-paper-dim">
                Uitloggen
              </button>
            </form>
          </div>
        </Card>

        <Card className="mt-6">
          <h2 className="mb-1 font-display text-lg text-ink">Wat voor account heb je?</h2>
          <p className="mb-4 text-xs text-ink-faint">
            Bepaalt alleen hoe we je noemen en waar je na het inloggen terechtkomt. Een leveranciersprofiel zelf (bedrijfsgegevens, diensten) regel je apart via{" "}
            {supplier ? <Link href="/supplier/profile" className="font-medium text-sage hover:underline">je leveranciersprofiel</Link> : <Link href="/supplier/onboarding" className="font-medium text-sage hover:underline">leverancier worden</Link>}.
          </p>

          {errorCode === "role" && (
            <div className="mb-4 rounded-xl bg-danger-50 px-4 py-2.5 text-sm text-danger">Kies minstens één van de twee opties.</div>
          )}
          {errorCode === "role-save-failed" && (
            <div className="mb-4 rounded-xl bg-danger-50 px-4 py-2.5 text-sm text-danger">
              Het opslaan van je rol is niet gelukt. Probeer het nog eens, of neem contact op als dit blijft gebeuren.
            </div>
          )}

          <form action={updateRoleAction} className="space-y-3">
            <label className="flex items-start gap-3 rounded-xl border border-line-soft px-4 py-3 has-[:checked]:border-sage has-[:checked]:bg-sage-50">
              <input type="checkbox" name="asOrganizer" defaultChecked={user.role === "customer" || user.role === "both"} className="mt-0.5 size-4 accent-sage" />
              <span>
                <span className="block text-sm font-medium text-ink">Organisator</span>
                <span className="block text-xs text-ink-faint">Ik plan (of heb gepland) een evenement via Vyra.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-line-soft px-4 py-3 has-[:checked]:border-sage has-[:checked]:bg-sage-50">
              <input type="checkbox" name="asSupplier" defaultChecked={user.role === "supplier" || user.role === "both"} className="mt-0.5 size-4 accent-sage" />
              <span>
                <span className="block text-sm font-medium text-ink">Leverancier</span>
                <span className="block text-xs text-ink-faint">Ik bied diensten of producten aan via Vyra.</span>
              </span>
            </label>
            <button type="submit" className="lift-hover rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink/90">
              Opslaan
            </button>
          </form>
        </Card>

        <Card className="mt-6">
          <h2 className="mb-1 font-display text-lg text-ink">Nodig anderen uit</h2>
          <ReferralSection referralUrl={`${SITE_URL}/signup?ref=${user.id}`} referralCount={referralCount} showSpotlightNote={Boolean(supplier)} />
        </Card>

        <div className="mt-6">
          <PrivacyDataSection pendingDeletionRequest={pendingDeletionRequest} />
        </div>
      </div>
      </div>
    </div>
  );
}
