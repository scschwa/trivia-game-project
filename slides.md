---
marp: true
theme: enable-all-auto-scaling
auto-scaling: true
paginate: true
backgroundColor: #1e1e2e
color: #cdd6f4
style: |
  section {
    font-family: 'Segoe UI', sans-serif;
  }
  h1 {
    color: #89b4fa;
  }
  h2 {
    color: #a6e3a1;
  }
  table {
    font-size: 0.8em;
    background: #1c274b ; /* Light blue background for whole table */
    color: #333333;            /* Text color */
  }
  code {
    background: #313244;
    color: #f5c2e7;
  }
  pre {
    background: #313244;
  }

  
---

# Building the Trivia Game
## How did I do something I had no business doing in like 6 hours?

**A real-time multiplayer trivia platform, architecture & design overview**

---

# What are some of the Game Features 🎮

| Feature | Implementation |
|---------|----------------|
| Fully configurable games | Questions & answers loaded with a CSV, timer at launch |
| Hardest Questions | Auto-calculates lowest correct rate & displays|
| Live leaderboard | Updates after each round |
| Separate host/player clients | Different UI/UX for each |
| Response time tracking | Potential for tiebreakers |
| Team names | Customizable per team |
| Completely web-based | No downloads, works on any device |
| Guest access | No auth/signup needed, easy QR code |

---

# 🎮 Game Flow State Machine

```
┌───────┐     ┌──────────────┐     ┌───────────┐     ┌───────────┐
│ LOBBY │ --> │ READING_DELAY│ --> │ ANSWERING │ --> │ HOST FEED │
└───────┘     │   (10 sec)   │     │ (10-60s)  │     │ real time │
              └──────────────┘     └─────┬─────┘     └───────────┘
                                         │
                    ┌────────┐           │
                    │ PAUSED │<--------->┤
                    └────────┘           │
                                         ▼
              ┌──────────────┐     ┌───────────┐
              │   FINISHED   │ <-- │  ROUND    │
              └──────────────┘     │  SCORED   │
                                   └───────────┘
```

---

# 🏗️ System Architecture

```
        CLIENTS (Browser)           // Next.js 14 + react 18 + TypeScript
              │                     // Tailwind CSS for styling
    ┌─────────┴─────────┐           // Socket.IO Client for real-time comms
    │                   │
    ▼                   ▼
┌────────────┐    ┌────────────┐
│  Socket    │    │  Next.js   │    // When new features/bugs are pushed:
│  Server    │    │    App     │    // <--- Fed by Github <--- Fed by VSCode
│ (Railway)  │    │  (Vercel)  │
└─────┬──────┘    └─────┬──────┘
      │                 │
      └────────┬────────┘
               ▼
        ┌────────────┐
        │ PostgreSQL │
        │ (Supabase) │
        └────────────┘
```

---

# 🤷 What are these components:  Vercel

