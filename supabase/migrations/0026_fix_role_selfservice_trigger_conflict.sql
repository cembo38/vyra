-- ─────────────────────────────────────────────────────────────
-- Vyra — bugfix: rolwissel via /profile werd stilzwijgend genegeerd
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
--
-- BUG: migratie 0011 (admin kan gebruikers blokkeren) voegde een trigger
-- toe die op ELKE update van `profiles` de kolommen `banned_at`,
-- `ban_reason` én `role` terugzet naar hun oude waarde, tenzij de update
-- via de service-role-client komt (dus uitsluitend binnen /admin). Dat was
-- bedoeld om te voorkomen dat iemand zichzelf naar `role = 'admin'`
-- promoveert door rechtstreeks de Supabase-client aan te roepen.
--
-- Migratie 0023 voegde daarna `updateRoleAction` toe (het vinkje
-- "Organisator"/"Leverancier" op /profile, waarmee je zelf mag wisselen
-- tussen 'customer'/'supplier'/'both') — maar die actie loopt via de
-- gewone, NIET-service-role client. De trigger uit 0011 zette de nieuwe
-- rol dus bij elke opslag stilzwijgend terug naar de oude waarde: de
-- Supabase-update zelf gaf geen foutmelding (dus de pagina toonde gewoon
-- "opgeslagen"), maar de rol veranderde in de database nooit echt — het
-- vinkje sprong na een herlaadbeurt weer terug. In de praktijk gemeld als:
-- "ik vink Leverancier aan, ik sla op, en vervolgens verwijdert die de vink."
--
-- FIX: de trigger blokkeert voortaan alleen nog de gevaarlijke overgang
-- (een niet-service-role update die `role` naar 'admin' zet). Wisselen
-- tussen 'customer'/'supplier'/'both' — de enige waarden die
-- `updateRoleAction` ooit verstuurt — blijft daarmee gewoon toegestaan
-- voor de gebruiker zelf, terwijl zelfpromotie naar admin nog steeds is
-- geblokkeerd. `banned_at`/`ban_reason` blijven, zoals in 0011, altijd
-- admin-only.
-- ─────────────────────────────────────────────────────────────

create or replace function public.protect_admin_only_profile_columns()
returns trigger as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.banned_at := old.banned_at;
    new.ban_reason := old.ban_reason;
    if new.role = 'admin' and old.role is distinct from 'admin' then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- De trigger zelf (profiles_protect_admin_columns) hoeft niet opnieuw
-- aangemaakt te worden — die verwijst naar de functie bij naam, dus
-- `create or replace function` hierboven is voldoende om het nieuwe
-- gedrag te activeren.
