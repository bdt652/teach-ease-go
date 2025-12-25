import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, studentName, sessionTitle, sessionContent, previousNotes, submissions, students, homework } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt: string;
    let userPrompt: string;

    if (type === 'batch') {
      // Batch feedback for all students - format for Zalo copy-paste
      systemPrompt = `Bạn là một giáo viên chuyên nghiệp đang viết nhận xét buổi học để gửi cho phụ huynh qua Zalo.
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
- Kết quả phải copy-paste trực tiếp vào Zalo được`;

      const studentList = students.map((s: any) => {
        const subInfo = s.submissions?.length > 0 
          ? `Đã nộp ${s.submissions.length} bài, điểm: ${s.submissions.map((sub: any) => sub.score || 'chưa chấm').join(', ')}, ghi chú GV: ${s.submissions.map((sub: any) => sub.teacher_note || '').filter(Boolean).join('; ') || 'không có'}`
          : 'Chưa nộp bài';
        return `- ${s.name}: ${subInfo}`;
      }).join('\n');

      userPrompt = `Buổi học: ${sessionTitle}

Nội dung buổi học: 
${sessionContent || 'Không có nội dung chi tiết'}

Bài tập về nhà:
${homework || 'Chưa có thông tin bài tập'}

Danh sách học sinh và thông tin bài nộp:
${studentList}

Hãy viết nhận xét chung cho buổi học này theo đúng format yêu cầu.`;

    } else {
      // Individual feedback for one student - Game Maker Basic, ages 9-13
      systemPrompt = `Bạn là thầy giáo dạy Game Maker Basic cho học sinh 9-13 tuổi. Xưng hô "bạn - thầy".
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
- Nếu thiếu thông tin tiêu chí nào, viết nhận xét trung lập và khuyến khích`;

      const previousNotesText = previousNotes?.length > 0 
        ? previousNotes.map((note: string, idx: number) => `Buổi ${idx + 1}: ${note}`).join('\n')
        : 'Chưa có ghi chú từ các buổi trước';

      userPrompt = `Học sinh: ${studentName}
Buổi học hiện tại: ${sessionTitle}
Nội dung buổi học: ${sessionContent || 'Không có nội dung chi tiết'}

Thông tin bài nộp buổi này:
- Số bài nộp: ${submissions?.length || 0}
${submissions?.length > 0 ? `- Chi tiết: ${submissions.map((s: any) => `Điểm: ${s.score || 'chưa chấm'}, Ghi chú GV: ${s.teacher_note || 'không có'}`).join('; ')}` : '- Chưa nộp bài'}

Ghi chú nhận xét từ các buổi trước:
${previousNotesText}

Hãy viết nhận xét chi tiết theo đúng format 10 tiêu chí cho học sinh này.`;
    }

    console.log('Generating feedback, type:', type);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Đã vượt quá giới hạn yêu cầu, vui lòng thử lại sau." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Cần nạp thêm credits để sử dụng tính năng AI." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const feedback = data.choices?.[0]?.message?.content;

    console.log('Generated feedback successfully');

    return new Response(JSON.stringify({ feedback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating feedback:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
