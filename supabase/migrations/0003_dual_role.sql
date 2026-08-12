-- ─────────────────────────────────────────────────────────────
-- Vyra — één account, meerdere rollen (migratie 3)
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run"
-- NADAT migraties 1 en 2 al zijn uitgevoerd.
--
-- Reden: iemand kan zowel organisator als leverancier willen zijn op
-- hetzelfde account. Dit voegt de waarde 'both' toe aan profiles.role,
-- zodat je bij het aanmelden "Organisator", "Leverancier" of allebei kunt
-- aanvinken. De rest van de app (welke pagina's je mag zien) hangt sowieso
-- al niet af van dit veld — dat wordt bepaald doordat je wel/niet een rij
-- in de `suppliers`-tabel hebt — dus dit is een kleine, veilige wijziging.
-- ─────────────────────────────────────────────────────────────

-- Verwijder de bestaande check-constraint op profiles.role, ongeacht de
-- automatisch gegenereerde naam, en voeg 'm opnieuw toe met 'both' erbij.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%in%'
  loop
    execute format('alter table public.profiles drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check check (role in ('customer', 'supplier', 'both', 'admin'));
