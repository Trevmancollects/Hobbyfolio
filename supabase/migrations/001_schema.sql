-- Extensions
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  plan text not null default 'free',
  stripe_customer_id text unique,
  stripe_subscription_id text,
  subscription_status text,
  trial_ends_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Inventory
create table public.inventory (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  player text not null,
  year text, set_name text, card_num text, parallel text,
  condition text default 'Raw', grade text, cert_num text,
  population text, location text,
  buy_price numeric(10,2) default 0,
  buy_date date, buy_platform text,
  market_value numeric(10,2) default 0,
  status text default 'For Sale',
  notes text, photo_url text,
  sold_date date, sold_price numeric(10,2),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Transactions
create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  card_id uuid references public.inventory(id) on delete set null,
  player text, date date not null, platform text,
  sale_price numeric(10,2) default 0,
  purchase_price numeric(10,2) default 0,
  platform_fee_pct numeric(5,2) default 0,
  shipping_in numeric(10,2) default 0,
  shipping_out numeric(10,2) default 0,
  grading_fee numeric(10,2) default 0,
  grading_tier text, return_grade text,
  trade_card_out text, trade_card_in text,
  trade_value_out numeric(10,2) default 0,
  trade_value_in numeric(10,2) default 0,
  net_proceeds numeric(10,2) default 0,
  gl numeric(10,2) default 0,
  notes text,
  created_at timestamp with time zone default now()
);

-- Expenses
create table public.expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null, category text not null,
  amount numeric(10,2) default 0,
  miles numeric(8,2), notes text, show_name text, receipt_url text,
  created_at timestamp with time zone default now()
);

-- Snapshots
create table public.snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null, date date not null,
  mv numeric(12,2) default 0, cost numeric(12,2) default 0,
  realized numeric(12,2) default 0, unrealized numeric(12,2) default 0,
  cards integer default 0,
  created_at timestamp with time zone default now(),
  unique(user_id, month)
);

-- Journal
create table public.journal (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, body text, tag text default 'General',
  date date not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Offers
create table public.offers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  player text not null, platform text,
  asking_price numeric(10,2) default 0,
  offer_price numeric(10,2) default 0,
  status text default 'Pending',
  offer_date date, expiry_date date, notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Watchlist
create table public.watchlist (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  player text not null, set_name text,
  target_price numeric(10,2), notes text,
  added_date date default current_date,
  created_at timestamp with time zone default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.inventory enable row level security;
alter table public.transactions enable row level security;
alter table public.expenses enable row level security;
alter table public.snapshots enable row level security;
alter table public.journal enable row level security;
alter table public.offers enable row level security;
alter table public.watchlist enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id);
create policy "own inventory" on public.inventory for all using (auth.uid() = user_id);
create policy "own transactions" on public.transactions for all using (auth.uid() = user_id);
create policy "own expenses" on public.expenses for all using (auth.uid() = user_id);
create policy "own snapshots" on public.snapshots for all using (auth.uid() = user_id);
create policy "own journal" on public.journal for all using (auth.uid() = user_id);
create policy "own offers" on public.offers for all using (auth.uid() = user_id);
create policy "own watchlist" on public.watchlist for all using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Indexes
create index idx_inventory_user on public.inventory(user_id);
create index idx_inventory_status on public.inventory(user_id, status);
create index idx_transactions_user on public.transactions(user_id);
create index idx_transactions_date on public.transactions(user_id, date);
create index idx_expenses_user on public.expenses(user_id);
