-- ─────────────────────────────────────────────────────────────
-- Vyra — Rolkeuze bij registreren daadwerkelijk laten landen, en
-- zelfbediening om die rol later via het profiel te wijzigen.
--
-- BUG die dit fixt: `handle_new_user()` (migratie 0001) las nooit de
-- `role` uit `raw_user_meta_data` — elk nieuw account kreeg dus altijd
-- stilzwijgend de kolomdefault 'customer', ongeacht wat iemand bij
-- /signup aanvinkte (organisator/leverancier/allebei). Daardoor toonde
-- het admin-dashboard (Gebruikers) voor iedereen altijd "Organisator",
-- en stuurde de na-login-redirect leveranciers altijd naar /events i.p.v.
-- hun leveranciersportaal.
--
-- Twee wijzigingen:
-- 1. De `role`-check-constraint stond 'both' nog niet toe, terwijl
--    lib/types.ts (UserRole) en de signup-logica ("organisator + ook
--    leverancier") dat allebei al wel als geldige waarde behandelen —
--    zonder deze verruiming zou elke poging om 'both' op te slaan
--    hoe dan ook op de database-constraint stuklopen.
-- 2. `handle_new_user()` leest nu wél `raw_user_meta_data->>'role'`,
--    met een whitelist tegen 'customer'/'supplier'/'both' (nooit
--    'admin' — dat blijft uitsluitend via ADMIN_EMAILS lopen, zie
--    lib/config.ts, en heeft niets met deze kolom te maken) en een
--    veilige terugval op 'customer' bij een onbekende/ontbrekende
--    waarde.
-- ─────────────────────────────────────────────────────────────

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('customer', 'supplier', 'both', 'admin'));

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    case new.raw_user_meta_data->>'role'
      when 'supplier' then 'supplier'
      when 'both' then 'both'
      else 'customer'
    end
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- De trigger zelf (on_auth_user_created) hoeft niet opnieuw aangemaakt te
-- worden — die verwijst naar de functie bij naam, dus `create or replace
-- function` hierboven is voldoende om het nieuwe gedrag te activeren.
