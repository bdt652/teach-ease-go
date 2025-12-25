-- Allow class teachers to enroll students into their classes
CREATE POLICY "Class teachers can enroll students"
ON public.class_enrollments
FOR INSERT
WITH CHECK (is_class_teacher(auth.uid(), class_id));