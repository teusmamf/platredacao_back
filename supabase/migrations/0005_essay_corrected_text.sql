-- Platredação: versão corrigida/reescrita da redação, gerada junto com a correção.
-- Rodar no SQL editor do Supabase, depois de 0004_essay_correction_details.sql.

alter table public.essay_corrections
  add column if not exists corrected_essay text not null default '';
