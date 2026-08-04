CREATE POLICY "study_files_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'study-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "study_files_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'study-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "study_files_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'study-files' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'study-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "study_files_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'study-files' AND auth.uid()::text = (storage.foldername(name))[1]);