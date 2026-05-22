CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS reservations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  name         text NOT NULL,
  email        text NOT NULL,
  phone        text,
  date         date NOT NULL,
  time_from    time NOT NULL,
  time_to      time NOT NULL,
  note         text,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  cancel_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  reminder_sent boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_reservations_date ON reservations (date);
CREATE INDEX idx_reservations_status ON reservations (status);
CREATE INDEX idx_reservations_cancel_token ON reservations (cancel_token);
