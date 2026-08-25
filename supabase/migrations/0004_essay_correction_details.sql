-- Platredação: detalhes adicionais da correção — trechos destacados no texto e
-- próximos passos priorizados para o aluno chegar a 1000.
-- Rodar no SQL editor do Supabase, depois de 0001_init.sql.

alter table public.essay_corrections
  add column if not exists highlights jsonb not null default '[]'::jsonb,
  add column if not exists next_steps jsonb not null default '[]'::jsonb;
