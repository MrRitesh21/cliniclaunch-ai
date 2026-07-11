CREATE POLICY "Public read clinic-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'clinic-media');

CREATE POLICY "Owner upload clinic-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'clinic-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner update clinic-media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'clinic-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'clinic-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner delete clinic-media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'clinic-media' AND (storage.foldername(name))[1] = auth.uid()::text);