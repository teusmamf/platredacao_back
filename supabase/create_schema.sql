-- Platredação: criação completa do schema (migrations 0001, 0002, 0004 e 0005
-- combinadas), já com todas as colunas (highlights, next_steps, corrected_essay)
-- incluídas desde a criação da tabela.
-- Rode inteiro de uma vez no SQL Editor do Supabase (assumindo que as tabelas
-- antigas já foram apagadas manualmente).

-- ============ 1) EXTENSIONS ============
create extension if not exists "pgcrypto";

-- ============ 2) profiles ============
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  has_access boolean not null default false,
  created_at timestamptz not null default now()
);

drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============ 3) essay_themes ============
create table public.essay_themes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  motivational_texts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ============ 4) essays ============
create table public.essays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  theme_id uuid references public.essay_themes (id) on delete set null,
  input_type text not null check (input_type in ('text', 'image')),
  image_url text,
  submitted_text text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'corrected', 'error')),
  created_at timestamptz not null default now()
);

create index essays_user_id_idx on public.essays (user_id);

-- ============ 5) essay_corrections (já com highlights/next_steps/corrected_essay) ============
create table public.essay_corrections (
  id uuid primary key default gen_random_uuid(),
  essay_id uuid not null unique references public.essays (id) on delete cascade,
  total_score int not null,
  competencies jsonb not null,
  general_feedback text not null,
  highlights jsonb not null default '[]'::jsonb,
  next_steps jsonb not null default '[]'::jsonb,
  corrected_essay text not null default '',
  created_at timestamptz not null default now()
);

-- ============ 6) payments ============
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'mercadopago',
  external_id text not null unique,
  status text not null,
  amount numeric,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index payments_user_id_idx on public.payments (user_id);

-- ============ 7) RLS ============
alter table public.profiles enable row level security;
alter table public.essays enable row level security;
alter table public.essay_corrections enable row level security;
alter table public.payments enable row level security;
alter table public.essay_themes enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create policy "essays_select_own" on public.essays for select using (auth.uid() = user_id);
create policy "essays_insert_own" on public.essays for insert with check (auth.uid() = user_id);

create policy "essay_corrections_select_own" on public.essay_corrections for select
  using (exists (select 1 from public.essays e where e.id = essay_id and e.user_id = auth.uid()));

create policy "payments_select_own" on public.payments for select using (auth.uid() = user_id);

create policy "essay_themes_select_authenticated" on public.essay_themes for select using (auth.role() = 'authenticated');

-- ============ 8) storage (bucket de redações manuscritas) ============
insert into storage.buckets (id, name, public)
values ('essay-uploads', 'essay-uploads', true)
on conflict (id) do nothing;

create policy "essay_uploads_public_read"
  on storage.objects for select
  using (bucket_id = 'essay-uploads');

-- ============ 9) força o PostgREST a recarregar o schema cache ============
NOTIFY pgrst, 'reload schema';
