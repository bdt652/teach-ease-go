-- Add device fingerprint column to submissions
ALTER TABLE public.submissions 
ADD COLUMN device_fingerprint TEXT;

-- Add device info column to store additional device metadata
ALTER TABLE public.submissions 
ADD COLUMN device_info JSONB;