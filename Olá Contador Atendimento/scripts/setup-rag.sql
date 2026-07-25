-- Ativar a extensão pgvector
create extension if not exists vector;

-- Criar a tabela para armazenar os fragmentos das Skills
create table if not exists public.skills_embeddings (
  id uuid primary key default gen_random_uuid(),
  skill_name text not null,
  chunk_text text not null,
  embedding vector(1536),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS (opcional, mas recomendado para proteger contra escrita anônima)
alter table public.skills_embeddings enable row level security;

-- Política de leitura: Qualquer um pode ler os embeddings
create policy "Embeddings são públicos para leitura" on public.skills_embeddings for select using (true);
create policy "Apenas admin pode inserir embeddings" on public.skills_embeddings for insert with check (auth.role() = 'service_role');

-- Criar a função de match (Busca por Similaridade via RPC)
create or replace function match_skills (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  skill_filter text
)
returns table (
  id uuid,
  skill_name text,
  chunk_text text,
  similarity float
)
language sql stable
as $$
  select
    skills_embeddings.id,
    skills_embeddings.skill_name,
    skills_embeddings.chunk_text,
    1 - (skills_embeddings.embedding <=> query_embedding) as similarity
  from skills_embeddings
  where skills_embeddings.skill_name = skill_filter
    and 1 - (skills_embeddings.embedding <=> query_embedding) > match_threshold
  order by skills_embeddings.embedding <=> query_embedding
  limit match_count;
$$;
