ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS study_goal text;

ALTER TABLE public.summaries
  ADD COLUMN IF NOT EXISTS depth text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS word_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.flashcard_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'بطاقات',
  page_from integer,
  page_to integer,
  card_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcard_decks TO authenticated;
GRANT ALL ON public.flashcard_decks TO service_role;
ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY flashcard_decks_all_own ON public.flashcard_decks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER flashcard_decks_set_updated_at BEFORE UPDATE ON public.flashcard_decks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id uuid NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  front text NOT NULL,
  back text NOT NULL,
  page integer,
  ease integer NOT NULL DEFAULT 0,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO authenticated;
GRANT ALL ON public.flashcards TO service_role;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY flashcards_all_own ON public.flashcards FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'اختبار',
  page_from integer,
  page_to integer,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  score integer,
  taken_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY quizzes_all_own ON public.quizzes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER quizzes_set_updated_at BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.tutor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_messages TO authenticated;
GRANT ALL ON public.tutor_messages TO service_role;
ALTER TABLE public.tutor_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tutor_messages_all_own ON public.tutor_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  minutes integer NOT NULL DEFAULT 25,
  completed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.focus_sessions TO authenticated;
GRANT ALL ON public.focus_sessions TO service_role;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY focus_sessions_all_own ON public.focus_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS documents_user_created_idx ON public.documents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS summaries_user_created_idx ON public.summaries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS summaries_doc_idx ON public.summaries (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS document_chunks_doc_idx ON public.document_chunks (document_id, chunk_index);
CREATE INDEX IF NOT EXISTS flashcard_decks_user_created_idx ON public.flashcard_decks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS flashcards_deck_pos_idx ON public.flashcards (deck_id, position);
CREATE INDEX IF NOT EXISTS quizzes_user_created_idx ON public.quizzes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tutor_messages_user_doc_idx ON public.tutor_messages (user_id, document_id, created_at);
CREATE INDEX IF NOT EXISTS focus_sessions_user_created_idx ON public.focus_sessions (user_id, created_at DESC);