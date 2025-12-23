-- Add start_date and end_date columns to classes table
ALTER TABLE public.classes
ADD COLUMN start_date DATE,
ADD COLUMN end_date DATE;

-- Add comment for clarity
COMMENT ON COLUMN public.classes.start_date IS 'Ngày bắt đầu khóa học';
COMMENT ON COLUMN public.classes.end_date IS 'Ngày kết thúc khóa học';