-- Create analytics functions for dashboard

-- Function to get class statistics
CREATE OR REPLACE FUNCTION public.get_class_statistics(teacher_id_filter UUID DEFAULT NULL)
RETURNS TABLE (
  class_id UUID,
  class_name VARCHAR(255),
  class_code VARCHAR(20),
  student_count BIGINT,
  session_count BIGINT,
  submission_count BIGINT,
  average_grade FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as class_id,
    c.name as class_name,
    c.code as class_code,
    COALESCE(student_counts.student_count, 0) as student_count,
    COALESCE(session_counts.session_count, 0) as session_count,
    COALESCE(submission_counts.submission_count, 0) as submission_count,
    ROUND(AVG(s.score)::numeric, 2) as average_grade
  FROM
    classes c
  LEFT JOIN (
    SELECT
      class_id,
      COUNT(*) as student_count
    FROM class_enrollments
    GROUP BY class_id
  ) student_counts ON c.id = student_counts.class_id
  LEFT JOIN (
    SELECT
      class_id,
      COUNT(*) as session_count
    FROM sessions
    GROUP BY class_id
  ) session_counts ON c.id = session_counts.class_id
  LEFT JOIN (
    SELECT
      se.class_id,
      COUNT(s.id) as submission_count
    FROM sessions se
    LEFT JOIN submissions s ON se.id = s.session_id
    GROUP BY se.class_id
  ) submission_counts ON c.id = submission_counts.class_id
  LEFT JOIN sessions sess ON c.id = sess.class_id
  LEFT JOIN submissions s ON sess.id = s.session_id
  WHERE
    (teacher_id_filter IS NULL OR c.teacher_id = teacher_id_filter)
  GROUP BY
    c.id, c.name, c.code, student_counts.student_count,
    session_counts.session_count, submission_counts.submission_count
  ORDER BY
    c.created_at DESC;
END;
$$;

-- Function to get user growth statistics
CREATE OR REPLACE FUNCTION public.get_user_growth_stats(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  date DATE,
  new_users BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at) as date,
    COUNT(*) as new_users
  FROM profiles
  WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' * days_back
  GROUP BY DATE(created_at)
  ORDER BY DATE(created_at);
END;
$$;

-- Function to get submission trends
CREATE OR REPLACE FUNCTION public.get_submission_trends(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  date DATE,
  submission_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(submitted_at) as date,
    COUNT(*) as submission_count
  FROM submissions
  WHERE submitted_at >= CURRENT_DATE - INTERVAL '1 day' * days_back
    AND submitted_at IS NOT NULL
  GROUP BY DATE(submitted_at)
  ORDER BY DATE(submitted_at);
END;
$$;

-- Function to get grade distribution
CREATE OR REPLACE FUNCTION public.get_grade_distribution()
RETURNS TABLE (
  grade_range TEXT,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN score >= 9 THEN 'A (9-10)'
      WHEN score >= 7 THEN 'B (7-8.9)'
      WHEN score >= 5 THEN 'C (5-6.9)'
      ELSE 'D (0-4.9)'
    END as grade_range,
    COUNT(*) as count
  FROM submissions
  WHERE score IS NOT NULL
  GROUP BY
    CASE
      WHEN score >= 9 THEN 'A (9-10)'
      WHEN score >= 7 THEN 'B (7-8.9)'
      WHEN score >= 5 THEN 'C (5-6.9)'
      ELSE 'D (0-4.9)'
    END
  ORDER BY
    CASE
      WHEN grade_range = 'A (9-10)' THEN 1
      WHEN grade_range = 'B (7-8.9)' THEN 2
      WHEN grade_range = 'C (5-6.9)' THEN 3
      ELSE 4
    END;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_class_statistics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_growth_stats(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_submission_trends(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_grade_distribution() TO authenticated;
