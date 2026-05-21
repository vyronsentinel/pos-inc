# POS inc

Offline-first point-of-sale system for small businesses.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

Frontend environment variable for deployed builds when using Supabase Edge Functions:

```env
VITE_API_URL=https://rmpjjfuyjpfuwwhivedx.supabase.co/functions/v1
```

## Run Backend

```bash
cd backend
npm install
npm run dev
```

The API runs at `http://127.0.0.1:4000`.

Useful endpoints:

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/license`
- `GET/POST/PUT/DELETE /api/products`
- `GET/POST/PUT/DELETE /api/customers`
- `GET/POST /api/sales`
- `POST /api/sales/:id/refund`
- `GET /api/paypal/status`
- `POST /api/paypal/checkout-link`
- `POST /api/paypal/create-subscription`

The legacy Express backend stores data in `backend/data/pos-inc.json` by default for local development. For hosted Supabase-only deployment, use the Edge Function in `supabase/functions/api` instead of hosting `backend/`.

## Supabase Edge Function Backend

The Supabase backend is a single Edge Function named `api`. It preserves the existing frontend API paths, so set Vercel `VITE_API_URL` to:

```env
https://rmpjjfuyjpfuwwhivedx.supabase.co/functions/v1
```

Apply the database schema in `supabase/migrations/0001_pos_inc_schema.sql` through the Supabase SQL editor or CLI.

Set these Supabase Edge Function secrets:

```env
SUPABASE_URL=https://rmpjjfuyjpfuwwhivedx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
LICENSE_SECRET=...
FRONTEND_URL=https://pos-inc.vercel.app
BREVO_API_KEY=...
MAIL_FROM=POS inc <posinc.noreply@gmail.com>
PAYPAL_ENVIRONMENT=live
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_STARTER_PLAN_ID=...
PAYPAL_PRO_PLAN_ID=...
PAYPAL_BUSINESS_PLAN_ID=...
```

Deploy with the Supabase CLI:

```bash
supabase functions deploy api --project-ref rmpjjfuyjpfuwwhivedx
```

Forgot-password emails use Brevo's HTTP API in the Edge Function, so use `BREVO_API_KEY` rather than SMTP variables for Supabase-only deployment.

Current subscription pricing:

- Starter: `PHP 799/month` after a 14-day trial
- Pro: `PHP 1,299/month` after a 14-day trial
- Business: `PHP 2,199/month` after a 14-day trial

## Build

```bash
npm run build
```

The production files are generated in `dist/`.

## Included

- Checkout/register flow
- Product inventory, editing, stock adjustments, and deletion
- Customer records, editing, and deletion
- Sales history with refund handling
- User roles: owner, manager, cashier
- Plan/license shell with offline grace period
- Backup and restore using JSON files
- Sales CSV export
- Offline app shell caching
- Branded POS inc interface

## Still Needed Before Selling Broadly

- Hosted backend authentication
- PayPal subscriptions/payment links and webhooks
- PayPal Starter/Pro/Business plan IDs with 14-day trial billing cycles
- Server-signed license tokens
- Cloud sync and conflict handling
- Receipt printer and cash drawer integrations
- Postgres database migrations
- Automated tests
- Hosted domain and SSL

This app is now a strong single-device offline product foundation. The next production step is adding the backend so licenses, payments, and cloud backups cannot be modified from the browser.
