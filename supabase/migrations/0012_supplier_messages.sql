-- ─────────────────────────────────────────────────────────────
-- Vyra — leveranciers kunnen reageren op berichten
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
--
-- Tot nu toe had alleen de organisator (via de "messages: via parent
-- event"-policy) toegang tot de `messages`-tabel — een leverancier kon een
-- gesprek dus wel LEZEN in de UI-veronderstelling, maar de database wees
-- elke poging stiekem af (RLS gaf gewoon een lege set terug, geen
-- duidelijke foutmelding). Deze migratie voegt twee gerichte policies toe
-- die een leverancier laten lezen/schrijven in gesprekken over evenementen
-- waar hij daadwerkelijk voor is uitgenodigd (via `request_targets`), en
-- alléén voor zijn eigen `supplier_id` op dat bericht — dus niet de
-- gesprekken van andere, voor dezelfde categorie benaderde leveranciers.
--
-- Hergebruikt bewust `is_supplier_targeted_for_event()` (migratie 0009) —
-- een SECURITY DEFINER-functie die al aan `authenticated` is toegekend —
-- in plaats van een nieuwe subquery te schrijven, om dezelfde RLS-
-- recursieproblematiek te vermijden die events/requests/request_targets
-- eerder had (zie 0009/0010).
-- ─────────────────────────────────────────────────────────────

create policy "messages: leverancier leest eigen gesprekken" on messages for select
  using (
    is_supplier_targeted_for_event(event_id)
    and exists (select 1 from suppliers s where s.owner_id = auth.uid() and s.id::text = messages.supplier_id)
  );

create policy "messages: leverancier stuurt eigen berichten" on messages for insert
  with check (
    sender = 'supplier'
    and is_supplier_targeted_for_event(event_id)
    and exists (select 1 from suppliers s where s.owner_id = auth.uid() and s.id::text = messages.supplier_id)
  );
