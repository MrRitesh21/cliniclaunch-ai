
DROP POLICY IF EXISTS "clinic-media authenticated delete own" ON storage.objects;
DROP POLICY IF EXISTS "clinic-media authenticated update own" ON storage.objects;
DROP POLICY IF EXISTS "clinic-media authenticated upload own" ON storage.objects;
DROP POLICY IF EXISTS "clinic-media owner delete" ON storage.objects;
DROP POLICY IF EXISTS "clinic-media owner insert" ON storage.objects;
DROP POLICY IF EXISTS "clinic-media owner update" ON storage.objects;
DROP POLICY IF EXISTS "clinic-media public read" ON storage.objects;
