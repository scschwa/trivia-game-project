# Trivia Game - Complete Deployment Guide

This guide walks you through deploying the Trivia Game application from scratch, including setting up the database, deploying the servers, and configuring your GoDaddy domain.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Production Database (Supabase)](#production-database-supabase)
4. [Deploy Socket.IO Server (Railway)](#deploy-socketio-server-railway)
5. [Deploy Next.js App (Vercel)](#deploy-nextjs-app-vercel)
6. [Configure GoDaddy Domain](#configure-godaddy-domain)
7. [Final Testing](#final-testing)
8. [Maintenance & Updates](#maintenance--updates)

---

## Prerequisites

Before starting, ensure you have:

- **Node.js 18+** installed ([download](https://nodejs.org/))
- **Git** installed ([download](https://git-scm.com/))
- **GitHub account** (for deployment integrations)
- **GoDaddy account** with a domain you want to use
- **Credit card** (Railway requires payment info, but has a free tier)

---

## Local Development Setup

### Step 1: Clone and Install

```bash
# Clone the repository (or navigate to your existing folder)
cd trivia-game-project

# Install main app dependencies
npm install

# Install socket server dependencies
cd socket-server
npm install
cd ..
```

### Step 2: Create Environment Files

**Main app** - Create `.env.local` in the project root:

```env
# For local dev, use Supabase directly (or a local PostgreSQL)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
JWT_SECRET="local-dev-secret-key-minimum-32-characters-long"
```

**Socket server** - Create `.env` in `socket-server/`:

```env
# Use the same Supabase connection as main app
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
PORT=3001
CORS_ORIGIN="http://localhost:3000"
JWT_SECRET="local-dev-secret-key-minimum-32-characters-long"
```

> 💡 **Note**: Both services use PostgreSQL. Set up Supabase first (see next section), then come back to complete local setup.

### Step 3: Initialize Database

```bash
# Generate Prisma client for main app
npx prisma generate

# Create/update database tables (uses Supabase)
npx prisma db push

# Generate Prisma client for socket server
cd socket-server
npx prisma generate
cd ..
```

### Step 4: Test Locally

**Terminal 1** - Start Next.js:
```bash
npm run dev
```

**Terminal 2** - Start Socket.IO server:
```bash
cd socket-server
npm run dev
```

**Terminal 3** - Open browser:
- Visit http://localhost:3000
- Create a trivia config, start a game, join from another browser tab

If everything works locally, proceed to production deployment.

---

## Production Database (Supabase)

We'll use Supabase for a free PostgreSQL database.

### Step 1: Create Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click **Start your project** and sign up with GitHub
3. Click **New Project**
4. Fill in:
   - **Name**: `trivia-game` (or your preference)
   - **Database Password**: Generate a strong password and **SAVE IT**
   - **Region**: Choose closest to your users
5. Click **Create new project** (takes 2-3 minutes)

### Step 2: Get Connection String

1. In your Supabase project, go to **Settings** (gear icon) → **Database**
2. Scroll to **Connection string** section
3. Select **URI** tab
4. Copy the connection string - it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with the password you saved
6. **Save this connection string** - you'll need it for both Railway and Vercel

### Step 3: Configure Connection Pooling (Recommended)

1. In Supabase, go to **Settings** → **Database**
2. Scroll to **Connection Pooling**
3. Copy the **Pooler connection string** (port 6543)
4. This is better for serverless deployments

Your final DATABASE_URL should look like:
```
postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

---

## Deploy Socket.IO Server (Railway)

Railway provides easy deployment for the Socket.IO server with WebSocket support.

### Step 1: Push Code to GitHub

If not already on GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/trivia-game.git
git push -u origin main
```

### Step 2: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Click **Login** → **Login with GitHub**
3. Authorize Railway

### Step 3: Create New Project

1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Find and select your `trivia-game` repository
4. Railway will detect it - click **Deploy Now**

### Step 4: Configure Socket Server

Railway will try to deploy the whole repo. We need to configure it for just the socket-server:

1. Click on your deployment
2. Go to **Settings** tab
3. Under **Build**, set:
   - **Root Directory**: `socket-server`
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `npm start`

### Step 5: Add Environment Variables

1. Go to **Variables** tab
2. Click **+ New Variable** for each:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Supabase connection string |
| `PORT` | `3001` |
| `CORS_ORIGIN` | `https://your-app.vercel.app` (update after Vercel deploy) |
| `JWT_SECRET` | Generate a 32+ character secret |

> 💡 **Tip**: Generate a secure secret with: `openssl rand -base64 32`

### Step 6: Get Railway URL

1. Go to **Settings** → **Networking**
2. Click **Generate Domain**
3. Railway will create a URL like: `trivia-socket-production.up.railway.app`
4. **Save this URL** - you'll need it for Vercel

### Step 7: Verify Deployment

1. Check the **Deployments** tab for build logs
2. Visit `https://your-railway-url.up.railway.app/health`
3. You should see: `{"status":"ok","timestamp":"..."}`

---

## Deploy Next.js App (Vercel)

### Step 1: Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Click **Sign Up** → **Continue with GitHub**
3. Authorize Vercel

### Step 2: Import Project

1. Click **Add New...** → **Project**
2. Find your `trivia-game` repository
3. Click **Import**

### Step 3: Configure Project

1. **Framework Preset**: Next.js (auto-detected)
2. **Root Directory**: Leave empty (project root)
3. **Build Command**: `npx prisma generate && npm run build`
4. **Install Command**: `npm install`

### Step 4: Add Environment Variables

Click **Environment Variables** and add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Supabase connection string |
| `NEXT_PUBLIC_SOCKET_URL` | Your Railway URL (e.g., `https://trivia-socket-production.up.railway.app`) |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` (update after first deploy) |
| `JWT_SECRET` | Same secret as Railway |

### Step 5: Deploy

1. Click **Deploy**
2. Wait for build to complete (2-3 minutes)
3. Vercel will give you a URL like: `trivia-game.vercel.app`

### Step 6: Update Environment Variables

Now that you have both URLs, update:

**In Vercel:**
- `NEXT_PUBLIC_APP_URL` → `https://trivia-game.vercel.app` (your actual Vercel URL)

**In Railway:**
- `CORS_ORIGIN` → `https://trivia-game.vercel.app` (your actual Vercel URL)

Redeploy both after updating.

### Step 7: Initialize Production Database

After first deploy, the database tables need to be created:

**Option A - Using Vercel CLI:**
```bash
npm install -g vercel
vercel env pull .env.production
DATABASE_URL="your-supabase-url" npx prisma db push
```

**Option B - Modify Build Command:**

In Vercel project settings, change build command to:
```bash
npx prisma generate && npx prisma db push && npm run build
```

Then trigger a redeploy.

---

## Configure GoDaddy Domain

### Step 1: Add Domain in Vercel

1. In Vercel, go to your project → **Settings** → **Domains**
2. Enter your domain: `yourdomain.com`
3. Click **Add**
4. Vercel will show you the DNS records needed

### Step 2: Configure GoDaddy DNS

1. Log into [GoDaddy](https://godaddy.com)
2. Go to **My Products** → Find your domain → **DNS**
3. **Delete existing records** for `@` and `www` (A records and CNAMEs)

### Step 3: Add Vercel DNS Records

**For apex domain (yourdomain.com):**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | `76.76.21.21` | 600 |

**For www subdomain:**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | www | `cname.vercel-dns.com` | 600 |

### Step 4: Verify in Vercel

1. Go back to Vercel → **Settings** → **Domains**
2. Wait 5-15 minutes for DNS propagation
3. Status should change to **Valid Configuration**
4. Vercel automatically provisions SSL certificate

### Step 5: Update Environment Variables

Update `NEXT_PUBLIC_APP_URL` in Vercel:
```
https://yourdomain.com
```

Update `CORS_ORIGIN` in Railway:
```
https://yourdomain.com
```

Redeploy both services.

### Step 6: (Optional) Subdomain for Socket Server

If you want a custom subdomain for the socket server (e.g., `socket.yourdomain.com`):

1. In Railway, go to **Settings** → **Networking** → **Custom Domain**
2. Add: `socket.yourdomain.com`
3. In GoDaddy, add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | socket | `your-railway-url.up.railway.app` | 600 |

4. Update `NEXT_PUBLIC_SOCKET_URL` in Vercel to `https://socket.yourdomain.com`

---

## Final Testing

### Test Checklist

- [ ] **Homepage loads** at your custom domain
- [ ] **Create Trivia Config**: Upload CSV, create config
- [ ] **Start Game**: Generate game code and PIN
- [ ] **Join as Team**: Open `/play/GAMECODE` on another device/browser
- [ ] **Team naming**: Enter name and click Ready
- [ ] **Host sees team**: Lobby shows connected teams
- [ ] **Start game**: Questions display on host
- [ ] **Answer questions**: Timer works, answers submit
- [ ] **Score round**: Leaderboard displays correctly
- [ ] **Final results**: End game shows winner and stats
- [ ] **Reconnection**: Refresh team page, should auto-reconnect

### Common Issues

**"Cannot connect to game server"**
- Check Railway logs for errors
- Verify `CORS_ORIGIN` matches your Vercel domain exactly
- Ensure Railway is deployed and healthy

**"Database error"**
- Verify `DATABASE_URL` is identical in both Vercel and Railway
- Check Supabase is active and not paused
- Run `npx prisma db push` with production DATABASE_URL

**SSL certificate issues**
- Wait 15-30 minutes after DNS propagation
- Check domain shows "Valid Configuration" in Vercel

---

## Maintenance & Updates

### Pushing Updates

```bash
git add .
git commit -m "Your update message"
git push origin main
```

Both Vercel and Railway auto-deploy on push to main branch.

### Database Migrations

If you change `schema.prisma`:

```bash
# Generate migration
npx prisma migrate dev --name description_of_change

# Push to production
DATABASE_URL="your-supabase-url" npx prisma migrate deploy
```

### Monitoring

- **Vercel**: Check Functions logs in project dashboard
- **Railway**: Check logs in deployment panel
- **Supabase**: Check database size and connections

### Costs

| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| Supabase | 500MB database, 2 projects | $25/mo |
| Railway | $5 credit/month | Pay as you go |
| Vercel | 100GB bandwidth, unlimited deploys | $20/mo |

For a small trivia game, you should stay within free tiers.

---

## Quick Reference

| Service | URL | Purpose |
|---------|-----|---------|
| Your App | `https://yourdomain.com` | Main trivia app |
| Socket Server | `https://xxx.up.railway.app` | Real-time WebSocket |
| Database | Supabase Dashboard | PostgreSQL database |
| Vercel Dashboard | `vercel.com/dashboard` | Next.js hosting |
| Railway Dashboard | `railway.app/dashboard` | Socket server hosting |

---

## Support

If you encounter issues:

1. Check the [Troubleshooting section in README.md](./README.md#troubleshooting)
2. Review logs in Vercel and Railway dashboards
3. Test locally first to isolate production issues

Good luck with your trivia nights! 🎉🧠
