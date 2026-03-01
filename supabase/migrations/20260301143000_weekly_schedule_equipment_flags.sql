alter table public.weekly_schedules
  add column if not exists bring_change boolean not null default true,
  add column if not exists bring_laptop boolean not null default false;

update public.weekly_schedules
set bring_change = coalesce(bring_change, true),
    bring_laptop = coalesce(bring_laptop, false);
