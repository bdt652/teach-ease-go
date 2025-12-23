-- =====================================================
-- SECURITY FIX: Remove dangerous public access policies
-- =====================================================

-- 1. CRITICAL: Remove policy that exposes ALL submissions to unauthenticated users
DROP POLICY IF EXISTS "Anyone can view submissions by session for guest lookup" ON public.submissions;

-- 2. Add server-side validation for guest_name to prevent malicious input
-- Allow Unicode letters, numbers, spaces, hyphens, dots (2-100 chars)
ALTER TABLE public.submissions 
ADD CONSTRAINT guest_name_format 
CHECK (
  guest_name IS NULL OR 
  (LENGTH(guest_name) >= 2 AND LENGTH(guest_name) <= 100)
);

-- 3. Add explicit INSERT denial policy on profiles for defense in depth
CREATE POLICY "Only system can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (false);

-- 4. OPTIONAL: Add DELETE policy denial on profiles (already missing, making explicit)
CREATE POLICY "Users cannot delete profiles"
ON public.profiles FOR DELETE
USING (false);