CREATE INDEX IF NOT EXISTS idx_documents_user_created ON public.documents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_summaries_user_created ON public.summaries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_summaries_doc_status ON public.summaries (document_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chunks_doc_index ON public.document_chunks (document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_decks_user_created ON public.flashcard_decks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flashcards_deck_position ON public.flashcards (deck_id, position);
CREATE INDEX IF NOT EXISTS idx_quizzes_user_created ON public.quizzes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tutor_messages_user_doc_created ON public.tutor_messages (user_id, document_id, created_at);
CREATE INDEX IF NOT EXISTS idx_focus_user_created ON public.focus_sessions (user_id, created_at DESC);