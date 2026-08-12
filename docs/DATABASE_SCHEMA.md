# Database-architectuur (productie-doel)

Deze MVP-codebase gebruikt een in-memory, file-achtige store (`lib/data/store.ts`)
achter een repository-API, zodat de rest van de applicatie (components, routes,
server actions, AI-laag) nooit rechtstreeks met de database praat. Dit document
beschrijft het Postgres-schema waar die store 1-op-1 naartoe migreert — je
vervangt dan alleen de binnenkant van de functies in `lib/data/store.ts` door
Supabase/Postgres-queries (of een ORM als Prisma/Drizzle), zonder de rest van
de app aan te raken.

## Ontwerpprincipes

- **Scheiding van databronnen** (zie ook `lib/types.ts`): elk record dat AI
  kan genereren heeft een `source`/`provenance`-kolom (`user`,
  `ai_recommendation`, `supplier`, `system`), zodat nooit AI-output wordt
  opgeslagen alsof een gebruiker of leverancier dit bevestigd heeft.
- **Money as integers**: alle bedragen in centen (`_cents`), nooit floats.
- **Commissiepercentage is data, geen constante**: zie `commissions`-tabel en
  `PLATFORM_COMMISSION_RATE` in `lib/config.ts`.
- **Soft multi-tenancy via `owner_id` / `event_id` foreign keys** met Row
  Level Security (Supabase) zodat een gebruiker alleen bij zijn eigen events
  en een leverancier alleen bij zijn eigen aanvragen/offertes kan.

## Kerntabellen

