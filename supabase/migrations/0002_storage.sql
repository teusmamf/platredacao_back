-- Bucket de storage para as fotos/PDFs de redações manuscritas enviadas pelos alunos.
insert into storage.buckets (id, name, public)
values ('essay-uploads', 'essay-uploads', true)
on conflict (id) do nothing;

-- Leitura pública (URLs públicas usadas para mostrar a imagem no histórico do aluno).
-- Upload é feito exclusivamente pelo backend com a service role key (bypassa RLS de storage).
create policy "essay_uploads_public_read"
  on storage.objects for select
  using (bucket_id = 'essay-uploads');
