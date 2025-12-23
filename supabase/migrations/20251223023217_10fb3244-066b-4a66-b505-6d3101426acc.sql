-- Add time fields for class schedule
ALTER TABLE public.classes
ADD COLUMN start_time TIME,
ADD COLUMN end_time TIME;

-- Add comments
COMMENT ON COLUMN public.classes.start_time IS 'Giờ bắt đầu buổi học';
COMMENT ON COLUMN public.classes.end_time IS 'Giờ kết thúc buổi học';