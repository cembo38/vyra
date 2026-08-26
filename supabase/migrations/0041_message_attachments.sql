-- ─────────────────────────────────────────────────────────────
-- Vyra — bijlages (foto/pdf) in berichten
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
--
-- Voegt een `message_attachments`-tabel toe (metadata: bestandsnaam,
-- type, grootte, opslagpad) gekoppeld aan een bericht, plus een NIEUWE,
-- PRIVATE opslagruimte ("message-attachments" — in tegenstelling tot
-- de publieke "supplier-media"-ruimte uit migratie 4). Berichten tussen
-- een organisator en een leverancier kunnen contracten, offertes-als-pdf
-- of foto's van de locatie bevatten — dat hoort niet, zoals een
-- profielfoto, voor iedereen met de juiste URL leesbaar te zijn. Lezen
-- gaat daarom altijd via een tijdelijke ondertekende URL (zie
-- getMessages() in lib/data/store.ts), nooit via een publieke link.
--
-- RLS hergebruikt bewust exact dezelfde toegangslogica als de
-- `messages`-tabel zelf (migraties 1 en 12: organisator via
-- events.owner_id, leverancier via is_supplier_targeted_for_event() +
-- eigen supplier_id) — wie een bericht mag lezen/sturen, mag ook precies
-- de bijlages van dát bericht lezen/toevoegen.
-- ─────────────────────────────────────────────────────────────

create table if not exists message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes int not null default 0,
  created_at timestamptz not null default now()
);
alter table message_attachments enable row level security;

create index if not exists idx_message_attachments_message on message_attachments(message_id);

create policy "message_attachments: organisator via bericht" on message_attachments for all
  using (exists (
    select 1 from messages m join events e on e.id = m.event_id
    where m.id = message_id and e.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from messages m join events e on e.id = m.event_id
    where m.id = message_id and e.owner_id = auth.uid()
  ));

create policy "message_attachments: leverancier leest eigen gesprekken" on message_attachments for select
  using (exists (
    select 1 from messages m join suppliers s on s.id::text = m.supplier_id
    where m.id = message_id and s.owner_id = auth.uid() and is_supplier_targeted_for_event(m.event_id)
  ));

create policy "message_attachments: leverancier voegt toe aan eigen berichten" on message_attachments for insert
  with check (exists (
    select 1 from messages m join suppliers s on s.id::text = m.supplier_id
    where m.id = message_id and m.sender = 'supplier' and s.owner_id = auth.uid() and is_supplier_targeted_for_event(m.event_id)
  ));

-- ───────────── OPSLAGRUIMTE (PRIVATE) ─────────────
-- Pad-schema: `${eventId}/${supplierId}/${bestandsnaam}` — dezelfde
-- twee sleutels als messages zelf, zodat de storage-policies hieronder
-- met (storage.foldername(name))[1]/[2] precies dezelfde toegang kunnen
-- afdwingen als de messages/message_attachments-tabellen hierboven.
insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do nothing;

create policy "message-attachments: organisator leest eigen" on storage.objects for select
  using (
    bucket_id = 'message-attachments'
    and exists (select 1 from events e where e.id::text = (storage.foldername(name))[1] and e.owner_id = auth.uid())
  );

create policy "message-attachments: organisator uploadt eigen" on storage.objects for insert
  with check (
    bucket_id = 'message-attachments'
    and exists (select 1 from events e where e.id::text = (storage.foldername(name))[1] and e.owner_id = auth.uid())
  );

create policy "message-attachments: leverancier leest eigen gesprekken" on storage.objects for select
  using (
    bucket_id = 'message-attachments'
    and exists (select 1 from suppliers s where s.owner_id = auth.uid() and s.id::text = (storage.foldername(name))[2])
    and is_supplier_targeted_for_event((storage.foldername(name))[1]::uuid)
  );

create policy "message-attachments: leverancier uploadt in eigen gesprekken" on storage.objects for insert
  with check (
    bucket_id = 'message-attachments'
    and exists (select 1 from suppliers s where s.owner_id = auth.uid() and s.id::text = (storage.foldername(name))[2])
    and is_supplier_targeted_for_event((storage.foldername(name))[1]::uuid)
  );
