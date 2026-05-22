alter table reservations add column if not exists recurring_group_id uuid;
alter table reservations add column if not exists google_event_id text;
