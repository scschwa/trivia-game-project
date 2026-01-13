# Live Trivia Game

A production-ready live trivia game web application with real-time play, timers, scoring, and persistence.

## Features

- **Host-controlled game flow**: Create trivia configs, start games with a PIN, control question progression
- **Team play**: Teams join via QR code or game code, select answers in real-time
- **Server-authoritative timers**: Reading delay + answering period with auto-advance
- **Real-time leaderboards**: Horizontal bar charts with 1st/1st/3rd tie rankings
- **Persistent history**: All games saved with full answer history and statistics
- **Reconnection support**: Teams can rejoin after disconnection with JWT tokens

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database**: Prisma ORM, SQLite (dev), PostgreSQL (production)
- **Real-time**: Socket.IO (separate server for Vercel compatibility)
- **Charts**: Recharts
- **Validation**: Zod
- **Auth**: bcrypt (PIN hashing), jose (JWT tokens)

## Project Structure

```
trivia-game/
├── prisma/                    # Database schema
├── socket-server/             # Separate Socket.IO server
│   ├── src/
│   │   ├── index.ts          # Express + Socket.IO setup
│   │   ├── timer-manager.ts  # Game timers and state
│   │   └── types.ts          # Shared types
│   └── package.json
├── src/
│   ├── actions/              # Server actions
│   ├── app/                  # Next.js pages
│   ├── components/           # React components
│   ├── hooks/                # Custom hooks
│   ├── lib/                  # Core libraries
│   └── types/                # TypeScript types
└── package.json
```

## Local Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Setup

1. **Clone and install dependencies**

```bash
cd trivia-game
npm install

cd socket-server
npm install
cd ..
```

2. **Set up environment variables**

```bash
# Main app
cp .env.example .env.local

# Socket server
cp socket-server/.env.example socket-server/.env.local
```

Edit `.env.local`:
```env
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
JWT_SECRET="your-dev-secret-key-at-least-32-chars"
```

Edit `socket-server/.env.local`:
```env
DATABASE_URL="../prisma/dev.db"
PORT=3001
CORS_ORIGIN="http://localhost:3000"
JWT_SECRET="your-dev-secret-key-at-least-32-chars"
```

3. **Initialize the database**

```bash
npx prisma db push
```

4. **Start both servers**

Terminal 1 (Next.js):
```bash
npm run dev
```

Terminal 2 (Socket.IO):
```bash
cd socket-server
npm run dev
```

5. **Open the app**

Visit http://localhost:3000

## CSV Format

Upload trivia questions in CSV format with these columns:

| Column | Description | Required |
|--------|-------------|----------|
| round | Round number (sequential starting from 1) | Yes |
| question | Question number within round (sequential from 1) | Yes |
| question_text | The question to display | Yes |
| option_a | Answer option A | Yes |
| option_b | Answer option B | Yes |
| option_c | Answer option C | Yes |
| option_d | Answer option D | Yes |
| correct_answer | Correct option (A, B, C, or D) | Yes |
| points | Points for correct answer (default: 10) | No |
| time_seconds | Time to answer in seconds (default: 30) | No |

Example:
```csv
roundNumber, questionNumber, question, answerA, answerB, answerC, answerD, correctAnswer, points (optional)
1,1,What is the capital of France?,London,Berlin,Paris,Madrid,C,10
1,2,Which planet is known as the Red Planet?,Venus,Mars,Jupiter,Saturn,B,10
2,1,Who painted the Mona Lisa?,Van Gogh,Da Vinci,Picasso,Rembrandt,B,20
```

## Game Flow

1. **Host**: Upload CSV → Create config → Start game with PIN
2. **Teams**: Scan QR code or enter game code → Enter team name → Ready up
3. **Host**: Start game when teams are ready
4. **Game loop**:
   - Reading delay (3 seconds) - question shown on presenter
   - Answering period - teams submit answers on their devices
   - Time up - show correct answer
   - Next question or Score Round
5. **End**: View final leaderboard and statistics

---

## Production Deployment

### Architecture Overview

Due to Vercel's lack of WebSocket support, we use a hybrid deployment:

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│                 │     │                  │     │                  │
│     Vercel      │     │     Railway      │     │    Supabase      │
│   (Next.js)     │────▶│  (Socket.IO)     │────▶│   (Postgres)     │
│                 │     │                  │     │                  │
└─────────────────┘     └──────────────────┘     └──────────────────┘
       ▲                         ▲
       │                         │
       └────────┬────────────────┘
                │
         ┌──────┴──────┐
         │   Browser   │
         └─────────────┘
