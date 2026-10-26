# Reve

An AI study companion for college students. Upload your slides, PDFs and notes. Reve turns them into short lessons. You learn by answering Reve's questions, and Reve tracks what you've mastered and schedules your reviews before the exam.

The tutor, also called Reve, uses the Socratic method. It asks before it tells, gives one hint at a time, and only teaches from your own material, citing the slide or page it's drawing on.

Built for IT/BSIT students first. Mobile-first and installable as a PWA.

## What's in v1

| Feature | Where |
|---|---|
| **Subjects & uploads**: PDF, PPTX, DOCX or pasted text, split into topics with an editable outline | `/subjects/new`, `/subjects/[id]/upload`, `/subjects/[id]/outline` |
| **Learn with Reve**: *Teach me*, *Quiz me* and *Explain it back*, grounded in your material with citations | `/topics/[id]/learn` |
| **Quick Checks**: 5–8 questions per topic (multiple choice, true/false, fill-in-the-blank, spot the error). You answer before you see anything, then get a *why* | `/topics/[id]/check` |
| **Spaced review**: mastery from 0 to 100 per concept. SM-2 scheduling brings misses back the same day. "Today's review: N items · ~X min" | `/review`, home |
| **Exam countdown plan**: short sessions, one topic at a time first, then mixed (interleaved) rounds near the exam. A one-page *traps & look-alikes* sheet for the night before | `/subjects/[id]/plan`, `/subjects/[id]/traps` |
| **Progress**: streak, first-try accuracy, mastery per topic, and weak spots with "Review these with Reve" | `/progress` |

Every screen answers one question: *what should I study next?* The home screen has one main button, which picks today's planned session, then due reviews, then the next unstarted topic.

### Learning science, built into the product

- **Retrieval practice**: Quick Checks, reviews and mixed rounds never show the answer before you commit. Answers are graded on the server, so they never reach the browser early.
- **Spacing**: SM-2 schedule per concept (`src/lib/srs.ts`), capped so everything gets one last look the day before the exam.
- **Interleaving**: the last third of the plan is mixed rounds, starting with your weakest concepts.
- **Self-explanation**: *Explain it back* mode, plus "why?" follow-ups in *Teach me*.
- **No passive study tools**: no highlighter and no summaries-to-reread. The one summary (traps sheet) is for the night before.

## Quick start (zero config)

Requires Node 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no environment variables set, Reve runs in **demo mode**:

