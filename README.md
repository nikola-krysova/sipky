# Rezervační systém šipek – Restaurace U Školy Milešovice

Webová aplikace pro rezervaci šipkového terče. React + Vite + TypeScript + Supabase + Resend.

## Rychlý start

```bash
npm install
cp .env.example .env
# Doplňte env proměnné
npm run dev
```

## Nastavení Supabase

1. Vytvořte projekt na [supabase.com](https://supabase.com)
2. Spusťte migrace v Supabase SQL editoru (v pořadí):
   - `supabase/migrations/001_create_reservations.sql`
   - `supabase/migrations/002_create_settings.sql`
   - `supabase/migrations/003_rls_policies.sql`
3. Nasaďte Edge Functions:
   ```bash
   npx supabase functions deploy create-reservation
   npx supabase functions deploy cancel-reservation
   npx supabase functions deploy update-reservation
   npx supabase functions deploy get-reservation
   npx supabase functions deploy send-reminders
   ```
4. Nastavte Edge Function secrets v Supabase Dashboard:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `ADMIN_EMAIL`
   - `APP_URL`

## Admin přihlášení

Admin účet vytvoříte v Supabase Dashboard → Authentication → Users.
Přihlašovací URL: `/admin/login`
