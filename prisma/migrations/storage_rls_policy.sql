-- Run this in Supabase SQL Editor to allow document uploads.
-- Required for company annual report uploads to the company-documents bucket.
-- Required for event attendee imports to the event-attendees bucket.
-- Users must be authenticated (Supabase Auth) to upload.
-- Safe to re-run: drops existing policies before recreating.
--
-- 1. Create the event-attendees bucket in Supabase: Storage → New bucket → name: event-attendees
-- 2. Set it to Public if you want direct URLs, or Private (admin client can still download).

-- company-documents
DROP POLICY IF EXISTS "Allow authenticated uploads to company-documents" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to company-documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-documents');

-- event-attendees
DROP POLICY IF EXISTS "Allow authenticated uploads to event-attendees" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to event-attendees"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-attendees');
