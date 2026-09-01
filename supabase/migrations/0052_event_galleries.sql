-- ─────────────────────────────────────────────────────────────
-- Vyra — Gastenfoto-pagina per evenement ("Deel C", sep. 2026)
--
-- Cems idee: een eigen, deelbare webpagina per evenement waar gasten via
-- een link/QR-code rechtstreeks foto's (en bij Premium video's) kunnen
-- uploaden — leuk voor de gasten, leuk om te blijven herinneren. Geen
-- hashtag-verzamelaar (onbetrouwbaar/onmogelijk zonder officiële
-- Instagram-API-toegang voor een klein platform als Vyra) — gasten
-- uploaden direct via de link. Eenmalig bedrag per evenement (geen
-- abonnement), drie niveaus (Basis €49 / Plus €79 / Premium €99) — zie
-- GALLERY_TIERS in lib/config.ts voor de precieze prijzen/perks per niveau,
-- die hier bewust NIET gedupliceerd worden (zelfde patroon als
-- SUBSCRIPTION_TIERS/suppliers.subscription_tier: de DB kent alleen het
-- gekozen niveau, de app-config bepaalt wat daarbij hoort).
--
-- Toegang voor gasten loopt volledig via het niet-raadbare `upload_token`
-- (in de link én de QR-code) — exact hetzelfde patroon als de bestaande
-- publieke RSVP-link (migratie 0006, get_guest_public/submit_rsvp): drie
-- smalle SECURITY DEFINER-functies i.p.v. de tabellen rechtstreeks open te
-- zetten voor anonieme bezoekers.
--
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
-- ─────────────────────────────────────────────────────────────

create table if not exists event_galleries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade unique,
  tier text not null check (tier in ('basis', 'plus', 'premium')),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'active', 'expired')),
  upload_token uuid not null default gen_random_uuid() unique,
  theme text,
  invitation_template_key text,
  price_cents integer not null,
  stripe_checkout_session_id text,
  -- Datum waarop de pagina wordt opgeruimd — bij activatie gezet op
  -- evenementdatum + retentionDays van het gekozen niveau (zie
  -- activateEventGalleryFromWebhook in lib/data/store.ts). `null` zolang
  -- nog niet betaald.
  expires_at date,
  purchased_at timestamptz,
  created_at timestamptz not null default now()
);
alter table event_galleries enable row level security;

create policy "event_galleries: owner full access" on event_galleries for all
  using (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()));

create index if not exists idx_event_galleries_event on event_galleries(event_id);

