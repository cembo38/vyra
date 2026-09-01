-- ─────────────────────────────────────────────────────────────
-- Vyra — Fix: gast kan geen foto uploaden op de gastenfoto-pagina
-- (sep. 2026, vervolg op migratie 0052)
--
-- OORZAAK: de INSERT-policy "gallery-media: gast uploadt via geldig token"
-- (storage.objects, migratie 0052) doet in zijn WITH CHECK een
-- rechtstreekse subquery op event_galleries:
--
--   exists (select 1 from event_galleries g where g.upload_token = ... )
--
-- Die subquery draait met de rechten van de aanroepende rol (anon — een
-- gast is per definitie niet ingelogd). event_galleries heeft echter Row
-- Level Security aan staan met ALLEEN een eigenaar-policy
-- (e.owner_id = auth.uid()). Voor de anonieme rol levert die subquery dus
-- ALTIJD nul rijen op, ongeacht of het upload_token geldig en de pagina
-- actief is — de upload-policy weigert daardoor stelselmatig elke gast-
-- upload. Dit is exact de reden waarom get_gallery_public/
-- submit_gallery_photo/submit_gallery_message hierboven als SECURITY
-- DEFINER zijn gebouwd (zie de toelichting in 0052) — alleen deze ene
-- storage-policy miste nog diezelfde bypass.
--
-- FIX: een smalle SECURITY DEFINER-functie die exact dezelfde check doet,
-- maar de RLS van event_galleries omzeilt (net als de bestaande publieke
-- functies) — de storage-policy roept die functie aan in plaats van de
-- tabel rechtstreeks te bevragen.
--
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
-- ─────────────────────────────────────────────────────────────

create or replace function public.gallery_upload_allowed(p_folder text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  -- storage.foldername(name) geeft de mapnaam als tekst; is dat om wat voor
  -- reden dan ook geen geldige uuid (bv. een geknoeid pad), dan is de
  -- upload sowieso niet toegestaan — geen fout laten opborrelen, gewoon
  -- weigeren.
  begin
    v_token := p_folder::uuid;
  exception when others then
    return false;
  end;

  return exists (
    select 1 from event_galleries g
    where g.upload_token = v_token
      and g.status = 'active'
      and (g.expires_at is null or g.expires_at >= current_date)
  );
end;
$$;
grant execute on function public.gallery_upload_allowed(text) to anon, authenticated;

drop policy if exists "gallery-media: gast uploadt via geldig token" on storage.objects;

create policy "gallery-media: gast uploadt via geldig token" on storage.objects for insert
  with check (
    bucket_id = 'gallery-media'
    and public.gallery_upload_allowed((storage.foldername(name))[1])
  );
