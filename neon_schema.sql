create extension if not exists pgcrypto;

create table if not exists weekly_schedules (
  id uuid primary key default gen_random_uuid(),
  week_number integer not null,
  class_name text not null,
  day text not null,
  activity text not null,
  hall text not null default '',
  changing_room text not null default '',
  code text not null default '',
  cancelled boolean not null default false,
  is_theory boolean not null default false,
  bring_change boolean not null default true,
  bring_laptop boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists term_plans (
  id uuid primary key default gen_random_uuid(),
  weeks text not null,
  area text not null,
  description text not null default '',
  is_assessment boolean not null default false,
  color text not null default 'teal',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists class_day_halls (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  day text not null,
  hall text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_name, day)
);

create table if not exists changing_room_codes (
  id uuid primary key default gen_random_uuid(),
  week_number integer not null,
  day text not null,
  changing_room text not null,
  code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_number, day, changing_room)
);

create table if not exists school_settings (
  id text primary key,
  settings jsonb not null,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists calendar_exceptions (
  id uuid primary key default gen_random_uuid(),
  week_number integer not null check (week_number >= 1 and week_number <= 53),
  day text not null,
  class_name text,
  title text not null,
  message text not null default '',
  cancel_lesson boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_change_log (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  scope text not null,
  action text not null,
  summary text not null,
  actor_email text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists admin_snapshots (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  scope text not null,
  summary text not null,
  actor_email text,
  payload jsonb not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

insert into school_settings (id, settings, updated_by)
values (
  'default',
  jsonb_build_object(
    'classes', jsonb_build_array('7A', '7F', '8B', '8C', '8H'),
    'weekDays', jsonb_build_array('Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag'),
    'halls', jsonb_build_array('Gy-sal', 'Freja A', 'Freja B'),
    'changingRooms', jsonb_build_array('1&2', '3&4', '5&6')
  ),
  'seed'
)
on conflict (id) do nothing;

insert into admin_users (email, role, active)
values ('erik.espemyr@falkoping.se', 'owner', true)
on conflict (email) do nothing;
