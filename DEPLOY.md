# CardPulse — Deploy Guide

## Prerequisites
- Node.js 20+
- Vercel account (free) → vercel.com
- Supabase account (free) → supabase.com
- Stripe account → stripe.com

---

## Step 1 — Supabase Setup (10 min)

1. Create new project at supabase.com
2. Go to **SQL Editor** → paste entire contents of `supabase/migrations/001_schema.sql` → Run
3. Go to **Settings → API** → copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`
4. Go to **Authentication → Providers → Google** → enable it (optional but recommended)

---

## Step 2 — Stripe Setup (10 min)

1. Create account at stripe.com
2. Go to **Developers → API keys** → copy publishable + secret keys
3. Go to **Products** → Create 4 prices:
   - Pro Monthly: $9.99/month recurring
   - Pro Yearly: $79/year recurring
   - Business Monthly: $19.99/month recurring
   - Business Yearly: $159/year recurring
4. Copy each Price ID (starts with `price_...`)
5. Go to **Developers → Webhooks** → Add endpoint:
   - URL: `https://YOUR-DOMAIN.vercel.app/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`

---

## Step 3 — Anthropic API Key (2 min)

1. Go to console.anthropic.com → API Keys → Create key
2. Copy → `ANTHROPIC_API_KEY`

---

## Step 4 — Deploy to Vercel (5 min)

```bash
# Install dependencies
npm install

# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (first time — will ask questions, say yes to defaults)
vercel

# Set all environment variables in Vercel dashboard
# Project → Settings → Environment Variables
# Add every key from .env.local
```

Or connect GitHub repo to Vercel for auto-deploys on every push.

---

## Step 5 — Set NEXT_PUBLIC_APP_URL

In Vercel dashboard → Environment Variables:
```
NEXT_PUBLIC_APP_URL = https://your-project.vercel.app
```

Then redeploy: `vercel --prod`

---

## Step 6 — Test the flow

1. Visit your Vercel URL
2. Sign up with email
3. Go to Billing → upgrade to Pro (use Stripe test card: 4242 4242 4242 4242)
4. Confirm subscription_status = 'active' in Supabase → profiles table

---

## Local Development

```bash
npm install
cp .env.example .env.local
# Fill in .env.local with your keys
npm run dev
# → http://localhost:3000
```

For Stripe webhooks locally:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## File Structure

```
app/
  page.tsx              ← Landing page
  dashboard/
    page.tsx            ← Main dashboard
    billing/page.tsx    ← Subscription management
    inventory/          ← (stub, expand next)
    transactions/       ← (stub)
    pnl/               ← (stub)
    tax/               ← (stub)
    tools/             ← (stub)
    journal/           ← (stub)
  api/
    webhooks/stripe/   ← Stripe webhook handler
    checkout/          ← Create Stripe checkout session
    billing-portal/    ← Open Stripe billing portal
    scan/              ← Claude card scanner (Pro+)
  auth/
    login/             ← Email + Google login
    signup/            ← Registration
    callback/          ← OAuth callback

lib/
  supabase/            ← Client, server, middleware
  stripe/              ← Stripe client + plan config
  utils.ts             ← Shared helpers

supabase/
  migrations/          ← Full DB schema with RLS
```

---

## Next Phase (after testing)

Port each stub page from the CardPulse artifact:
1. Inventory tab → `app/dashboard/inventory/page.tsx`
2. Transactions → pull from Supabase, write mutations
3. P&L, Tax, Tools, Journal — same pattern

Each page fetches server-side in the layout, passes to a `'use client'` component for interactivity.