```

### Step 1: Set Up Supabase (Database)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **Settings → Database** and copy the connection string
3. Replace `[YOUR-PASSWORD]` with your database password
4. Save this for later - it's your `DATABASE_URL`

### Step 2: Deploy Socket.IO Server to Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Create a new project → **Deploy from GitHub repo**
3. Point to the `socket-server` directory (or deploy as a subdirectory)
4. Set environment variables:

```
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
PORT=3001
CORS_ORIGIN=https://your-app.vercel.app
JWT_SECRET=your-production-secret-min-32-chars
```

5. Railway will auto-deploy and give you a URL like `https://trivia-socket.up.railway.app`

### Step 3: Deploy Next.js to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Set the root directory to `trivia-game` if it's in a subdirectory
4. Set environment variables:

```
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
NEXT_PUBLIC_SOCKET_URL=https://trivia-socket.up.railway.app
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
JWT_SECRET=your-production-secret-min-32-chars
```

5. Deploy!

### Step 4: Initialize Production Database

After deploying, run:

```bash
DATABASE_URL="your-supabase-connection-string" npx prisma db push
```

Or in Vercel, add a build command:
```bash
prisma generate && prisma db push && next build
```

---

## GoDaddy DNS Configuration

### Adding a Custom Domain to Vercel

1. In Vercel project settings → **Domains** → Add your domain
2. Vercel will show you DNS records to configure

### Configure GoDaddy DNS

1. Log into [GoDaddy](https://godaddy.com) → **My Products** → **DNS**
2. Delete any existing A records for @ or www
3. Add these records:

**For apex domain (example.com):**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | 76.76.21.21 | 600 |

**For www subdomain:**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | www | cname.vercel-dns.com | 600 |

4. Wait 5-15 minutes for DNS propagation

### Troubleshooting "Invalid Configuration" Error

If Vercel shows "Invalid Configuration":

1. **Check DNS propagation**: Visit [dnschecker.org](https://dnschecker.org) and check your domain
2. **Clear Vercel's DNS cache**: Remove the domain from Vercel, wait 5 min, re-add it
3. **Check for conflicting records**: Remove any other A or CNAME records for @ or www
4. **Wait longer**: GoDaddy can take up to 48 hours (usually 15-30 min)

### SSL Certificate

Vercel automatically provisions SSL certificates. If you see SSL warnings:
1. Wait 10-15 minutes after DNS propagates
2. Check that your domain shows "Valid Configuration" in Vercel

---

## Optional: Rate Limiting with Upstash Redis

For production, add rate limiting to prevent abuse:

1. Create an account at [upstash.com](https://upstash.com)
2. Create a new Redis database
3. Copy the REST URL and token
4. Add to your environment:

```env
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

The Socket.IO server already includes basic in-memory rate limiting (10 events/second).

---

## Environment Variables Reference

### Next.js App (.env.local)

| Variable | Description | Example |
|----------|-------------|---------|
| DATABASE_URL | Prisma connection string | `postgresql://...` |
| NEXT_PUBLIC_SOCKET_URL | Socket.IO server URL | `https://socket.example.com` |
| NEXT_PUBLIC_APP_URL | This app's public URL | `https://trivia.example.com` |
| JWT_SECRET | Secret for JWT tokens (32+ chars) | `super-secret-key...` |

### Socket.IO Server (socket-server/.env.local)

| Variable | Description | Example |
|----------|-------------|---------|
| DATABASE_URL | Prisma connection string | `postgresql://...` |
| PORT | Server port | `3001` |
| CORS_ORIGIN | Allowed CORS origin | `https://trivia.example.com` |
| JWT_SECRET | Same as Next.js app | `super-secret-key...` |

---

## Troubleshooting

### "Cannot connect to game server"

- Check that the Socket.IO server is running
- Verify `NEXT_PUBLIC_SOCKET_URL` is correct
- Check browser console for CORS errors
- Ensure `CORS_ORIGIN` in socket server matches your app URL

### "Database connection failed"

- Verify `DATABASE_URL` is correct
- For Supabase, ensure you're using the connection string (not the API URL)
- Check that your IP is allowed in Supabase network settings

### Teams can't reconnect

- Ensure `JWT_SECRET` is identical in both servers
- Check that the reconnect token is stored in localStorage
- Tokens expire after 24 hours

### Timer sync issues

- Timers are server-authoritative
- Client calculates remaining time from server timestamps
- If clocks are very different, there may be small discrepancies

---

## License

MIT

