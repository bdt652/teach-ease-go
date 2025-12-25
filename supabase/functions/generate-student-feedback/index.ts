import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// CẤU HÌNH MẶC ĐỊNH
// ============================================

const DEFAULT_CONFIG = {
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

// Khởi tạo Supabase client
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseKey);
}

// Lấy API key khả dụng từ database (rotation)
async function getAvailableApiKey(supabase: any): Promise<{ id: string; key: string } | null> {
  // Lấy key active, chưa bị limit, ưu tiên key ít dùng nhất
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, api_key")
    .eq("provider", "gemini")
    .eq("is_active", true)
    .eq("is_limited", false)
    .order("usage_count", { ascending: true })
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching API key:", error);
    return null;
  }

  return data ? { id: data.id, key: data.api_key } : null;
}

// Đánh dấu key đã bị limit
async function markKeyAsLimited(supabase: any, keyId: string) {
  await supabase
    .from("api_keys")
    .update({ 
      is_limited: true, 
      limited_at: new Date().toISOString() 
    })
    .eq("id", keyId);
  
  console.log(`Marked API key ${keyId} as limited`);
}

// Cập nhật usage count và last_used
async function updateKeyUsage(supabase: any, keyId: string) {
  await supabase.rpc('increment_api_key_usage', { key_id: keyId }).catch(() => {
    // Fallback nếu RPC chưa tồn tại
    supabase
      .from("api_keys")
      .update({ 
        last_used_at: new Date().toISOString(),
        usage_count: supabase.sql`usage_count + 1`
      })
      .eq("id", keyId);
  });
}

// Reset các key đã hết limit (sau 1 phút)
async function resetLimitedKeys(supabase: any) {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  
  await supabase
    .from("api_keys")
    .update({ is_limited: false, limited_at: null })
    .eq("is_limited", true)
    .lt("limited_at", oneMinuteAgo);
}

// Lấy config từ database
async function getConfig(supabase: any): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("feedback_config")
    .select("config_key, config_value");

  if (error) {
    console.error("Error fetching config:", error);
    return { ...DEFAULT_CONFIG };
  }

  const config: Record<string, string> = { ...DEFAULT_CONFIG };
  for (const row of data || []) {
    config[row.config_key] = row.config_value;
  }

  return config;
}

// Lấy tên lớp từ session_id
async function getClassName(supabase: any, sessionId?: string): Promise<string> {
  if (!sessionId) return "Lớp học";
  
  try {
    const { data: session } = await supabase
      .from("sessions")
      .select("class_id")
      .eq("id", sessionId)
      .maybeSingle();
    
    if (session?.class_id) {
      const { data: classData } = await supabase
        .from("classes")
        .select("name")
        .eq("id", session.class_id)
        .maybeSingle();
      return classData?.name || "Lớp học";
    }
    
    return "Lớp học";
  } catch (error) {
    console.error("Error fetching class name:", error);
    return "Lớp học";
  }
}

// Thay thế placeholder trong prompt
function replacePlaceholders(template: string, config: Record<string, string>, className: string): string {
  return template
    .replace(/{class_name}/g, className)
    .replace(/{age_range}/g, config.age_range || DEFAULT_CONFIG.age_range)
    .replace(/{teacher_pronoun}/g, config.teacher_pronoun || DEFAULT_CONFIG.teacher_pronoun)
    .replace(/{student_pronoun}/g, config.student_pronoun || DEFAULT_CONFIG.student_pronoun);
}

