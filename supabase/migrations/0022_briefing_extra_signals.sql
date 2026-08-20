-- ─────────────────────────────────────────────────────────────
-- Vyra — Twee extra signalen in het AI-team-dagrapport (vervolg op
-- migratie 0021).
--
-- Op verzoek van Cem uitgebreid met twee puur informatieve punten (geen
-- "requires_approval", alleen een "Gezien"-knop die het rapportpunt
-- opschoont — zie generateAndStoreDailyBriefing() in lib/data/store.ts):
--
-- 1. "supplier_unresponsive" — een leverancier die de reactietermijn
--    (48 uur, SUPPLIER_RESPONSE_WINDOW_HOURS) op een aanvraag heeft laten
--    verlopen zonder offerte of afwijzing.
-- 2. "organizer_stalled" — een evenement dat al ORGANIZER_STALLED_DAYS
--    (7 dagen) niet is bijgewerkt en nog niet is afgerond/geannuleerd.
--
-- De `kind`-check-constraint moet daarom worden verruimd. Postgres staat
-- geen "alter constraint" toe — de bestaande constraint wordt gedropt en
-- opnieuw aangemaakt met dezelfde naam als de automatisch gegenereerde
-- (`admin_briefing_items_kind_check`), zodat dit ook een tweede keer
-- veilig te draaien is (vandaar de `if exists`).
-- ─────────────────────────────────────────────────────────────

alter table admin_briefing_items drop constraint if exists admin_briefing_items_kind_check;

alter table admin_briefing_items add constraint admin_briefing_items_kind_check
  check (kind in (
    'supplier_verification',
    'dispute',
    'new_supplier',
    'new_users',
    'flagged_ai',
    'financial',
    'supplier_unresponsive',
    'organizer_stalled'
  ));
