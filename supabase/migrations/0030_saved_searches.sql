-- Bewaarde zoekopdrachten (Vinted-stijl): een organisator bewaart een
-- zoekopdracht op /leveranciers en krijgt een melding zodra een nieuwe
-- leverancier zich aanmeldt die bij die categorie/regio past — zie
-- notifyMatchingSavedSearches() in lib/data/store.ts (aangeroepen vanuit
-- createSupplierAccount()).
--
-- Plak dit hieronder in de Supabase SQL Editor en klik "Run".

create table if not exists saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_key text,
  location text,
  query text,
  created_at timestamptz not null default now()
);

create index if not exists idx_saved_searches_user on saved_searches(user_id);

alter table saved_searches enable row level security;

create policy "saved_searches: eigenaar leest" on saved_searches for select using (auth.uid() = user_id);
create policy "saved_searches: eigenaar maakt aan" on saved_searches for insert with check (auth.uid() = user_id);
create policy "saved_searches: eigenaar verwijdert" on saved_searches for delete using (auth.uid() = user_id);
