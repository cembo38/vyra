-- ─────────────────────────────────────────────────────────────
-- Vyra — betaling in termijnen (aanbetaling + restbedrag)
--
-- Een offerte kan voortaan in één keer worden afgerekend ("full", het
-- bestaande gedrag) óf via een aanbetaling ("deposit") gevolgd door een
-- restbedrag ("balance") — twee losse rijen in `payments` die aan
-- dezelfde offerte hangen. `parent_payment_id` koppelt de restbetaling
-- aan haar aanbetaling, zodat de UI ze als één geheel kan tonen.
--
-- Een vereiste (event_requirements) wordt pas op status 'paid' gezet
-- zodra ALLE betalingen voor die offerte betaald zijn — zie de
-- aangepaste markPaymentPaid()-logica in lib/data/store.ts.
-- ─────────────────────────────────────────────────────────────

alter table payments add column if not exists installment text not null default 'full' check (installment in ('full','deposit','balance'));
alter table payments add column if not exists parent_payment_id uuid references payments(id) on delete cascade;

create index if not exists idx_payments_parent on payments(parent_payment_id);
create index if not exists idx_payments_offer on payments(offer_id);
