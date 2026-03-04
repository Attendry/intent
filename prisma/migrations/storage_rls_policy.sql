-- Run this in Supabase SQL Editor to allow document uploads.
-- Required for company annual report uploads to the company-documents bucket.
-- Users must be authenticated (Supabase Auth) to upload.
-- Run once; if policies exist, drop them first or you'll get a duplicate error.

-- Allow authenticated users to upload (INSERT) to company-documents
CREATE POLICY "Allow authenticated uploads to company-documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-documents');
