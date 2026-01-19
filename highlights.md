# 🎯 Trivia Game Codebase Analysis

## A. Lines of Code by Language

| Language | Lines | Files | Purpose |
|----------|------:|------:|---------|
| **TypeScript/TSX** | 7,819 | 46 | Application logic, React components, API |
| **CSS** | 4,846 | 2+ | Styling (Tailwind + custom) |
| **Prisma Schema** | ~290 | 2 | Database models (main + socket-server) |
| **JSON Config** | 327 | 6 | Package configs, TypeScript config |
| **Documentation** | 709 | 4+ | README, deployment guide, planning |
| **Total** | **~14,000** | ~60 | |

---

## B. Dependencies

### Frontend (Next.js App) - 18 Production Dependencies

| Category | Packages |
|----------|----------|
| **Framework** | `next` (14.1), `react` (18.2), `react-dom` |
| **Database** | `@prisma/client` (5.10) |
| **UI Components** | `lucide-react` (icons), `recharts` (charts), `qrcode.react` |
| **Forms & Validation** | `react-hook-form`, `@hookform/resolvers`, `zod` |
| **File Handling** | `papaparse` (CSV), `react-dropzone` |
| **Real-time** | `socket.io-client` |
| **Auth/Security** | `bcrypt`, `jose` (JWT) |
| **Styling** | `tailwind-merge`, `clsx` |
| **Rate Limiting** | `@upstash/ratelimit`, `@upstash/redis` |

### Socket Server - 8 Production Dependencies

| Category | Packages |
|----------|----------|
| **Server** | `express`, `socket.io`, `cors` |
| **Database** | `@prisma/client` |
| **Auth** | `bcrypt`, `jose` |
| **Config** | `dotenv` |
| **Validation** | `zod` |

---

## C. Workflow & Architecture

### System Architecture (3-Tier)

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Host View   │    │ Player View │    │ Scoreboard  │         │
│  │ (Presenter) │    │  (Mobile)   │    │   (Display) │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          │     WebSocket    │     HTTP/REST    │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SOCKET SERVER (Railway)                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  • Real-time game state management                          ││
│  │  • Server-authoritative timers (500ms sync)                 ││
│  │  • Answer submission & scoring                              ││
│  │  • Team connection/reconnection                             ││
│  └─────────────────────────────────────────────────────────────┘│
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  NEXT.JS APP (Vercel)                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  • Server Actions (game creation, config mgmt)              ││
│  │  • Static pages & SSR                                       ││
│  │  • CSV upload & validation                                  ││
│  └─────────────────────────────────────────────────────────────┘│
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  POSTGRESQL (Supabase)                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  • TriviaConfig (question sets)                             ││
│  │  • GameSession (active games)                               ││
│  │  • Team (players)                                           ││
│  │  • Answer (submissions)                                     ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

| Decision | Rationale |
|----------|-----------|
| **Separate Socket Server** | WebSockets not fully supported on Vercel serverless; Railway provides persistent connections |
| **Server-Authoritative Timers** | Prevents cheating, ensures all players see synchronized countdown |
| **PostgreSQL over SQLite** | Required for serverless deployment (Vercel); Supabase provides connection pooling |
| **Next.js Server Actions** | Type-safe server mutations without building separate REST API |
| **Prisma ORM** | Type-safe database access, shared schema between frontend and socket server |

### Game Flow State Machine

```
LOBBY → READING_DELAY → ANSWERING → [repeat] → ROUND_SCORED → FINISHED
          (10 sec)        (30 sec*)
                              ↓
                           PAUSED
                              ↑
```
*Configurable 10-60 seconds

---

## D. Development Process

### Git Statistics

| Metric | Value |
|--------|-------|
| **Total Commits** | 33 |
| **Development Period** | 5 days (Jan 12-17, 2026) |
| **Lines Inserted** | 23,599 |
| **Lines Deleted** | 264 |
| **Net Lines Added** | ~23,335 |
| **Files Changed** | 146 (cumulative) |

### Commit Breakdown

| Category | Count | Examples |
|----------|------:|----------|
| **Bug Fixes** | 18 (55%) | Timer sync, type fixes, Vercel deployment |
| **Features** | 6 (18%) | Round Answers screen, Hardest Questions, Config time |
| **Infrastructure** | 4 (12%) | Initial commit, PostgreSQL migration, deployment |
| **Documentation** | 3 (9%) | README, deployment guide |
| **Other** | 2 (6%) | Trivia content, UI tweaks |

### Development Velocity

- **Average commits/day**: 6.6
- **Most active area**: Type safety fixes (55% of commits)
- **Pattern**: Rapid feature development → deployment fixes → polish

---

## E. Interesting Facts & Highlights

### 🏗️ Technical Highlights

1. **Clock Skew Compensation** - Timer displays use `serverTime` offset to sync across devices with different clocks

2. **Reconnection Support** - Players get a unique `reconnectToken` stored in localStorage; can rejoin if disconnected

3. **Archive vs Delete** - Configs used in games can only be archived (data integrity), unused configs can be deleted

4. **QR Code Joining** - Generates scannable codes for easy mobile player joining

5. **Keyboard Shortcuts** - Host can control entire game with keyboard (Space, P, N, S, L, Esc)

### 📊 Database Efficiency

- Questions stored as JSON blob (not normalized) - faster reads, simpler schema
- Per-round scores tracked separately for breakdown analytics
- Indexed on frequently queried fields (gameCode, status, createdAt)

### 🎮 Game Features

| Feature | Implementation |
|---------|----------------|
| Configurable timer | 10-60 second slider |
| 7 themed rounds | Geography, Music, History, etc. |
| Hardest Questions analysis | Auto-calculates lowest correct rate |
| Live leaderboard | Updates after each round |
| Response time tracking | Potential for tiebreakers |

### 📱 Multi-Device Experience

- **Host/Presenter**: Large display view with controls
- **Players**: Mobile-optimized answer buttons
- **Scoreboard**: Dedicated display for final results

### 🔒 Security Measures

- Host PIN hashed with bcrypt
- Team reconnect tokens (unique per session)
- Rate limiting on socket events (5/sec)
- Input validation with Zod schemas

---

## Quick Reference Card

```
TECH STACK
├── Frontend: Next.js 14 + React 18 + TypeScript
├── Styling: Tailwind CSS
├── Database: PostgreSQL (Supabase) + Prisma ORM
├── Real-time: Socket.IO
├── Hosting: Vercel (web) + Railway (sockets)
└── Auth: bcrypt + jose (JWT)

CODEBASE
├── 46 TypeScript files
├── ~7,800 lines of application code
├── 4 database models
├── 33 git commits over 5 days
└── 55% commits were bug fixes
```