```sql
-- ───────────── USERS & PROFIELEN ─────────────
users (
  id uuid primary key,
  email text unique not null,
  role text not null check (role in ('customer','supplier','admin')),
  created_at timestamptz not null default now()
);

profiles (
  user_id uuid primary key references users(id) on delete cascade,
  first_name text,
  last_name text,
  country text,
  language text default 'nl',
  currency text default 'EUR',
  avatar_color text
);

-- ───────────── EVENTS ─────────────
events (
  id uuid primary key,
  owner_id uuid references users(id),
  name text not null,
  type text not null,               -- enum EventType
  stage text not null,              -- draft|planning|sourcing|booking|confirmed|completed
  description text,
  date date,
  start_time time,
  end_time time,
  timezone text default 'Europe/Amsterdam',
  guest_count_adults int,
  guest_count_children int,
  location_label text,
  location_type text,               -- home|external_venue|tbd
  indoor_outdoor text,
  budget_total_cents bigint,
  budget_source text,               -- provenance
  style text,
  theme text,
  formality text,
  is_professional boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

event_members (                     -- toekomstig: multi-organizer collaboration
  event_id uuid references events(id) on delete cascade,
  user_id uuid references users(id),
  role text default 'owner',        -- owner|editor|viewer
  primary key (event_id, user_id)
);

event_notes (
  id uuid primary key,
  event_id uuid references events(id) on delete cascade,
  text text not null,
  source text not null,             -- provenance
  impact_summary text,              -- AI change-detection uitleg
  created_at timestamptz default now()
);

-- ───────────── AI-GEGENEREERDE PLANDATA ─────────────
event_requirements (                -- = "requirement_category" in de app
  id uuid primary key,
  event_id uuid references events(id) on delete cascade,
  category_key text not null,       -- enum SupplierCategory
  label text not null,
  priority text not null,           -- essential|recommended|optional
  ai_rationale text,
  selected boolean default true,
  estimated_budget_cents bigint,
  status text not null,             -- suggested|selected|requested|... |completed
  created_at timestamptz default now()
);

event_categories (                  -- lookup/reference table voor category_key metadata
  key text primary key,
  label_nl text not null,
  label_en text
);

event_timeline (
  id uuid primary key,
  event_id uuid references events(id) on delete cascade,
  title text not null,
  due_date date,
  lead_time_label text,
  category_key text,
  done boolean default false,
  source text not null
);

event_tasks (
  id uuid primary key,
  event_id uuid references events(id) on delete cascade,
  title text not null,
  urgency text not null,            -- urgent|soon|normal
  done boolean default false,
  source text not null,
  related_category text
);

event_budget (                      -- optioneel: expliciete audit trail van budgetwijzigingen
  id uuid primary key,
  event_id uuid references events(id) on delete cascade,
  total_cents bigint not null,
  changed_by uuid references users(id),
  reason text,
  created_at timestamptz default now()
);

ai_conversations (
  id uuid primary key,
  event_id uuid references events(id) on delete cascade,
  kind text not null,                -- interview|assistant
  created_at timestamptz default now()
);

ai_messages (
  id uuid primary key,
  conversation_id uuid references ai_conversations(id) on delete cascade,
  role text not null,                -- assistant|user
  text text not null,
  extracted_fields jsonb,
  created_at timestamptz default now()
);

-- ───────────── SUPPLIERS ─────────────
suppliers (
  id uuid primary key,
  user_id uuid references users(id),
  company_name text not null,
  contact_person text,
  category text not null,
  kvk_number text,
  vat_number text,
  verified boolean default false,
  created_at timestamptz default now()
);

supplier_profiles (
  supplier_id uuid primary key references suppliers(id) on delete cascade,
  description text,
  service_areas text[],
  min_price_cents bigint,
  avg_price_cents bigint,
  photo_urls text[],
  portfolio_highlights text[],
  tags text[],
  years_active int
);

supplier_services (
  id uuid primary key,
  supplier_id uuid references suppliers(id) on delete cascade,
  category text not null,
  name text not null,
  description text,
  base_price_cents bigint
);

supplier_availability (
  supplier_id uuid references suppliers(id) on delete cascade,
  date date not null,
  available boolean not null,
  primary key (supplier_id, date)
);

supplier_reviews (
  id uuid primary key,
  supplier_id uuid references suppliers(id) on delete cascade,
  event_id uuid references events(id),
  author_id uuid references users(id),
  rating_communication int,
  rating_quality int,
  rating_value int,
  rating_reliability int,
  comment text,
  created_at timestamptz default now()
);

-- ───────────── MARKETPLACE: AANVRAGEN & OFFERTES ─────────────
requests (
  id uuid primary key,
  event_id uuid references events(id) on delete cascade,
  category_key text not null,
  desired_service text,
  special_requests text,
  budget_cents bigint,
  status text not null,             -- sent|awaiting_response|responded|expired|cancelled
  sent_at timestamptz default now(),
  deadline_at timestamptz not null  -- sent_at + 48u
);

request_items (                     -- welke leveranciers deze aanvraag ontvingen
  request_id uuid references requests(id) on delete cascade,
  supplier_id uuid references suppliers(id),
  primary key (request_id, supplier_id)
);

offers (
  id uuid primary key,
  request_id uuid references requests(id) on delete cascade,
  event_id uuid references events(id),
  supplier_id uuid references suppliers(id),
  category_key text not null,
  status text not null,             -- pending|available|unavailable|shortlisted|accepted|declined|expired
  total_price_cents bigint,
  price_per_person_cents bigint,
  extra_costs_note text,
  staff_included boolean,
  delivery_included boolean,
  setup_included boolean,
  teardown_included boolean,
  travel_costs_cents bigint,
  cancellation_policy text,
  payment_terms text,
  valid_until timestamptz,
  remarks text,
  match_score int,
  match_rationale text,
  swipe_decision text default 'none',
  responded_at timestamptz,
  created_at timestamptz default now()
);

offer_items (                       -- losse "includes"/"excludes" regels
  id uuid primary key,
  offer_id uuid references offers(id) on delete cascade,
  kind text not null,               -- include|exclude
  description text not null
);

shortlists (
  event_id uuid references events(id),
  category_key text not null,
  offer_id uuid references offers(id),
  decision text not null,           -- shortlisted|selected|rejected
  updated_at timestamptz default now(),
  primary key (event_id, category_key, offer_id)
);

-- ───────────── COMMUNICATIE ─────────────
messages (
  id uuid primary key,
  event_id uuid references events(id) on delete cascade,
  category_key text not null,
  supplier_id uuid references suppliers(id),
  sender text not null,             -- customer|supplier|ai_summary
  text text not null,
  created_at timestamptz default now()
);

notifications (
  id uuid primary key,
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id),
  type text not null,
  title text not null,
  body text,
  href text,
  read boolean default false,
  created_at timestamptz default now()
);

documents (
  id uuid primary key,
  event_id uuid references events(id) on delete cascade,
  uploaded_by uuid references users(id),
  kind text,                        -- contract|invoice|other
  storage_path text not null,
  created_at timestamptz default now()
);

-- ───────────── BETALINGEN & COMMISSIE ─────────────
payments (
  id uuid primary key,
  event_id uuid references events(id),
  offer_id uuid references offers(id),
  category_key text not null,
  supplier_amount_cents bigint not null,
  platform_fee_cents bigint not null,
  total_cents bigint not null,
  commission_rate numeric(5,4) not null,   -- bv. 0.0950
  status text not null,             -- pending|paid|failed|refunded
  provider text not null,           -- stripe|mock
  provider_reference text,          -- Stripe PaymentIntent id
  created_at timestamptz default now(),
  paid_at timestamptz
);

transactions (                      -- ledger-achtige log, 1 rij per financiële mutatie
  id uuid primary key,
  payment_id uuid references payments(id),
  type text not null,               -- charge|refund|payout
  amount_cents bigint not null,
  created_at timestamptz default now()
);

commissions (                       -- configureerbaar commissiemodel, niet hardcoded
  id uuid primary key,
  scope text not null,              -- 'global' | 'category:<key>' | 'supplier:<id>'
  rate numeric(5,4) not null default 0.0950,
  active_from timestamptz default now(),
  active_until timestamptz
);
```

## Waarom dit schema klopt met de productspec

Elke tabel uit de opdracht (§32) is hierboven vertegenwoordigd: `users`,
`profiles`, `events`, `event_members`, `event_requirements`, `event_tasks`,
`event_budget`, `event_categories`, `suppliers`, `supplier_services`,
`supplier_availability`, `supplier_profiles`, `supplier_reviews`, `requests`,
`request_items`, `offers`, `offer_items`, `shortlists`, `messages`,
`notifications`, `payments`, `transactions`, `commissions`, `documents`,
`ai_conversations`, `ai_messages`, `event_timeline`, `event_notes`.

## Migratiepad vanaf de huidige in-memory store

1. Introduceer Supabase (Postgres + Auth + Storage), voer bovenstaand schema
   uit als migratie.
2. Vervang de interne implementatie van elke functie in `lib/data/store.ts`
   (en `lib/data/suppliers.ts`) door een Supabase-query. De functienamen en
   return-types blijven gelijk, dus componenten/routes/server actions hoeven
   niet te wijzigen.
3. Vervang `lib/auth.ts` (`getCurrentUser`) door een Supabase Auth-sessie.
4. Voeg Row Level Security-policies toe per tabel op basis van `owner_id` /
   `event_id` / `supplier_id`.
