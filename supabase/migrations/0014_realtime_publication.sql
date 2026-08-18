-- Zet Realtime aan voor de tabellen die live moeten bijwerken zonder dat de
-- gebruiker handmatig hoeft te verversen (spec-item "live updates zonder
-- handmatig verversen"): berichten, notificaties, offertes en de status van
-- requirements. Bestaande RLS-policies gelden gewoon door voor Realtime —
-- een gebruiker krijgt alleen wijzigingen te zien op rijen die hij/zij
-- toch al mag lezen.
--
-- Idempotent: als een tabel al in de publicatie zit, slaat de DO-blok hem
-- gewoon over (voorkomt een foutmelding bij opnieuw draaien).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'offers'
  ) then
    alter publication supabase_realtime add table offers;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'event_requirements'
  ) then
    alter publication supabase_realtime add table event_requirements;
  end if;
end $$;
