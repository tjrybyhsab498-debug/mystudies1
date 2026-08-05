CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  feature text NOT NULL DEFAULT 'summarize',
  page_from integer,
  page_to integer,
  title text NOT NULL DEFAULT 'ملخص',
  status text NOT NULL DEFAULT 'pending',
  content jsonb,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.summaries TO authenticated;
GRANT ALL ON public.summaries TO service_role;
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "summaries_all_own" ON public.summaries FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER summaries_set_updated_at BEFORE UPDATE ON public.summaries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.document_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  page_from integer,
  page_to integer,
  content text NOT NULL,
  embedding vector(768),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_chunks TO authenticated;
GRANT ALL ON public.document_chunks TO service_role;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_chunks_all_own" ON public.document_chunks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_documents_user_created ON public.documents (user_id, created_at DESC);
CREATE INDEX idx_documents_subject ON public.documents (subject_id);
CREATE INDEX idx_subjects_user ON public.subjects (user_id, created_at DESC);
CREATE INDEX idx_summaries_user_created ON public.summaries (user_id, created_at DESC);
CREATE INDEX idx_summaries_document ON public.summaries (document_id);
CREATE INDEX idx_document_chunks_document ON public.document_chunks (document_id, chunk_index);
CREATE INDEX idx_document_chunks_embedding ON public.document_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  _document_id uuid,
  _query_embedding vector(768),
  _match_count integer DEFAULT 8
)
RETURNS TABLE (id uuid, content text, page_from integer, page_to integer, similarity double precision)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.id, c.content, c.page_from, c.page_to,
         1 - (c.embedding <=> _query_embedding) AS similarity
  FROM public.document_chunks c
  WHERE c.document_id = _document_id
    AND c.user_id = auth.uid()
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> _query_embedding
  LIMIT GREATEST(1, LEAST(_match_count, 50));
$$;

REVOKE ALL ON FUNCTION public.match_document_chunks(uuid, vector, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(uuid, vector, integer) TO authenticated, service_role;