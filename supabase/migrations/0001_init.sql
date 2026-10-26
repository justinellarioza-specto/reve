-- Reve schema. Runs unchanged on Supabase Postgres and on PGlite (demo mode).
-- All reads/writes go through the Next.js server, which scopes every query by user_id.
-- RLS is enabled with no policies, so the public anon key can't read these tables via PostgREST.

create extension if not exists vector;

create table if not exists users (
  id          uuid primary key,
  email       text,
  created_at  timestamptz not null default now()
);

create table if not exists subjects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  name        text not null,
  color       text not null default '#E36414',
  exam_date   date,
  traps_md    text,                 -- cached "traps and look-alikes" sheet
  traps_at    timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists subjects_user_idx on subjects(user_id);

create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  subject_id    uuid not null references subjects(id) on delete cascade,
  filename      text not null,
  kind          text not null check (kind in ('pdf','pptx','docx','text')),
  storage_path  text,               -- Supabase Storage path of the original file, if stored
  char_count    int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists documents_subject_idx on documents(subject_id);

create table if not exists topics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  subject_id  uuid not null references subjects(id) on delete cascade,
  title       text not null,
  summary     text not null default '',
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists topics_subject_idx on topics(subject_id, position);

create table if not exists chunks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  subject_id       uuid not null references subjects(id) on delete cascade,
  document_id      uuid references documents(id) on delete cascade,
  topic_id         uuid references topics(id) on delete set null,
  source_label     text not null,   -- e.g. "Slide 4", "Page 12", "Section: Subnetting"
  content          text not null,
  position         int not null default 0,
  embedding        vector(768),
  embedding_model  text,
  created_at       timestamptz not null default now()
);
create index if not exists chunks_subject_idx on chunks(subject_id);
create index if not exists chunks_topic_idx on chunks(topic_id);

create table if not exists concepts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  topic_id     uuid not null references topics(id) on delete cascade,
  name         text not null,
  description  text not null default '',
  mastery      int not null default 0 check (mastery between 0 and 100),
  created_at   timestamptz not null default now()
);
create index if not exists concepts_topic_idx on concepts(topic_id);

create table if not exists questions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  topic_id      uuid not null references topics(id) on delete cascade,
  concept_id    uuid references concepts(id) on delete set null,
  type          text not null check (type in ('mcq','tf','fill','spot_error')),
  prompt        text not null,
  options       jsonb not null default '[]',   -- mcq / spot_error choices
  answer        text not null,                 -- option text, 'true'/'false', or fill answer
  accept        jsonb not null default '[]',   -- extra accepted fill answers
  hint          text not null default '',
  explanation   text not null default '',
  source_label  text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists questions_topic_idx on questions(topic_id);
create index if not exists questions_concept_idx on questions(concept_id);

create table if not exists attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  question_id  uuid references questions(id) on delete cascade,
  concept_id   uuid references concepts(id) on delete cascade,
  correct      boolean not null,
  time_ms      int not null default 0,
  hints_used   int not null default 0,
  mode         text not null default 'check' check (mode in ('check','review','mixed')),
  created_at   timestamptz not null default now()
);
create index if not exists attempts_user_idx on attempts(user_id, created_at);
create index if not exists attempts_concept_idx on attempts(concept_id);

create table if not exists review_schedule (
  user_id        uuid not null references users(id) on delete cascade,
  concept_id     uuid primary key references concepts(id) on delete cascade,
  due_at         timestamptz not null,
  interval_days  real not null default 0,
  ease           real not null default 2.5,
  reps           int not null default 0,
  lapses         int not null default 0,
  updated_at     timestamptz not null default now()
);
create index if not exists review_due_idx on review_schedule(user_id, due_at);

create table if not exists chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  topic_id    uuid not null references topics(id) on delete cascade,
  mode        text not null check (mode in ('teach','quiz','explain')),
  created_at  timestamptz not null default now()
);
create index if not exists chat_sessions_topic_idx on chat_sessions(topic_id, mode, created_at);

create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  session_id  uuid not null references chat_sessions(id) on delete cascade,
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  citations   jsonb not null default '[]',
  meta        jsonb not null default '{}',   -- tutor state (e.g. hint level) for the demo tutor
  created_at  timestamptz not null default now()
);
create index if not exists messages_session_idx on messages(session_id, created_at);

-- Lock the tables down from PostgREST; the app connects as the database owner.
alter table users           enable row level security;
alter table subjects        enable row level security;
alter table documents       enable row level security;
alter table topics          enable row level security;
alter table chunks          enable row level security;
alter table concepts        enable row level security;
alter table questions       enable row level security;
alter table attempts        enable row level security;
alter table review_schedule enable row level security;
alter table chat_sessions   enable row level security;
alter table messages        enable row level security;
