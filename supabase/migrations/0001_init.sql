-- ─────────────────────────────────────────────────────────────
-- Vyra — initiële Postgres-schema (Supabase)
-- Plak dit hele bestand in de Supabase SQL Editor en klik "Run".
--
-- Ontwerp:
-- - We gebruiken Supabase Auth (auth.users) als bron van waarheid voor login.
--   `profiles` bevat de app-specifieke velden per gebruiker (1-op-1 met
--   auth.users, zelfde id).
-- - Row Level Security (RLS) staat aan op elke tabel: een gebruiker kan
--   alleen zijn eigen data lezen/schrijven (owner_id / event_id-koppeling).
-- - Bedragen in centen (integer), nooit floats — zelfde principe als de
--   in-memory store.
-- ─────────────────────────────────────────────────────────────

-- ───────────── PROFIELEN ─────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer','supplier','admin')),
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  country text not null default 'NL',
  language text not null default 'nl' check (language in ('nl','en')),
  currency text not null default 'EUR',
  avatar_color text not null default '#6D5CF0',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: user reads own" on profiles for select using (auth.uid() = id);
create policy "profiles: user updates own" on profiles for update using (auth.uid() = id);
create policy "profiles: user inserts own" on profiles for insert with check (auth.uid() = id);

-- Maakt automatisch een profielrij aan zodra iemand zich registreert via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ───────────── EVENTS ─────────────
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Nieuw evenement',
  type text not null default 'other',
  stage text not null default 'draft',
  description text not null default '',
  date date,
  start_time text,
  end_time text,
  timezone text not null default 'Europe/Amsterdam',
  guest_count_adults int,
  guest_count_children int,
  location_label text,
  location_type text,
  indoor_outdoor text,
  budget jsonb,                     -- { totalCents, source }
  style text,
  theme text,
  formality text,
  is_professional boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table events enable row level security;
create policy "events: owner full access" on events for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table if not exists event_notes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  text text not null,
  source text not null,             -- provenance
  impact_summary text,
  created_at timestamptz not null default now()
);
alter table event_notes enable row level security;
create policy "event_notes: via parent event" on event_notes for all
  using (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()));

-- ───────────── AI-INTERVIEW ─────────────
create table if not exists ai_interview_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  role text not null check (role in ('assistant','user')),
  text text not null,
  extracted_fields jsonb,
  created_at timestamptz not null default now()
);
alter table ai_interview_messages enable row level security;
create policy "ai_interview_messages: via parent event" on ai_interview_messages for all
  using (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()));

-- ───────────── PLAN / REQUIREMENTS ─────────────
create table if not exists event_requirements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  category_key text not null,
  label text not null,
  priority text not null,           -- essential|recommended|optional
  ai_rationale text not null default '',
  selected boolean not null default true,
  estimated_budget_cents bigint,
  status text not null default 'suggested'
);
alter table event_requirements enable row level security;
create policy "event_requirements: via parent event" on event_requirements for all
  using (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()));

-- ───────────── TIMELINE / TAKEN / RISICO'S ─────────────
create table if not exists event_timeline (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  title text not null,
  due_date date,
  lead_time_label text not null default '',
  category_key text,
  done boolean not null default false,
  source text not null
);
alter table event_timeline enable row level security;
create policy "event_timeline: via parent event" on event_timeline for all
  using (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()));

create table if not exists event_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  title text not null,
  urgency text not null,            -- urgent|soon|normal
  done boolean not null default false,
  source text not null,
  related_category text
);
alter table event_tasks enable row level security;
create policy "event_tasks: via parent event" on event_tasks for all
  using (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()));

create table if not exists event_risks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  severity text not null,           -- warning|info
  message text not null,
  created_at timestamptz not null default now()
);
alter table event_risks enable row level security;
create policy "event_risks: via parent event" on event_risks for all
  using (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()));

-- ───────────── AANVRAGEN & OFFERTES ─────────────
create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  category_key text not null,
  supplier_ids text[] not null default '{}',
  desired_service text not null default '',
  special_requests text not null default '',
  budget_cents bigint,
  status text not null default 'awaiting_response',
  sent_at timestamptz not null default now(),
  deadline_at timestamptz not null
);
alter table requests enable row level security;
create policy "requests: via parent event" on requests for all
  using (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()));

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  supplier_id text not null,
  category_key text not null,
  status text not null default 'available',
  total_price_cents bigint not null,
  price_per_person_cents bigint,
  includes text[] not null default '{}',
  excludes text[] not null default '{}',
  extra_costs_note text,
  staff_included boolean not null default false,
  delivery_included boolean not null default false,
  setup_included boolean not null default false,
  teardown_included boolean not null default false,
  travel_costs_cents bigint,
  cancellation_policy text not null default '',
  payment_terms text not null default '',
  valid_until timestamptz not null,
  remarks text,
  match_score int not null default 0,
  match_rationale text not null default '',
  responded_at timestamptz not null default now(),
  swipe_decision text not null default 'none'
);
alter table offers enable row level security;
create policy "offers: via parent event" on offers for all
  using (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()));

-- ───────────── BERICHTEN ─────────────
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  category_key text not null,
  supplier_id text not null,
  sender text not null,             -- customer|supplier|ai_summary
  text text not null,
  created_at timestamptz not null default now()
);
alter table messages enable row level security;
create policy "messages: via parent event" on messages for all
  using (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()));

-- ───────────── NOTIFICATIES ─────────────
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  href text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table notifications enable row level security;
create policy "notifications: owner only" on notifications for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────────── BETALINGEN ─────────────
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  offer_id uuid not null references offers(id) on delete cascade,
  category_key text not null,
  supplier_amount_cents bigint not null,
  platform_fee_cents bigint not null,
  total_cents bigint not null,
  commission_rate numeric(5,4) not null,
  status text not null default 'pending',
  provider text not null default 'mock',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table payments enable row level security;
create policy "payments: via parent event" on payments for all
  using (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid()));

-- ───────────── INDEXEN ─────────────
create index if not exists idx_events_owner on events(owner_id);
create index if not exists idx_requirements_event on event_requirements(event_id);
create index if not exists idx_requests_event on requests(event_id);
create index if not exists idx_offers_event on offers(event_id);
create index if not exists idx_offers_request on offers(request_id);
create index if not exists idx_payments_event on payments(event_id);
create index if not exists idx_notifications_user on notifications(user_id);
create index if not exists idx_messages_event_category on messages(event_id, category_key);
