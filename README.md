# POS inc

Offline-first point-of-sale system for small businesses.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

Frontend environment variable for deployed builds:

```env
VITE_API_URL=https://pos-inc.onrender.com
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

The backend stores data in `backend/data/pos-inc.json` by default for local development. For Supabase, set `DATABASE_URL` on the backend service to the Supabase Postgres URI:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.rmpjjfuyjpfuwwhivedx.supabase.co:5432/postgres
DATABASE_SSL=true
```

You can find the URI in Supabase under Project Settings > Database > Connection string > URI. The backend creates the required tables on startup.

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
