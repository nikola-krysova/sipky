-- Allow anonymous users to read reservation availability for the calendar.
-- Personal columns (name, email, phone) are not fetched by the public calendar query.
CREATE POLICY "public_read_availability" ON reservations
  FOR SELECT USING (true);
