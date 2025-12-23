-- Add foreign key from class_enrollments.user_id to profiles.user_id for joining
ALTER TABLE public.class_enrollments
ADD CONSTRAINT class_enrollments_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;