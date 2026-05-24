-- Přidat číslo rezervace (automaticky rostoucí)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS reservation_number SERIAL;
