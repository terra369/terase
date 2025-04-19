# README.md

```markdown
# terase

> **Bring light to every day** – A gratitude‑journal SNS that pairs you with a personal fairy, captures your voice entries once a day, and lets you reflect through a calendar heat‑map interface.

---

## ✨ Features
- **Fairy Companion** – Personal GPT‑powered avatar that asks reflective prompts and provides warm feedback.
- **Voice‑first Journaling** – Record and transcribe your daily gratitude in one tap with ElevenLabs + Whisper.
- **Calendar Heatmap** – Visual overview of streaks and past entries for habit reinforcement.citeturn0search0
- **Friend Peek** – View friends’ entries (24 h window) only after you’ve posted yours, eliminating social pressure.
- **Privacy‑by‑default** – Row‑Level‑Security on Supabase; only you and accepted friends can read your data.citeturn0search2

---

## 🏗 Tech Stack
| Layer | Tool | Notes |
|-------|------|-------|
| Front‑end | **Next.js 14** (React) | `/app` dir, Server Actions, SWR for client fetch citeturn0search6 |
| Back‑end | **Supabase** | Postgres + Edge Functions + RLS policies |
| Auth | Supabase OAuth | Google / LINE |
| Storage | Supabase Storage | Audio blobs |
| Voice AI | ElevenLabs API | TTS / STT |
| Deployment | Vercel + GitHub | Auto‑preview on PRs citeturn0search3 |
| CI / Hooks | GitHub Actions + Husky | Lint / build / test before merge citeturn0search5turn0search9 |

---

## 🚀 Quick Start

```bash
git clone https://github.com/ahiboh-inc/terase.git
cd terase
npm ci

# copy example env and fill in keys
cp .env.example .env.local

npm run dev        # http://localhost:3000

```

### Required ENV Vars

| Key | Example | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ey...` | client |
| `OPENAI_API_KEY` | `sk-...` | server |
| `ELEVENLABS_API_KEY` | `e11-...` | server |

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
| `npm run lint` | ESLint + Prettier check |
| `npm run build` | Production build |
| `supabase start` | Local Postgres + Studio |

---

## 🤝 Contributing

1. Create feature branch `git checkout -b feat/calendar-heatmap`.
2. Follow **Conventional Commits** for messages (`feat:`, `fix:` …).
3. Pre‑commit hook runs `npm run lint`; CI must pass before merge.
4. Open PR → automatic Vercel preview deploy for review.

---

## 📄 License

MIT © 2025 terase / ahiboh-inc