![bg right w:600](https://i.imgur.com/4s6Elgm.png)

<style scoped>
    section {
        font-size: 25px;
    }
</style>

- Cloud-based software to deploy and host host modern frontend frameworks and static websites with easily config.
- Provided great feedback on compiler issues when setting up.
- Allowed for multiple environment settings (via config parameters).
- Has a lot of monitoring / environment scaffolding.

---

# 🤷 What are these components:  Railway.app

![bg right w:600](https://i.imgur.com/TkQxzcw.png)

<style scoped>
    section {
        font-size: 25px;
    }
</style>

- Only a portion of the project is deployed here (socket-server).
- A back-end equivalent of Vercel. Allows for auto-scaling with each inbound request of the socket server.
- Database connectivity is pooled, with direct multi-client write/read enabled.
- $5 spend if you have an older github account to link to it.

---

# 🤷 What are these components:  Supabase

![bg right w:600](https://i.imgur.com/sKjOCBj.png)

<style scoped>
    section {
        font-size: 25px;
    }
</style>

- Open-source database-as-a-service (DaaS, but the good kind, not like CDA-EU 😊).
- This lets me build, host, and connect a PostgreSQL database with minimal setup.
- It also provides the appropriate connection pooling needed for serverless environments like Vercel/Railway.
- Has a really nice dashboard for running queries, inspecting data, and managing roles.

---

# 🤔 Why This Architecture?

| Decision | Rationale |
|----------|-----------|
| **Separate Socket Server** | Vercel doesn't support persistent WebSockets |
| **Server-Authoritative Timers** | Ensures sync with dynamic offsets (was having issues w/ this) |
| **PostgreSQL** | Required for serverless (Supabase pooling features were clutch) |
| **Next.js Server Actions** | Type-safe mutations, showing any potential errors upfront, this got a lot of debugging out of the way. |
| **Prisma ORM** | Shared schema, but type-safe DB to avoid problems/conflicts that could crash clients unexpectedly, ruining gameplay |

---

# 📊 Lines of Code by Language

| Language | Lines | Files | Purpose |
|----------|------:|------:|---------|
| **TypeScript/TSX** | 7,819 | 46 | Application logic, React components |
| **CSS** | 4,846 | 2+ | Styling (Tailwind + custom) |
| **Prisma Schema** | ~290 | 2 | Database models |
| **JSON Config** | 327 | 6 | Package & TypeScript config |
| **Documentation** | 709 | 4+ | README, guides |
| **Total** | **~14,000** | ~60 | |

I wrote **basically zero** of it (besides the game questions and this presentation).

---

# 📦 Frontend Dependencies (18 packages)

| Category | Packages |
|----------|----------|
| **Framework** | `next` (14.1), `react` (18.2), `react-dom` |
| **Database** | `@prisma/client` (5.10) |
| **UI Components** | `lucide-react`, `recharts`, `qrcode.react` |
| **Forms** | `react-hook-form`, `zod` |
| **File Handling** | `papaparse` (CSV), `react-dropzone` |
| **Real-time** | `socket.io-client` |
| **Auth** | `bcrypt`, `jose` (JWT) |

I couldn't have navigated this without significant tuitorials.  I had never used `npm install` or `npx prisma *` before starting this project.

---

# 📦 Socket Server Dependencies (8 packages)

| Category | Packages |
|----------|----------|
| **Server** | `express`, `socket.io`, `cors` |
| **Database** | `@prisma/client` |
| **Auth** | `bcrypt`, `jose` |
| **Config** | `dotenv` |
| **Validation** | `zod` |

Ditto above - I had never built a socket server before, so this was all new to me.

---

# ⚡ Technical Highlights

1. **Clock Skew Compensation**
   - `serverTime` offset syncs timers across devices
2. **Reconnection Support**
   - Unique `reconnectToken` in localStorage
3. **Archive vs Delete**
   - Used configs archived (data integrity)
   - Unused configs deletable
4. **QR Code Joining**
   - Easy mobile player onboarding
5. **Keyboard Shortcuts**
   - Host controls: Space, P, N, S, L, Esc

---

# 💾 Database Design

![bg right w:600](https://i.imgur.com/mVn5hdb.png)

- **Questions as JSON blob** - Faster reads, simpler schema
- **Per-round scores** - Enables breakdown analytics
- **Strategic indexes** - gameCode, status, createdAt

### 4 Table Models:
```
TriviaConfig  →  GameSession  →  Team  →  Answer
```

---

# 📱 Multi-Device Experience

### Host/Presenter
- **Host:** Large display with game controls assuming projection.
- **Players:** PC, Tablet, or Mobile-optimized answer buttons/iinterface.
- **Scoreboard:** Dedicated final results display.

---

# 🔒 Security Measures

- ✅ Host PIN hashed with **bcrypt** for secure play
- ✅ Unique team **reconnect tokens** for session integrity
- ✅ Rate limiting: **5 events/sec** per socket avoids spamming
- ✅ Input validation with **Zod schemas** which prevents data issues

---

# 📈 Development Statistics

| Metric | Value |
|--------|-------|
| **Total Commits** | 33 |
| **Development Period** | 5 days |
| **Lines Inserted** | 23,599 |
| **Lines Deleted** | 264 |
| **Net Lines Added** | ~23,335 |
| **Average Commits/Day** | 6.6 |

Most of this was up and running in about 2-3 hours from the initial prompt. I spent another 4-5 hours debugging, polishing, and adding features, and doing some playthrus on multiple clients.

---

# 🔧 Commit Breakdown

| Category | Count | % |
|----------|------:|--:|
| **Bug Fixes** | 18 | 55% |
| **Features** | 6 | 18% |
| **Infrastructure** | 4 | 12% |
| **Documentation** | 3 | 9% |
| **Other** | 2 | 6% |

Almost all commits were small and focused, with the majority being performed by Claude Opus 4.5.

---
# ⏱️ Traditional Development Estimate

How long should this have taken?

| **Component**	| **Junior** | **Mid-Level** | **Senior**
|----------|--------|-----------|--------|
|**Database schema & Prisma setup**	| 2 days | 1 day | 0.5 days |
|**Next.js frontend (pages, components)** | 5-7 days | 3-4 days | 2 days |
|**Socket server (real-time logic)** | 4-5 days | 2-3 days | 1-2 days | 
|**Timer synchronization system** | 2-3 days | 1-2 days | 1 day |
|**Auth & security (PIN, tokens)** | 2 days | 1 day | 0.5 days |
|**CSV upload & validation** | 1-2 days | 1 day | 0.5 days |
|**Deployment & debugging** | 3-4 days | 2 days | 1 day |
|**UI polish & styling** | 3-4 days| 2 days | 1-2 days |
|**Total** |4-6 weeks | 2-3 weeks | 1-2 weeks

---
# Development Time Comparison
⏱️ Development Time: AI-Assisted

| **Metric** | **Value** |
|--------|-------|
| **Actual time spent** | ~8 hours |
| **Calendar span** | 5 days |
| **Lines of code** | ~14,000 |
| **Lines per hour** | ~1,750 |)

~10-20x speedup with GHCP and Claude 4.5 Opus AI vs. a Mid-level / Senior Developer.

---

# 🚀 What was my workflow?

![bg right w:600](https://i.imgur.com/os5Av8S.png)

- I started with ChatGPT, 5.2 Thinking with this prompt.
- It asked 23 follow-up questions to clarify requirements, which I provided.
- This generated a markdown-based implementation spec, which I could easily pass into GHCP via VSCode.

---

# 🚀 What was my workflow? (con't)

![bg right w:600](https://i.imgur.com/LR06pcS.png)

- I am using VSCode 1.108.0 (December 2025) with GHCP Copilot extension.
- I made a new project folder, launch VSCode, dropped in this imp-spec and asked GHCP in `planning` mode to create an imp-plan.
- Once satisfied and done with questions, I asked it to implement.

---

# 🚀 What was my workflow? (con't)

![bg right w:500](https://i.imgur.com/3FuKWvp.png)

- Building took a good bit of time and hit context cap a few times.
- This required me to manually advance it during those (~5-8 minutes or so).
- Once done, I requested a deployment guide to test it on local desktop.
- This did take a bit of tweaking to get right (local and cloud).

---

🚀 What was my workflow? (con't)

**See this in action**

[![Watch on YouTube w:900](https://i.imgur.com/yxMtHBF.jpeg)](https://www.youtube.com/watch?v=JmdUTrOMwnA)
