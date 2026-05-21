create table if not exists public.businesses (
  id text primary key,
  name text not null,
  owner_email text not null unique,
  plan text not null default 'pro',
  subscription_status text not null default 'pending',
  trial_ends_at text not null,
  license_key text not null default '',
  created_at text not null,
  updated_at text not null
);

create table if not exists public.users (
  id text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('owner', 'manager', 'cashier')),
  active boolean not null default true,
  created_at text not null,
  updated_at text not null
);

create table if not exists public.products (
  id text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  name text not null,
  sku text not null,
  category text not null default 'General',
  price real not null default 0,
  cost real not null default 0,
  stock integer not null default 0,
  reorder_level integer not null default 5,
  deleted_at text,
  created_at text not null,
  updated_at text not null,
  unique (business_id, sku)
);

create table if not exists public.customers (
  id text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  visits integer not null default 0,
  total_spent real not null default 0,
  deleted_at text,
  created_at text not null,
  updated_at text not null
);

create table if not exists public.sales (
  id text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  customer_id text references public.customers(id),
  cashier_id text references public.users(id),
  cashier_name text not null,
  payment_type text not null,
  status text not null default 'completed',
  subtotal real not null,
  discount real not null default 0,
  tax real not null default 0,
  total real not null,
  refunded_at text,
  refunded_by text,
  created_at text not null,
  updated_at text not null
);

create table if not exists public.sale_items (
  id text primary key,
  sale_id text not null references public.sales(id) on delete cascade,
  product_id text references public.products(id),
  name text not null,
  sku text not null,
  qty integer not null,
  price real not null,
  line_total real not null
);

create table if not exists public.sync_events (
  id text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  user_id text references public.users(id),
  type text not null,
  payload jsonb not null,
  created_at text not null
);

create table if not exists public.password_reset_tokens (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  token_hash text not null,
  expires_at text not null,
  used_at text,
  created_at text not null
);

alter table public.businesses add column if not exists license_key text not null default '';

create index if not exists users_business_id_idx on public.users(business_id);
create index if not exists products_business_id_idx on public.products(business_id);
create index if not exists customers_business_id_idx on public.customers(business_id);
create index if not exists sales_business_id_idx on public.sales(business_id);
create index if not exists sale_items_sale_id_idx on public.sale_items(sale_id);
create index if not exists password_reset_tokens_token_hash_idx on public.password_reset_tokens(token_hash);
