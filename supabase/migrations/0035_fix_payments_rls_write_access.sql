-- ───────────── FIX: `payments`-tabel had onbeperkte schrijftoegang voor de organisator ─────────────
-- Migratie 0001 gaf de organisator via één brede `for all`-policy niet
-- alleen leestoegang tot zijn eigen betalingen, maar ook onbeperkte
-- insert/update/delete — rechtstreeks via de Supabase-client, buiten de
-- servercode in lib/data/store.ts (createPaymentForOffer/markPaymentPaid)
-- om. Een organisator kon zo, met alleen zijn eigen (publieke) anon-key en
-- sessie, zelf een betaalstatus op "paid" zetten zonder ooit te betalen,
-- het platformkosten-/commissiebedrag verlagen, of een betaalrij
-- verwijderen om een geschil te ontlopen. Onschuldig zolang er geen echt
-- geld beweegt (provider blijft "mock"), maar dit moet dicht vóórdat dat
-- wél zo is.
--
-- `createSupabaseAdminClient()` (lib/supabase/admin.ts) is HIER bewust
-- NIET de oplossing — die is expliciet gereserveerd voor /admin-routes (zie
-- de toelichting in dat bestand), en createPaymentForOffer/markPaymentPaid
-- zijn gewone, door de organisator zelf getriggerde acties, geen
-- adminfunctionaliteit. In plaats daarvan wordt de RLS-policy zelf
-- opgesplitst en verscherpt tot precies de operaties die de servercode
-- vandaag daadwerkelijk uitvoert:
--   • select  — eigen betalingen lezen (ongewijzigd)
--   • insert  — alleen een NIEUWE, nog niet-betaalde ("pending") rij
--   • update  — alleen de exacte overgang pending → paid (nooit andersom,
--               nooit een tweede keer op een al betaalde rij)
--   • delete  — alleen een eigen rij die nog "pending" is (opruimen bij een
--               mislukte aanmaak, zie de rollback in createPaymentForOffer);
--               een "paid"-rij is nooit verwijderbaar, ook niet door de
--               organisator zelf — dat zou de enige betaalhistorie wissen.
--
-- De policies hierboven voorkomen weliswaar dat een organisator een
-- verboden pending→paid-overgang start, maar RLS alleen kan niet
-- afdwingen dat de BEDRAGEN tijdens zo'n update ongewijzigd blijven — een
-- `with check` ziet alleen de nieuwe rij, niet welke kolommen daadwerkelijk
-- veranderd zijn. Vandaar de trigger hieronder: die blokkeert elke poging
-- om iets anders dan `status`/`paid_at` te wijzigen op een bestaande
-- betaalrij, ongeacht via welk pad (RLS-toegestane update, of straks een
-- service-role-pad) die poging binnenkomt.

drop policy if exists "payments: via parent event" on payments;

create policy "payments: leest eigen via parent event" on payments for select
  using (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()));

create policy "payments: organisator maakt eigen pending-betaling aan" on payments for insert
  with check (
    status = 'pending'
    and exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid())
  );

create policy "payments: organisator bevestigt eigen betaling" on payments for update
  using (
    status = 'pending'
    and exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid())
  )
  with check (
    status = 'paid'
    and exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid())
  );

create policy "payments: organisator ruimt eigen open betaling op" on payments for delete
  using (
    status = 'pending'
    and exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid())
  );

create or replace function public.protect_payment_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if new.event_id is distinct from old.event_id
    or new.offer_id is distinct from old.offer_id
    or new.category_key is distinct from old.category_key
    or new.supplier_amount_cents is distinct from old.supplier_amount_cents
    or new.platform_fee_cents is distinct from old.platform_fee_cents
    or new.total_cents is distinct from old.total_cents
    or new.commission_rate is distinct from old.commission_rate
    or new.commission_tier is distinct from old.commission_tier
    or new.provider is distinct from old.provider
    or new.installment is distinct from old.installment
    or new.parent_payment_id is distinct from old.parent_payment_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'payments: alleen status en paid_at mogen wijzigen na aanmaak';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_payment_immutable_fields on payments;
create trigger trg_protect_payment_immutable_fields
  before update on payments
  for each row
  execute function public.protect_payment_immutable_fields();
