-- ─────────────────────────────────────────────────────────────
-- Vyra — admin kan gebruikers blokkeren
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
--
-- Voegt `banned_at`/`ban_reason` toe aan `profiles`, zodat een admin een
-- organisator- of leveranciersaccount kan blokkeren (bv. bij misbruik of
-- een geschil). `lib/auth.ts` logt zo iemand bij de eerstvolgende
-- serverside-check automatisch uit en stuurt naar /login met een
-- duidelijke melding — geen losse "is deze gebruiker geblokkeerd?"-check
-- nodig op elke pagina apart.
-- ─────────────────────────────────────────────────────────────

alter table profiles add column if not exists banned_at timestamptz;
alter table profiles add column if not exists ban_reason text;

-- Beveiliging: de bestaande policy "profiles: user updates own" staat elke
-- ingelogde gebruiker toe om willekeurige kolommen van zijn EIGEN rij te
-- updaten (RLS regelt rij-toegang, geen kolom-toegang). Zonder onderstaande
-- trigger zou een gebruiker dus in theorie zijn eigen `banned_at` kunnen
-- leegmaken (of zelfs `role` naar 'admin' zetten) door rechtstreeks de
-- Supabase-client aan te roepen — buiten de app-UI om. Deze trigger zet
-- die drie kolommen terug naar hun oude waarde tenzij de update via de
-- service-role-client komt (dat is precies wat `createSupabaseAdminClient()`
-- gebruikt, en alleen binnen /admin, ná de ADMIN_EMAILS-check).
create or replace function public.protect_admin_only_profile_columns()
returns trigger as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.banned_at := old.banned_at;
    new.ban_reason := old.ban_reason;
    new.role := old.role;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists profiles_protect_admin_columns on profiles;
create trigger profiles_protect_admin_columns
  before update on profiles
  for each row
  execute function public.protect_admin_only_profile_columns();