- **Database**: an embedded Postgres ([PGlite](https://pglite.dev)) in `./.data`, running the exact same schema as Supabase. You're signed in as a single local demo student.
- **Tutor**: a simple offline stand-in. It follows the same rules (question first, hint ladder, citations, stays inside your material), but it's rule-based. Add a Gemini key to get the real Reve.
- **Sample subject**: *Networking Essentials* is created on first run. It has 3 topics, 9 concepts and 18 questions, and the exam is set 10 days out, so every screen has something to show.

## Setup

### 1. Gemini (the AI tutor)

1. Get a free API key at https://aistudio.google.com/apikey.
2. `cp .env.example .env.local` and set `GEMINI_API_KEY`.

Defaults are `gemini-3.8-flash` for chat, outlines and questions, and `gemini-embedding-001` (768-dim) for retrieval. Override them with `GEMINI_MODEL` and `GEMINI_EMBED_MODEL`. If you hit free-tier limits, `GEMINI_MODEL=gemini-3.5-flash-lite` is cheaper and faster.

Material uploaded in demo mode is re-embedded automatically the first time you chat after adding the key.

### 2. Supabase (accounts and the real database)

1. Create a project at https://supabase.com.
2. **Project Settings → API**: copy the URL and the `anon` key into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. **Connect → Transaction pooler**: copy the connection string (port 6543, with your DB password) into `DATABASE_URL`.
4. Create the tables:
   ```bash
   npm run db:migrate
   ```
   Or paste `supabase/migrations/0001_init.sql` into the SQL Editor and run it.
5. **Authentication → URL Configuration**: set Site URL to your app's URL, and add `http://localhost:3000/auth/callback` (plus your deployed `/auth/callback`) to Redirect URLs. Email magic links are on by default.
6. *Optional, to keep original files:* create a **private** Storage bucket called `uploads` and set `SUPABASE_SERVICE_ROLE_KEY`. Without it, Reve still extracts and stores the text; it just doesn't keep the original file.

Once all three of `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `DATABASE_URL` are set, demo mode turns off and students sign in with a magic link. Each new student gets the sample subject.

### Environment variables

| Variable | Required | What it does |
|---|---|---|
| `GEMINI_API_KEY` | for the real tutor | Gemini API key. Empty means the offline demo tutor. |
| `GEMINI_MODEL` | no | Chat/generation model (default `gemini-3.8-flash`) |
| `GEMINI_EMBED_MODEL` | no | Embedding model (default `gemini-embedding-001`) |
| `NEXT_PUBLIC_SUPABASE_URL` | for accounts | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for accounts | Supabase anon key (used only for sign-in) |
| `DATABASE_URL` | for accounts | Supabase Postgres connection string (transaction pooler) |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Saves original uploads to the `uploads` bucket |
| `APP_TIMEZONE` | no | Fallback time zone for streaks if the browser doesn't send one (default `Asia/Manila`) |
| `REVE_DATA_DIR` | no | Where demo mode keeps its database (default `.data`) |

## Deploying

Any Node host that runs `npm run build` then `npm start` works (Render, Railway, Vercel, Fly).

- **Render**: create a *Web Service* from this repo with build command `npm install && npm run build` and start command `npm start`, then add the env vars above. Use Supabase in production: demo mode stores data on the server's disk, which Render wipes on every deploy.
- **Vercel**: works as-is with Supabase configured. Demo mode isn't suitable there, because serverless functions have no persistent disk.

## How it works

```
upload ─▶ extract text per page/slide/section (src/lib/parse)
       ─▶ AI outline: topics + key concepts (prompts/extract-topics.md)
       ─▶ chunks (~900 chars, keep their "Slide 4" label) ─▶ embeddings ─▶ pgvector

chat   ─▶ embed question ─▶ nearest chunks in this subject (current topic boosted)
       ─▶ tutor prompt (prompts/tutor.md + prompts/modes/*) ─▶ JSON {reply, citations, hint_level}
       ─▶ citations filtered to labels that really exist in your material

check  ─▶ questions generated once per topic (prompts/generate-questions.md), validated
       ─▶ graded server-side ─▶ attempt ─▶ concept mastery + SM-2 schedule
```

- **Prompts** live in `/prompts` as plain Markdown with `{{placeholders}}`. Reve's tutoring rules are in `prompts/tutor.md`.
- **Data access** is plain SQL in `src/lib/repo.ts`. Every query is scoped by `user_id`. Row Level Security is enabled with no policies, so the public anon key can't read the tables. Only the server, connecting with `DATABASE_URL`, can.
- **Mastery** moves 40% of the way toward each attempt's score. A correct answer scores 100, minus 15 per hint used (minimum 60). A miss scores 0.
- **SM-2**: a miss brings the concept back in 10 minutes and resets its interval. Successive successes space it at 1 day, 3 days, then interval × ease.

### Project layout

```
prompts/                 AI prompts (tutor rules, modes, outline, questions, traps)
supabase/migrations/     Postgres schema (shared by Supabase and demo mode)
src/app/                 Next.js App Router pages, server actions, /api/chat
src/components/          UI (QuestionRunner, Chat, Ring, …)
src/lib/ai/              Gemini provider + offline demo provider
src/lib/parse/           PDF / PPTX / DOCX / text extraction
src/lib/                 repo (SQL), services, srs, planner, seed, auth
tests/                   Vitest: logic, parsing (real generated files), full flow on PGlite
```

### Data model

`users` · `subjects` (exam_date) · `documents` · `chunks` (embedding vector(768)) · `topics` · `concepts` (mastery) · `questions` · `attempts` (correct, time_ms, hints_used) · `review_schedule` (due_at, interval_days, ease) · `chat_sessions` · `messages` (citations)

## Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm start           # run the production build
npm test            # unit + integration tests (embedded Postgres, offline tutor)
npm run lint        # type-check
npm run db:migrate  # apply migrations to DATABASE_URL
npm run icons       # regenerate PWA icons
```

## Known limits

- Scanned PDFs (images only) have no text to extract. Export with OCR or paste the notes instead.
- Old `.ppt` / `.doc` files aren't supported; save them as `.pptx` / `.docx`.
- The offline demo tutor fills gaps from your sentences. It's there so the app works without a key; the Socratic conversation really comes alive with Gemini.

Out of scope for v1: social features, leaderboards, payments, native apps.
