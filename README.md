# README.md

## terase

> **Bring light to every day** – A gratitude‑journal SNS that pairs you with a personal rainbow JARVIS sphere, captures your voice entries once a day, and lets you reflect through a calendar interface.

---

## ✨ Features

- **🌈 Rainbow JARVIS Sphere** – Personal GPT‑powered avatar with unique personality that asks reflective prompts and provides warm feedback.
- **🎙️ Voice‑first Journaling** – Record and transcribe your daily gratitude in one tap with OpenAI Whisper + TTS.
- **📅 Calendar Interface** – Visual overview of streaks and past entries for habit reinforcement.
- **👥 Friend Peek** – View friends' entries (24h window) only after you've posted yours, eliminating social pressure.
- **🔒 Privacy‑by‑default** – Row‑Level‑Security on Supabase; only you and accepted friends can read your data.
- **🏗️ Enterprise Architecture** – Centralized error handling, device detection, and API middleware for robust performance.

---

## 🏗 Tech Stack

| Layer | Tool | Notes |
|-------|------|-------|
| Front‑end | **Next.js 15** (React 19) | `/app` dir, Server Components, SWR, Zustand |
| Back‑end | **Supabase** | Postgres + Edge Functions + RLS policies |
| Auth | Supabase OAuth | Google / LINE |
| Storage | Supabase Storage | Audio blobs |
| Voice AI | **OpenAI API** | Whisper (STT) + GPT (AI) + TTS |
| 3D Graphics | **React Three Fiber** | Rainbow JARVIS sphere |
| Architecture | **Centralized Systems** | Error handling, device detection, API middleware |
| Validation | **Zod** | Runtime type validation + API schemas |
| Deployment | Vercel + GitHub | Auto‑preview on PRs |
| CI / Hooks | GitHub Actions + ESLint | Lint / build / test before merge |

---

## 🚀 Quick Start

```bash
git clone https://github.com/terra369/terase.git
cd terase
npm ci

# copy example env and fill in keys
cp .env.example .env.local

npm run dev        # http://localhost:3000

```

## Required ENV Vars

| Key | Example | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ey...` | client |
| `OPENAI_API_KEY` | `sk-...` | server |

---

## 🗃 Database schema

```sql
-- profiles / diaries / friends / invites (see supabase/migrations)
unique (user_id, date); -- 1 entry per day

```

Supabase migrations live under `supabase/migrations` and are version‑controlled – run `supabase db push` after changes.

---

## 📜 Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | local Next.js + Supabase edge |
| `npm run lint` | ESLint check |
| `npm run build` | Production build |
| `npm run test` | Run Vitest tests |
| `supabase start` | Local Postgres + Studio |

---

## 🏛️ Architecture Highlights

### 🛡️ Error Handling

- **Centralized system** with Japanese user messages
- **9 error types** (recording, AI, network, etc.)
- **Automatic retry logic** based on error classification

### 📱 Device Detection  

- **Cross-platform compatibility** with iOS Safari optimizations
- **Audio optimization** with device-specific MIME types
- **User gesture detection** for audio playback requirements

### 🔗 API Infrastructure

- **Standardized middleware** for auth, CORS, and validation
- **Zod schemas** for type-safe input validation
- **Consistent responses** across all endpoints

### 🎵 Audio System

- **Modular organization** with barrel exports
- **Shared components** for recording workflows
- **Performance optimizations** for mobile devices

---

## 🤝 Contributing

1. Create feature branch `git checkout -b feat/calendar`.
2. Follow **Conventional Commits** for messages (`feat:`, `fix:` …).
3. Pre‑commit hook runs `npm run lint`; CI must pass before merge.
4. Open PR → automatic Vercel preview deploy for review.

---

## 📄 License

test
MIT © 2025 terase / terra369
