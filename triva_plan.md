## Plan: Real-time Trivia Game Web App (Final)

Build a full-stack trivia game with Next.js on Vercel, Socket.IO server on Railway (free tier), Supabase PostgreSQL (free tier), and Upstash Redis for rate limiting. Total cost: **$0/month** within free tier limits. Custom state machine, QR codes with embedded game codes, and easy GoDaddy DNS integration.

---

### Steps

1. **Initialize project & Prisma schema**  
   Create `trivia-game/` with two deployable units: `/` (Next.js app) and `/socket-server/` (Express + Socket.IO). Prisma schema defines `TriviaConfig`, `GameSession`, `Team`, `Answer` models with `GameStatus` enum. Custom state machine in `lib/game/state-machine.ts` handles transitions with validation guards. Connect to Supabase Postgres via `DATABASE_URL` connection string.

2. **Set up free-tier services**  
   - **Supabase**: Create project → copy Postgres connection string (use "Transaction" pooler URL for Vercel serverless)  
   - **Upstash**: Create Redis database → copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`  
   - **Railway**: Create project from `/socket-server/` folder (500 free hours/month)  
   - **Vercel**: Import main repo (unlimited hobby deployments)

3. **Implement server actions with validation**  
   - `actions/config.ts`: CSV parsing with `papaparse`, Zod validation returning `{ valid, errors: [{row, column, message}] }`, persist only if valid  
   - `actions/game.ts`: Generate 6-char code (exclude `0O1lI`), bcrypt host PIN, create Supabase records  
   - `actions/team.ts`: Generate reconnect token, set httpOnly cookie, enforce name lock after ready  
   - `actions/answer.ts`: Atomic insert with `WHERE answeredAt IS NULL` guard, record response time  
   - Rate limit API routes with `@upstash/ratelimit` (10 joins/minute per IP)

4. **Build Socket.IO server**  
   Express server in `/socket-server/` with shared Prisma client. Events: `JOIN_GAME`, `TEAM_READY`, `SUBMIT_ANSWER`, `HOST_REVEAL_QUESTION`, `HOST_PAUSE`, `HOST_RESUME`, `HOST_SCORE_ROUND`, `SESSION_STATE`, `TIMER_SYNC`. Custom rate limit middleware (5 events/second per socket). Timer logic with `setInterval` broadcasting every 500ms, auto-advance on `remainingMs <= 0`.

5. **Build Host UI**  
   - `/host/create`: Drag-drop CSV upload with `react-dropzone`, error table highlighting invalid cells, preview valid questions, "Save Config" button  
   - `/host/start`: Dropdown of saved configs, game code + PIN inputs, QR code preview (`qrcode.react`) encoding `https://yourdomain.com/?code=ABC123`  
   - `/host/[gameId]/presenter`: Fullscreen view with progress bars, question card, 15s reading overlay → answer countdown, keyboard shortcuts (Space/P/S), "Score Round" button (irreversible with confirmation)

6. **Build Team UI**  
   - `/`: Game code input with `?code=` auto-fill from QR, "Join Game" button  
   - `/play/[gameCode]`: Editable team name → "Ready" button locks it, large A/B/C/D buttons with highlight, "Submit" → modal "Lock in C. Paris?", answer history accordion with ✓/✗ after round scored, auto-reconnect on page refresh via stored token

7. **Build Scoreboard with Recharts**  
   - `/scoreboard`: Grid of past game cards (date, winner, team count) fetched via server component  
   - `/scoreboard/[gameId]`: Horizontal `<BarChart>` sorted by score descending, tie ranking (1st/1st/3rd), per-round breakdown table

8. **Deploy & configure GoDaddy DNS**  
   Follow deployment guide below. Total setup time: ~30 minutes.

---

### Deployment Guide (Step-by-Step)

