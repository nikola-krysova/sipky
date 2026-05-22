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

## Cron připomínky

V Supabase Dashboard → Edge Functions → `send-reminders` nastavte cron schedule:
```
0 10 * * *
```
(Každý den v 10:00)

## Deploy na Vercel

1. Propojte GitHub repozitář s Vercel
2. Nastavte env proměnné `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY`
3. Build command: `npm run build`, Output: `dist`

## Admin přihlášení

Admin účet vytvoříte v Supabase Dashboard → Authentication → Users.
Přihlašovací URL: `/admin/login`

## Struktura projektu

```
src/
├── components/
│   ├── Calendar/        # FullCalendar wrapper + custom event render
│   ├── Reservation/     # Formulář, potvrzení, správa zákazníkem
│   ├── admin/           # Admin tabulka, modal, statistiky
│   └── ui/              # Button, Modal, Skeleton
├── pages/
│   ├── index.tsx        # Hlavní zákaznická stránka
│   ├── rezervace/       # /rezervace/:token
│   └── admin/           # Dashboard, rezervace, nastavení, login
├── lib/
│   ├── supabase.ts      # Supabase client
│   └── validations.ts   # Sdílená validační logika + Zod schema
└── types/
    └── reservation.ts

supabase/
├── migrations/          # 3 SQL migrace
└── functions/           # 5 Edge Functions (create/cancel/update/get/send-reminders)
```
