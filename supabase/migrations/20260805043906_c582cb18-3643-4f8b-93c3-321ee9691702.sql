CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;
ALTER EXTENSION vector SET SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  _document_id uuid,
  _query_embedding extensions.vector(768),
  _match_count integer DEFAULT 8
)
RETURNS TABLE (id uuid, content text, page_from integer, page_to integer, similarity double precision)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
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

REVOKE ALL ON FUNCTION public.match_document_chunks(uuid, extensions.vector, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(uuid, extensions.vector, integer) TO authenticated, service_role;