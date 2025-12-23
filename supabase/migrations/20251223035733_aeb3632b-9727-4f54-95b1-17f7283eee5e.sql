-- Add guest password to classes
ALTER TABLE public.classes 
ADD COLUMN guest_password TEXT;

-- Create class enrollments table
CREATE TABLE public.class_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(class_id, user_id)
);

-- Enable RLS
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;

-- Students can view their own enrollments
CREATE POLICY "Users can view their enrollments" 
ON public.class_enrollments 
FOR SELECT 
USING (auth.uid() = user_id);

-- Students can enroll themselves
CREATE POLICY "Users can enroll themselves" 
ON public.class_enrollments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Students can leave classes
CREATE POLICY "Users can leave classes" 
ON public.class_enrollments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Teachers can view enrollments for their classes
CREATE POLICY "Teachers can view class enrollments" 
ON public.class_enrollments 
FOR SELECT 
USING (is_class_teacher(auth.uid(), class_id));

-- Teachers can remove students from their classes
CREATE POLICY "Teachers can remove enrollments" 
ON public.class_enrollments 
FOR DELETE 
USING (is_class_teacher(auth.uid(), class_id));

-- Create function to check if user is enrolled
CREATE OR REPLACE FUNCTION public.is_enrolled_in_class(_user_id UUID, _class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_enrollments
    WHERE user_id = _user_id AND class_id = _class_id
  )
$$;