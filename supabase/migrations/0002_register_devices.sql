create table if not exists public.register_devices (
  id text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  device_id text not null,
  device_name text not null default 'Register',
  active boolean not null default true,
  first_seen_at text not null,
  last_seen_at text not null,
  deactivated_at text,
  unique (business_id, device_id)
);

create index if not exists register_devices_business_id_idx on public.register_devices(business_id);
create index if not exists register_devices_active_idx on public.register_devices(business_id, active);
