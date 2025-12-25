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
      // Batch feedback for all students
      systemPrompt = `Bạn là một giáo viên chuyên nghiệp đang viết nhận xét buổi học để gửi cho phụ huynh.
Hãy viết nhận xét theo format CHÍNH XÁC như sau:

# [Tiêu đề buổi học]

## Nội dung buổi học:
[Tóm tắt nội dung buổi học thành các bullet points ngắn gọn]

## Bài tập về nhà:
[Bài tập về nhà nếu có, hoặc ghi "Không có bài tập về nhà"]

## Nhận xét từng học sinh:

### [Tên học sinh 1]
[Nhận xét ngắn gọn 2-3 câu về điểm mạnh, điểm cần cải thiện]

### [Tên học sinh 2]
[Nhận xét ngắn gọn 2-3 câu]

...

Lưu ý:
- Viết bằng tiếng Việt, giọng văn thân thiện nhưng chuyên nghiệp
- Nhận xét cụ thể cho từng học sinh dựa trên thông tin bài nộp
- Nếu học sinh nghỉ, ghi "Nghỉ học buổi này"
- Mỗi nhận xét học sinh chỉ 2-3 câu, súc tích`;

      const studentList = students.map((s: any) => {
        const subInfo = s.submissions?.length > 0 
          ? `Đã nộp ${s.submissions.length} bài, điểm: ${s.submissions.map((sub: any) => sub.score || 'chưa chấm').join(', ')}`
          : 'Chưa nộp bài';
        return `- ${s.name}: ${subInfo}`;
      }).join('\n');

      userPrompt = `Buổi học: ${sessionTitle}

Nội dung buổi học: 
${sessionContent || 'Không có nội dung chi tiết'}

Bài tập về nhà:
${homework || 'Chưa có thông tin bài tập'}

Danh sách học sinh:
${studentList}

Hãy viết nhận xét chung cho buổi học này.`;

    } else {
      // Individual feedback for one student
      systemPrompt = `Bạn là một giáo viên chuyên nghiệp đang viết nhận xét cho phụ huynh về tiến độ học tập của học sinh. 
Hãy viết nhận xét theo format sau và PHẢI tuân thủ chính xác:

**Điểm đã làm được:**
- [Liệt kê các điểm tích cực, kỹ năng đã thể hiện tốt]

**Chưa làm được:**
- [Liệt kê các điểm cần cải thiện, lỗi mắc phải nếu có]

**Điểm cần cải thiện:**
- [Đề xuất cụ thể cách cải thiện]

**Sự tiến bộ:**
- [Nhận xét về sự tiến bộ so với các buổi trước nếu có thông tin, hoặc tiềm năng phát triển]

Lưu ý:
- Viết bằng tiếng Việt, giọng văn thân thiện nhưng chuyên nghiệp
- Nhận xét cụ thể, không chung chung
- Mỗi mục có 1-3 ý
- Nếu không có thông tin về mục nào, hãy ghi "Chưa có đủ thông tin đánh giá"`;

      userPrompt = `Học sinh: ${studentName}
Buổi học: ${sessionTitle}
Nội dung buổi học: ${sessionContent || 'Không có nội dung chi tiết'}
Số bài nộp: ${submissions?.length || 0}
${submissions?.length > 0 ? `Thông tin bài nộp: ${JSON.stringify(submissions.map((s: any) => ({ score: s.score, teacher_note: s.teacher_note })))}` : ''}
${previousNotes?.length > 0 ? `Ghi chú các buổi trước: ${previousNotes.join('\n')}` : 'Đây là buổi đầu tiên hoặc chưa có ghi chú trước đó'}

Hãy viết nhận xét cho học sinh này.`;
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
