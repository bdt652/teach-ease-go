-- Add submission configuration to sessions table
ALTER TABLE public.sessions
ADD COLUMN submission_type TEXT DEFAULT 'any' CHECK (submission_type IN ('any', 'image', 'code', 'document', 'link')),
ADD COLUMN submission_instructions TEXT,
ADD COLUMN allowed_extensions TEXT[];