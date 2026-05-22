CREATE TABLE IF NOT EXISTS settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

INSERT INTO settings (key, value) VALUES
('opening_hours', '{
  "monday":    {"open": "15:00", "close": "20:00"},
  "tuesday":   {"open": "15:00", "close": "20:00"},
  "wednesday": {"open": "15:00", "close": "20:00"},
  "thursday":  {"open": "15:00", "close": "20:00"},
  "friday":    {"open": "15:00", "close": "24:00"},
  "saturday":  {"open": "14:00", "close": "22:00"},
  "sunday":    {"open": "14:00", "close": "20:00"}
}'),
('reservation_rules', '{
  "min_duration_minutes": 60,
  "max_duration_minutes": 180,
  "slot_granularity_minutes": 30,
  "min_days_ahead": 1,
  "max_days_ahead": 30
}')
ON CONFLICT (key) DO NOTHING;
