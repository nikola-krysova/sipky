create table if not exists blocked_slots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  date date not null,
  time_from time not null,
  time_to time not null,
  label text not null default 'Blokováno'
);

alter table blocked_slots enable row level security;

create policy "Anyone can read blocked slots"
  on blocked_slots for select
  using (true);

create policy "Authenticated users manage blocked slots"
  on blocked_slots for all
  using (auth.role() = 'authenticated');
