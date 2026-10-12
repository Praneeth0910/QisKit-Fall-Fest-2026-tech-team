-- ============================================================================
-- Migration: Allow session materials (.pdf, etc.) uploads in media bucket
-- Folder scope: media/session-materials/*
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow session materials uploads to media bucket'
  ) THEN
    CREATE POLICY "Allow session materials uploads to media bucket"
      ON storage.objects
      FOR INSERT
      TO public
      WITH CHECK (
        bucket_id = 'media'
        AND (storage.foldername(name))[1] = 'session-materials'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow session materials updates in media bucket'
  ) THEN
    CREATE POLICY "Allow session materials updates in media bucket"
      ON storage.objects
      FOR UPDATE
      TO public
      USING (
        bucket_id = 'media'
        AND (storage.foldername(name))[1] = 'session-materials'
      )
      WITH CHECK (
        bucket_id = 'media'
        AND (storage.foldername(name))[1] = 'session-materials'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow session materials deletes in media bucket'
  ) THEN
    CREATE POLICY "Allow session materials deletes in media bucket"
      ON storage.objects
      FOR DELETE
      TO public
      USING (
        bucket_id = 'media'
        AND (storage.foldername(name))[1] = 'session-materials'
      );
  END IF;
END $$;