#### Step 1: Create Supabase Database (5 min)
1. Go to [supabase.com](https://supabase.com) → New Project  
2. Name: `trivia-game`, set database password, select region closest to users  
3. Wait for provisioning → Settings → Database → Connection String  
4. Copy **"Transaction" connection pooler** URI (starts with `postgresql://postgres.[ref]:...@aws-0-...pooler.supabase.com:6543/postgres`)  
5. Replace `[YOUR-PASSWORD]` in the URI with your database password

#### Step 2: Create Upstash Redis (3 min)
1. Go to [upstash.com](https://upstash.com) → Create Database  
2. Name: `trivia-ratelimit`, select region, enable TLS  
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

#### Step 3: Deploy Socket Server to Railway (5 min)
1. Push code to GitHub  
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub  
3. Select repo, set root directory to `/socket-server`  
4. Add environment variables:
   ```
   DATABASE_URL=<supabase-connection-string>
   CORS_ORIGIN=https://yourdomain.com
   PORT=3001
   ```
5. Deploy → copy generated URL (e.g., `trivia-socket.up.railway.app`)

#### Step 4: Deploy Next.js to Vercel (5 min)
1. Go to [vercel.com](https://vercel.com) → Import Git Repository  
2. Select repo (root directory `/`)  
3. Override build command:
   ```
   npx prisma generate && npx prisma db push && next build
   ```
4. Add environment variables:
   ```
   DATABASE_URL=<supabase-connection-string>
   DIRECT_URL=<supabase-direct-connection-string>
   NEXT_PUBLIC_SOCKET_URL=https://trivia-socket.up.railway.app
   UPSTASH_REDIS_REST_URL=<from-step-2>
   UPSTASH_REDIS_REST_TOKEN=<from-step-2>
   JWT_SECRET=<run: openssl rand -base64 32>
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   ```
5. Deploy → get preview URL (e.g., `trivia-game.vercel.app`)

#### Step 5: Configure GoDaddy DNS (10 min)
1. **In Vercel**: Project → Settings → Domains → Add `yourdomain.com` + `www.yourdomain.com`  
2. Vercel displays required DNS values:
   - A Record: `76.76.21.21` (may vary—use exactly what Vercel shows)  
   - CNAME: `cname.vercel-dns.com`  
3. **In GoDaddy**: My Products → DNS → Manage  
4. **Delete conflicting records**:
   - Remove any A records for `@` (including parked page IPs like `34.102.136.180`)  
   - Remove any CNAME for `www`  
   - Check Forwarding section → delete any forwards  
5. **Add new records**:
   | Type | Name | Value | TTL |
   |------|------|-------|-----|
   | A | @ | 76.76.21.21 | 600 |
   | CNAME | www | cname.vercel-dns.com | 600 |
6. Wait 5-30 minutes → click "Verify" in Vercel  
7. Vercel auto-provisions SSL certificate

#### Troubleshooting: "Invalid Configuration"
| Symptom | Cause | Fix |
|---------|-------|-----|
| Vercel shows "Invalid Configuration" | Conflicting A records | Delete ALL A records for @, re-add only Vercel IP |
| Domain shows GoDaddy parked page | Parking enabled | Domain Settings → Parking → Disable |
| DNS not propagating | Cache | Run `ipconfig /flushdns`, wait 30 min, check via [dnschecker.org](https://dnschecker.org) |
| SSL error after verify | Too soon | Wait 10 min for Let's Encrypt provisioning |

#### Step 6: Run Prisma Migration (2 min)
```bash
# Locally, with DATABASE_URL set:
npx prisma migrate deploy
```
Or trigger via Vercel redeploy (build command runs `db push`).

---

### Cost Summary

| Service | Free Tier | Your Usage | Cost |
|---------|-----------|------------|------|
| Supabase | 500MB DB, 1GB transfer | Small games | $0 |
| Upstash Redis | 10K commands/day | Rate limiting | $0 |
| Railway | 500 hours/month, 512MB RAM | Socket server | $0 |
| Vercel | Unlimited static, 100GB bandwidth | Next.js app | $0 |
| GoDaddy | (Your existing domain) | DNS only | $0 extra |

**Total: $0/month** for hobby/small-scale usage. Scales to paid tiers if needed.

---

### Further Consideration

1. **Custom subdomain vs apex?** Deploy to `trivia.yourdomain.com` (simpler CNAME-only setup) or `yourdomain.com` (requires A record)? *If your main GoDaddy site is already on the apex domain, use a subdomain like `play.yourdomain.com` to avoid conflicts.*

