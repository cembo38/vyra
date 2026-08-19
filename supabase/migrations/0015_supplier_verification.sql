-- Leveranciersverificatie (spec-item "echte leveranciersverificatie"):
-- een leverancier kan verificatie aanvragen (nadat hij een KVK-nummer heeft
-- ingevuld), en een admin keurt dat handmatig goed of af via het
-- admin-dashboard. `verified` bestond al (default false) maar er was tot nu
-- toe geen enkel pad om 'm ooit op true te zetten voor een echt account.
alter table suppliers add column if not exists verification_requested_at timestamptz;

comment on column suppliers.verification_requested_at is
  'Wanneer de leverancier verificatie heeft aangevraagd — null als er nooit een aanvraag is gedaan (of nadat een admin de aanvraag heeft afgehandeld).';
