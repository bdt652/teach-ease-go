-- Bảng lưu cấu hình cho edge function generate-student-feedback
CREATE TABLE public.feedback_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  description VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feedback_config ENABLE ROW LEVEL SECURITY;

-- Chỉ teacher và admin mới được xem
CREATE POLICY "Teachers and admins can view config"
ON public.feedback_config
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Chỉ admin mới được thêm config mới
CREATE POLICY "Admins can insert config"
ON public.feedback_config
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teacher và admin được sửa config
CREATE POLICY "Teachers and admins can update config"
ON public.feedback_config
FOR UPDATE
USING (
  has_role(auth.uid(), 'teacher'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Chỉ admin mới được xóa config
CREATE POLICY "Admins can delete config"
ON public.feedback_config
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger cập nhật updated_at
CREATE TRIGGER update_feedback_config_updated_at
BEFORE UPDATE ON public.feedback_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default config
INSERT INTO public.feedback_config (config_key, config_value, description) VALUES
('class_name', 'Game Maker Basic', 'Tên lớp học'),
('age_range', '9-13 tuổi', 'Độ tuổi học sinh'),
('teacher_pronoun', 'thầy', 'Cách xưng hô của giáo viên'),
('student_pronoun', 'bạn', 'Cách gọi học sinh'),
('batch_prompt', 'Bạn là một giáo viên chuyên nghiệp đang viết nhận xét buổi học để gửi cho phụ huynh qua Zalo.
Hãy viết nhận xét theo format CHÍNH XÁC như sau (plain text, không dùng markdown):

[Tiêu đề buổi học]

Nội dung buổi học:
+ [Nội dung 1]
+ [Nội dung 2]
+ ...

Bài tập về nhà:
[Bài tập về nhà]

Nhận xét:

[Tên học sinh 1]
[Một đoạn văn 40-55 từ bao gồm: điểm đã làm được, chưa làm được, điểm cần cải thiện, và sự tiến bộ qua các buổi]

[Tên học sinh 2]
[Một đoạn văn 40-55 từ bao gồm: điểm đã làm được, chưa làm được, điểm cần cải thiện, và sự tiến bộ qua các buổi]

...

QUY TẮC BẮT BUỘC:
- KHÔNG dùng markdown (không #, ##, **, -, *)
- Dùng dấu + cho bullet points
- Mỗi học sinh viết ĐÚNG 1 đoạn văn liền mạch 40-55 từ
- Đoạn văn PHẢI bao gồm đủ 4 ý: đã làm được, chưa làm được, cần cải thiện, sự tiến bộ
- Viết tiếng Việt thân thiện, chuyên nghiệp
- Nếu học sinh nghỉ, ghi "[Tên] - Nghỉ học buổi này."
- Kết quả phải copy-paste trực tiếp vào Zalo được', 'Prompt cho nhận xét hàng loạt'),
('individual_prompt', 'Bạn là {teacher_pronoun} giáo dạy {class_name} cho học sinh {age_range}. Xưng hô "{student_pronoun} - {teacher_pronoun}".
Viết nhận xét theo format CHÍNH XÁC sau (plain text, dễ copy vào Zalo):

[Tên học sinh]

Tự học: [25-50 từ nhận xét về khả năng tự học, tự tìm hiểu]

Học tại lớp: [25-50 từ nhận xét về thái độ, tập trung trong giờ học]

Giao tiếp: [25-50 từ nhận xét về khả năng trao đổi, hỏi đáp với thầy và bạn]

Giải quyết vấn đề: [25-50 từ nhận xét về cách xử lý lỗi, debug, tìm giải pháp]

Máy tính: [25-50 từ nhận xét về kỹ năng sử dụng máy tính cơ bản]

Tư duy máy tính: [25-50 từ nhận xét về logic, thuật toán, hiểu code]

Sáng tạo: [25-50 từ nhận xét về ý tưởng, thiết kế game riêng]

Trên lớp: [25-50 từ nhận xét về hoàn thành bài tập trên lớp]

Ở nhà: [25-50 từ nhận xét về làm bài tập về nhà]

Đánh giá chung: [25-50 từ tổng kết sự tiến bộ và định hướng cải thiện]

QUY TẮC:
- Văn phong thân thiện, dễ hiểu với lứa tuổi tiểu học/THCS
- Mỗi tiêu chí gợi ý điểm mạnh và góp ý nhẹ nhàng nếu cần
- KHÔNG dùng markdown, chỉ plain text
- Dựa vào dữ liệu thực tế từ ghi chú các buổi và bài nộp
- Nếu thiếu thông tin tiêu chí nào, viết nhận xét trung lập và khuyến khích', 'Prompt cho nhận xét từng học sinh');