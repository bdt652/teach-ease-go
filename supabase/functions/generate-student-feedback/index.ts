import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// CẤU HÌNH MẶC ĐỊNH - Sẽ bị ghi đè bởi database
// ============================================

const DEFAULT_CONFIG = {
  class_name: "Game Maker Basic",
  age_range: "9-13 tuổi",
  teacher_pronoun: "thầy",
  student_pronoun: "bạn",
  batch_prompt: `Bạn là một giáo viên chuyên nghiệp đang viết nhận xét buổi học để gửi cho phụ huynh qua Zalo.`,
  individual_prompt: `Bạn là {teacher_pronoun} giáo dạy {class_name} cho học sinh {age_range}.`,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lấy config từ database
async function getConfig(): Promise<Record<string, string>> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("feedback_config")
    .select("config_key, config_value");

  if (error) {
    console.error("Error fetching config:", error);
    return DEFAULT_CONFIG;
  }

  const config: Record<string, string> = { ...DEFAULT_CONFIG };
  for (const row of data || []) {
    config[row.config_key] = row.config_value;
  }

  return config;
}

// Thay thế placeholder trong prompt
function replacePlaceholders(template: string, config: Record<string, string>): string {
  return template
    .replace(/{class_name}/g, config.class_name)
    .replace(/{age_range}/g, config.age_range)
    .replace(/{teacher_pronoun}/g, config.teacher_pronoun)
    .replace(/{student_pronoun}/g, config.student_pronoun);
}

// Hàm gọi Gemini API
async function callGeminiAPI(systemPrompt: string, userPrompt: string, apiKey: string) {
  const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
  
  const response = await fetch(`${API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Tạo user prompt cho batch
function buildBatchUserPrompt(sessionTitle: string, sessionContent: string, homework: string, students: any[]) {
  const studentList = students.map((s: any) => {
    const subInfo = s.submissions?.length > 0 
      ? `Đã nộp ${s.submissions.length} bài, điểm: ${s.submissions.map((sub: any) => sub.score || 'chưa chấm').join(', ')}, ghi chú GV: ${s.submissions.map((sub: any) => sub.teacher_note || '').filter(Boolean).join('; ') || 'không có'}`
      : 'Chưa nộp bài';
    return `- ${s.name}: ${subInfo}`;
  }).join('\n');

  return `Buổi học: ${sessionTitle}

Nội dung buổi học: 
${sessionContent || 'Không có nội dung chi tiết'}

Bài tập về nhà:
${homework || 'Chưa có thông tin bài tập'}

Danh sách học sinh và thông tin bài nộp:
${studentList}

Hãy viết nhận xét chung cho buổi học này theo đúng format yêu cầu.`;
}

// Tạo user prompt cho individual
function buildIndividualUserPrompt(studentName: string, sessionTitle: string, sessionContent: string, submissions: any[], previousNotes: string[]) {
  const previousNotesText = previousNotes?.length > 0 
    ? previousNotes.map((note: string, idx: number) => `Buổi ${idx + 1}: ${note}`).join('\n')
    : 'Chưa có ghi chú từ các buổi trước';

  return `Học sinh: ${studentName}
Buổi học hiện tại: ${sessionTitle}
Nội dung buổi học: ${sessionContent || 'Không có nội dung chi tiết'}

Thông tin bài nộp buổi này:
- Số bài nộp: ${submissions?.length || 0}
${submissions?.length > 0 ? `- Chi tiết: ${submissions.map((s: any) => `Điểm: ${s.score || 'chưa chấm'}, Ghi chú GV: ${s.teacher_note || 'không có'}`).join('; ')}` : '- Chưa nộp bài'}

Ghi chú nhận xét từ các buổi trước:
${previousNotesText}

Hãy viết nhận xét chi tiết theo đúng format 10 tiêu chí cho học sinh này.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, studentName, sessionTitle, sessionContent, previousNotes, submissions, students, homework } = await req.json();
    
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Lấy config từ database
    const config = await getConfig();
    console.log('Loaded config from database');

    let systemPrompt: string;
    let userPrompt: string;

    if (type === 'batch') {
      systemPrompt = config.batch_prompt;
      userPrompt = buildBatchUserPrompt(sessionTitle, sessionContent, homework, students);
    } else {
      systemPrompt = replacePlaceholders(config.individual_prompt, config);
      userPrompt = buildIndividualUserPrompt(studentName, sessionTitle, sessionContent, submissions, previousNotes);
    }

    console.log('Generating feedback, type:', type);

    const feedback = await callGeminiAPI(systemPrompt, userPrompt, apiKey);

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
