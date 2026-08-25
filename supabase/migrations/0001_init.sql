-- Platredação: schema inicial
-- Rodar no SQL editor do Supabase (ou via `supabase db push` se o projeto estiver linkado).

create extension if not exists "pgcrypto";

-- ============ profiles ============
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  has_access boolean not null default false,
  created_at timestamptz not null default now()
);

-- cria o profile automaticamente quando um usuário se cadastra no Supabase Auth
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============ essay_themes ============
create table if not exists public.essay_themes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  motivational_texts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ============ essays ============
create table if not exists public.essays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  theme_id uuid references public.essay_themes (id) on delete set null,
  input_type text not null check (input_type in ('text', 'image')),
  image_url text,
  submitted_text text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'corrected', 'error')),
  created_at timestamptz not null default now()
);

create index if not exists essays_user_id_idx on public.essays (user_id);

-- ============ essay_corrections ============
create table if not exists public.essay_corrections (
  id uuid primary key default gen_random_uuid(),
  essay_id uuid not null unique references public.essays (id) on delete cascade,
  total_score int not null,
  competencies jsonb not null,
  general_feedback text not null,
  created_at timestamptz not null default now()
);

-- ============ payments ============
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'mercadopago',
  external_id text not null unique,
  status text not null,
  amount numeric,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments (user_id);

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.essays enable row level security;
alter table public.essay_corrections enable row level security;
alter table public.payments enable row level security;
alter table public.essay_themes enable row level security;

-- profiles: usuário só vê/edita o próprio perfil
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- essays: usuário só vê/insere as próprias redações
create policy "essays_select_own" on public.essays for select using (auth.uid() = user_id);
create policy "essays_insert_own" on public.essays for insert with check (auth.uid() = user_id);

-- essay_corrections: leitura via join com essays do próprio usuário
create policy "essay_corrections_select_own" on public.essay_corrections for select
  using (exists (select 1 from public.essays e where e.id = essay_id and e.user_id = auth.uid()));

-- payments: só o próprio usuário
create policy "payments_select_own" on public.payments for select using (auth.uid() = user_id);

-- conteúdo público (para usuários autenticados): temas
create policy "essay_themes_select_authenticated" on public.essay_themes for select using (auth.role() = 'authenticated');

-- Nota: o backend usa a service role key (bypassa RLS) para todas as operações.
-- Estas policies existem como defesa em profundidade, caso a anon key seja usada
-- diretamente contra o Postgres no futuro.
