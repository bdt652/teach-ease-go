-- Allow teachers to delete submissions from their class sessions
CREATE POLICY "Teachers can delete submissions from their sessions" 
ON public.submissions 
FOR DELETE 
USING (is_class_teacher(auth.uid(), (SELECT sessions.class_id FROM sessions WHERE sessions.id = submissions.session_id)));