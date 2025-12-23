-- Create storage bucket for lesson materials
INSERT INTO storage.buckets (id, name, public) 
VALUES ('lesson-materials', 'lesson-materials', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users (teachers) to upload
CREATE POLICY "Teachers can upload lesson materials"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'lesson-materials' 
  AND auth.role() = 'authenticated'
);

-- Allow anyone to view lesson materials (for students viewing on TV)
CREATE POLICY "Anyone can view lesson materials"
ON storage.objects
FOR SELECT
USING (bucket_id = 'lesson-materials');

-- Allow teachers to delete their uploaded files
CREATE POLICY "Teachers can delete lesson materials"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'lesson-materials' 
  AND auth.role() = 'authenticated'
);