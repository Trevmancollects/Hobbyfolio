# CardPulse — Setup Guide (30 minutes)

## Prerequisites
- A computer (Mac or PC)
- Google Chrome browser

---

## Step 1 — Install VS Code
1. Go to https://code.visualstudio.com
2. Download + install
3. Open VS Code

## Step 2 — Install Node.js
1. Go to https://nodejs.org
2. Download the LTS version (green button)
3. Install it
4. Open VS Code → Terminal → New Terminal
5. Type: node --version
6. Should show v20 or higher

## Step 3 — Open the project
1. In VS Code: File → Open Folder → select the unzipped "cardpulse" folder
2. You should see all the project files in the left sidebar

## Step 4 — Install dependencies
In the VS Code terminal at the bottom, type:
```
npm install
```
Wait 1-2 minutes until it finishes.

## Step 5 — Create a Supabase project
1. Go to https://supabase.com → Sign up (free)
2. Click "New Project"
3. Name: cardpulse
4. Set a database password (save it somewhere)
5. Region: pick the closest to you
6. Click "Create new project"
7. Wait 2 minutes for it to provision

## Step 6 — Run the database schema
1. In Supabase, click "SQL Editor" in the left sidebar
2. Click "New query"
3. In VS Code, open the file: supabase/migrations/001_schema.sql
4. Select all (Cmd+A), copy (Cmd+C)
5. Paste into the SQL Editor in Supabase
6. Click "Run"
7. You should see "Success. No rows returned."

## Step 7 — Get your Supabase keys
1. In Supabase, click "Settings" (gear icon, bottom left)
2. Click "API" in the Settings menu
3. Copy these three values:
   - Project URL (looks like https://abcxyz.supabase.co)
   - anon/public key (starts with eyJ...)
   - service_role key (click eye icon to reveal, starts with eyJ...)

## Step 8 — Create your .env.local file
1. In VS Code, click the New File icon next to "cardpulse" in the sidebar
2. Name it exactly: .env.local
3. Paste this and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
ANTHROPIC_API_KEY=
```

4. Save (Cmd+S)

## Step 9 — Test locally
In the VS Code terminal:
```
npm run dev
```
Open Chrome → go to http://localhost:3000
You should see the CardPulse landing page.
Click "Start Free" → create an account → you should land on the dashboard.

## Step 10 — Deploy to Vercel (makes it live on the internet)
1. Go to https://vercel.com → Sign up with GitHub
2. Push your cardpulse folder to a GitHub repository:
   - Go to https://github.com → New Repository → name it "cardpulse"
   - In VS Code terminal:
   ```
   git init
   git add .
   git commit -m "initial"
   git remote add origin https://github.com/YOUR-USERNAME/cardpulse.git
   git push -u origin main
   ```
3. Back in Vercel: "Add New Project" → Import your "cardpulse" repo
4. In the Environment Variables section, add every key from your .env.local
5. Change NEXT_PUBLIC_APP_URL to your Vercel URL (shown after deploy)
6. Click "Deploy"
7. Wait 1-2 minutes → your site is live at https://cardpulse-xxx.vercel.app

## Step 11 — Set up Stripe (for paid subscriptions — can do later)
1. Go to https://stripe.com → create account
2. Developers → API Keys → copy publishable + secret keys
3. Create 4 products:
   - Pro Monthly: $9.99/month
   - Pro Yearly: $79/year  
   - Business Monthly: $19.99/month
   - Business Yearly: $159/year
4. Copy each price ID into your Vercel environment variables
5. Set up webhook at: https://your-site.vercel.app/api/webhooks/stripe

---

## Troubleshooting

**"npm install" fails**: Make sure Node.js is installed. Run "node --version" first.

**Can't see .env.local**: On Mac, press Cmd+Shift+. to show hidden files. Or create it in VS Code.

**"Failed to fetch" error**: Your Supabase URL or keys are wrong in .env.local. Double-check them.

**Login doesn't work**: Make sure you ran the SQL schema in Step 6. Check Supabase → Authentication → Users to see if the account was created.

**Deploy fails on Vercel**: Check that all environment variables are set. The build log will tell you what's wrong.
