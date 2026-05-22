-- Enable RLS
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Settings: anyone can read, only admin can write
CREATE POLICY "settings_public_read" ON settings
  FOR SELECT USING (true);

CREATE POLICY "settings_admin_write" ON settings
  FOR ALL USING (auth.role() = 'authenticated');

-- Reservations: admin full access
CREATE POLICY "admin_all" ON reservations
  FOR ALL USING (auth.role() = 'authenticated');

-- Anon can insert (via Edge Function validation)
CREATE POLICY "customer_insert" ON reservations
  FOR INSERT WITH CHECK (true);

-- Anon can read own reservation via cancel_token (set by Edge Function)
CREATE POLICY "customer_read_own" ON reservations
  FOR SELECT USING (
    auth.role() = 'authenticated' OR
    cancel_token::text = current_setting('app.cancel_token', true)
  );