create table if not exists gallery_photos (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references event_galleries(id) on delete cascade,
  guest_name text,
  storage_path text not null,
  is_video boolean not null default false,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
alter table gallery_photos enable row level security;

-- Alleen de organisator (via event_galleries -> events) mag deze rijen
-- rechtstreeks lezen/beheren (bv. goed-/afkeuren, verwijderen). Gasten
-- komen hier NOOIT rechtstreeks bij — alleen via de SECURITY DEFINER
-- functies hieronder.
create policy "gallery_photos: owner full access" on gallery_photos for all
  using (exists (select 1 from event_galleries g join events e on e.id = g.event_id where g.id = gallery_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from event_galleries g join events e on e.id = g.event_id where g.id = gallery_id and e.owner_id = auth.uid()));

create index if not exists idx_gallery_photos_gallery on gallery_photos(gallery_id);

create table if not exists gallery_messages (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references event_galleries(id) on delete cascade,
  guest_name text,
  message text not null,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
alter table gallery_messages enable row level security;

create policy "gallery_messages: owner full access" on gallery_messages for all
  using (exists (select 1 from event_galleries g join events e on e.id = g.event_id where g.id = gallery_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from event_galleries g join events e on e.id = g.event_id where g.id = gallery_id and e.owner_id = auth.uid()));

create index if not exists idx_gallery_messages_gallery on gallery_messages(gallery_id);

-- ───────────── OPSLAGRUIMTE ─────────────
-- Publieke bucket (net als "supplier-media") — een foto is pas zichtbaar
-- voor gasten nadat de organisator 'm goedkeurt (moderation_status), maar
-- de BESTANDEN zelf staan qua opslag op hetzelfde "publiek + niet-raadbaar
-- pad"-niveau als supplier-media/reviewfoto's. Het pad-schema is bewust
-- `${upload_token}/...` (niet `${gallery_id}/...`): dat is precies de
-- waarde die de insert-policy hieronder kan controleren zonder dat een
-- anonieme gast ooit hoeft in te loggen.
insert into storage.buckets (id, name, public)
values ('gallery-media', 'gallery-media', true)
on conflict (id) do nothing;

create policy "gallery-media: publiek leesbaar" on storage.objects for select
  using (bucket_id = 'gallery-media');

-- Een gast is per definitie NIET ingelogd — deze policy staat een upload
-- toe voor IEDEREEN, maar alleen in een map die overeenkomt met het
-- upload_token van een actieve, nog niet verlopen gastenfoto-pagina. Dat is
-- de enige toegangscontrole (kennis van het token), zelfde uitgangspunt als
-- de publieke RSVP-link.
create policy "gallery-media: gast uploadt via geldig token" on storage.objects for insert
  with check (
    bucket_id = 'gallery-media'
    and exists (
      select 1 from event_galleries g
      where g.upload_token::text = (storage.foldername(name))[1]
        and g.status = 'active'
        and (g.expires_at is null or g.expires_at >= current_date)
    )
  );

-- De organisator mag bestanden van zijn eigen gastenfoto-pagina verwijderen
-- (bv. na het afkeuren van een foto in de moderatie-UI).
create policy "gallery-media: organisator verwijdert" on storage.objects for delete
  using (
    bucket_id = 'gallery-media'
    and exists (
      select 1 from event_galleries g join events e on e.id = g.event_id
      where g.upload_token::text = (storage.foldername(name))[1] and e.owner_id = auth.uid()
    )
  );

-- ───────────── PUBLIEKE GAST-FUNCTIES (zonder inloggen) ─────────────

create or replace function public.get_gallery_public(p_upload_token uuid)
returns table (
  event_name text,
  event_date date,
  tier text,
  theme text,
  status text,
  expires_at date
)
language sql
security definer
set search_path = public
as $$
  select e.name, e.date, g.tier, g.theme, g.status, g.expires_at
  from event_galleries g
  join events e on e.id = g.event_id
  where g.upload_token = p_upload_token
$$;
grant execute on function public.get_gallery_public(uuid) to anon, authenticated;

-- Let op: welke niveaus video mogen uploaden ('premium') en het
-- gastenboek mogen gebruiken (alles behalve 'basis') staat hieronder
-- bewust ALS EXTRA, server-side controle gedupliceerd t.o.v.
-- GALLERY_TIERS in lib/config.ts (de server action controleert dit ook al
-- vóórdat de upload zelfs maar begint) — verander je die regels ooit in
-- lib/config.ts, werk dan deze twee functies ook bij, anders kan een gast
-- die de actie omzeilt en deze functie rechtstreeks aanroept nog steeds
-- iets uploaden dat het gekochte niveau niet toestaat.
create or replace function public.submit_gallery_photo(p_upload_token uuid, p_guest_name text, p_storage_path text, p_is_video boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gallery_id uuid;
  v_tier text;
  v_new_id uuid;
begin
  select g.id, g.tier into v_gallery_id, v_tier
  from event_galleries g
  where g.upload_token = p_upload_token and g.status = 'active' and (g.expires_at is null or g.expires_at >= current_date);

  if v_gallery_id is null then
    raise exception 'Deze gastenfoto-pagina is niet (meer) actief.';
  end if;
  if p_is_video and v_tier <> 'premium' then
    raise exception 'Video-uploads zijn alleen beschikbaar bij Premium.';
  end if;

  insert into gallery_photos (gallery_id, guest_name, storage_path, is_video, moderation_status)
  values (v_gallery_id, nullif(trim(p_guest_name), ''), p_storage_path, coalesce(p_is_video, false), 'pending')
  returning id into v_new_id;

  return v_new_id;
end;
$$;
grant execute on function public.submit_gallery_photo(uuid, text, text, boolean) to anon, authenticated;

create or replace function public.submit_gallery_message(p_upload_token uuid, p_guest_name text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gallery_id uuid;
  v_tier text;
  v_new_id uuid;
begin
  if p_message is null or trim(p_message) = '' then
    raise exception 'Bericht mag niet leeg zijn.';
  end if;

  select g.id, g.tier into v_gallery_id, v_tier
  from event_galleries g
  where g.upload_token = p_upload_token and g.status = 'active' and (g.expires_at is null or g.expires_at >= current_date);

  if v_gallery_id is null then
    raise exception 'Deze gastenfoto-pagina is niet (meer) actief.';
  end if;
  if v_tier = 'basis' then
    raise exception 'Het gastenboek is alleen beschikbaar bij Plus en Premium.';
  end if;

  insert into gallery_messages (gallery_id, guest_name, message, moderation_status)
  values (v_gallery_id, nullif(trim(p_guest_name), ''), left(trim(p_message), 1000), 'pending')
  returning id into v_new_id;

  return v_new_id;
end;
$$;
grant execute on function public.submit_gallery_message(uuid, text, text) to anon, authenticated;

-- Alleen GOEDGEKEURDE foto's/berichten zijn zichtbaar voor gasten die de
-- pagina bekijken — pending/rejected blijven exclusief zichtbaar voor de
-- organisator (via de gewone RLS-policy hierboven).
create or replace function public.get_gallery_photos_public(p_upload_token uuid)
returns table (
  id uuid,
  guest_name text,
  storage_path text,
  is_video boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.guest_name, p.storage_path, p.is_video, p.created_at
  from gallery_photos p
  join event_galleries g on g.id = p.gallery_id
  where g.upload_token = p_upload_token and p.moderation_status = 'approved'
  order by p.created_at desc
$$;
grant execute on function public.get_gallery_photos_public(uuid) to anon, authenticated;

create or replace function public.get_gallery_messages_public(p_upload_token uuid)
returns table (
  id uuid,
  guest_name text,
  message text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select m.id, m.guest_name, m.message, m.created_at
  from gallery_messages m
  join event_galleries g on g.id = m.gallery_id
  where g.upload_token = p_upload_token and m.moderation_status = 'approved'
  order by m.created_at desc
$$;
grant execute on function public.get_gallery_messages_public(uuid) to anon, authenticated;