// Hàm gọi Gemini API với retry và rotation
async function callGeminiAPIWithRotation(
  supabase: any,
  systemPrompt: string, 
  userPrompt: string, 
  maxRetries: number = 3
): Promise<string> {
  const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
  
  // Reset các key đã hết limit trước
  await resetLimitedKeys(supabase);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const keyData = await getAvailableApiKey(supabase);
    
    if (!keyData) {
      // Không còn key nào khả dụng, thử dùng env variable
      const envKey = Deno.env.get("GEMINI_API_KEY");
      if (envKey) {
        console.log("No database keys available, using env GEMINI_API_KEY");
        return await callGeminiAPI(systemPrompt, userPrompt, envKey);
      }
      throw new Error("Không có API key khả dụng. Vui lòng thêm API key trong Admin hoặc thử lại sau.");
    }

    console.log(`Attempt ${attempt + 1}: Using API key ${keyData.id.slice(0, 8)}...`);

    try {
      const response = await fetch(`${API_URL}?key=${keyData.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      if (response.status === 429 || response.status === 403) {
        // Rate limited hoặc quota exceeded - đánh dấu key và thử key khác
        console.log(`API key ${keyData.id.slice(0, 8)} hit rate limit (${response.status})`);
        await markKeyAsLimited(supabase, keyData.id);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error:", response.status, errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      // Thành công - cập nhật usage
      await updateKeyUsage(supabase, keyData.id);
      
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      console.error(`Attempt ${attempt + 1} failed:`, error);
    }
  }

  throw new Error("Đã thử tất cả API keys nhưng không thành công");
}

// Hàm gọi Gemini API đơn giản (fallback)
async function callGeminiAPI(systemPrompt: string, userPrompt: string, apiKey: string) {
  const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
  
  const response = await fetch(`${API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
function buildBatchUserPrompt(
  className: string,
  sessionTitle: string, 
  sessionContent: string, 
  homework: string, 
  students: any[]
) {
  const studentList = students.map((s: any) => {
    const subInfo = s.submissions?.length > 0 
      ? `Đã nộp ${s.submissions.length} bài, điểm: ${s.submissions.map((sub: any) => sub.score || 'chưa chấm').join(', ')}, ghi chú GV: ${s.submissions.map((sub: any) => sub.teacher_note || '').filter(Boolean).join('; ') || 'không có'}`
      : 'Chưa nộp bài';
    return `- ${s.name}: ${subInfo}`;
  }).join('\n');

  return `Lớp: ${className}
Buổi học: ${sessionTitle}

Nội dung buổi học: 
${sessionContent || 'Không có nội dung chi tiết'}

Bài tập về nhà:
${homework || 'Chưa có thông tin bài tập'}

Danh sách học sinh và thông tin bài nộp:
${studentList}

Hãy viết nhận xét chung cho buổi học này theo đúng format yêu cầu.`;
}

// Tạo user prompt cho individual
function buildIndividualUserPrompt(
  className: string,
  studentName: string, 
  sessionTitle: string, 
  sessionContent: string, 
  submissions: any[], 
  previousNotes: string[]
) {
  const previousNotesText = previousNotes?.length > 0 
    ? previousNotes.map((note: string, idx: number) => `Buổi ${idx + 1}: ${note}`).join('\n')
    : 'Chưa có ghi chú từ các buổi trước';

  return `Lớp: ${className}
Học sinh: ${studentName}
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
    const { 
      type, 
      studentName, 
      sessionId,
      classId,
      sessionTitle, 
      sessionContent, 
      previousNotes, 
      submissions, 
      students, 
      homework 
    } = await req.json();

    const supabase = getSupabaseClient();

    // Lấy config và tên lớp từ database
    const [config, className] = await Promise.all([
      getConfig(supabase),
      getClassName(supabase, sessionId)
    ]);

    console.log('Loaded config, class:', className);

    let systemPrompt: string;
    let userPrompt: string;

    if (type === 'batch') {
      systemPrompt = config.batch_prompt || DEFAULT_CONFIG.batch_prompt;
      userPrompt = buildBatchUserPrompt(className, sessionTitle, sessionContent, homework, students);
    } else {
      systemPrompt = replacePlaceholders(
        config.individual_prompt || DEFAULT_CONFIG.individual_prompt, 
        config, 
        className
      );
      userPrompt = buildIndividualUserPrompt(className, studentName, sessionTitle, sessionContent, submissions, previousNotes);
    }

    console.log('Generating feedback, type:', type);

    // Gọi API với rotation
    const feedback = await callGeminiAPIWithRotation(supabase, systemPrompt, userPrompt);

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
