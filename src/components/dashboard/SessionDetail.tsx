import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, FileText, Users, Download, Save, Eye, MessageSquare, ChevronDown, Trash2, Fingerprint, AlertTriangle, StickyNote, Plus, Pencil } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import SessionContentView from './SessionContentView';
import FileUploader from './FileUploader';

interface Session {
  id: string;
  title: string;
  content: string | null;
  session_order: number;
  is_active: boolean;
}

interface Class {
  id: string;
  code: string;
  name: string;
}

interface Submission {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  file_path: string;
  file_type: string | null;
  code_snippet: string | null;
  teacher_note: string | null;
  ai_feedback: string | null;
  score: number | null;
  submitted_at: string;
  device_fingerprint: string | null;
  device_info: unknown;
}

interface StudentNote {
  id: string;
  session_id: string;
  student_user_id: string | null;
  student_guest_name: string | null;
  note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface SessionDetailProps {
  session: Session;
  classData: Class;
  onBack: () => void;
}

export default function SessionDetail({ session, classData, onBack }: SessionDetailProps) {
  const { user } = useAuth();
  const [content, setContent] = useState(session.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [teacherNote, setTeacherNote] = useState('');
  const [score, setScore] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [showOnlySuspicious, setShowOnlySuspicious] = useState(false);

  // Student notes
  const [studentNotes, setStudentNotes] = useState<StudentNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<StudentNote | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<{ userId: string | null; guestName: string | null } | null>(null);

  const fetchSubmissions = async () => {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('session_id', session.id)
      .order('submitted_at', { ascending: false });
    
    if (!error && data) {
      setSubmissions(data);
    }
    setLoadingSubmissions(false);
  };

  const fetchStudentNotes = async () => {
    const { data, error } = await supabase
      .from('student_notes')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setStudentNotes(data);
    }
    setLoadingNotes(false);
  };

  useEffect(() => {
    fetchSubmissions();
    fetchStudentNotes();
  }, [session.id]);

  // Get unique students from submissions
  const getUniqueStudents = () => {
    const students = new Map<string, { userId: string | null; guestName: string | null; name: string }>();
    submissions.forEach(sub => {
      const key = sub.user_id || sub.guest_name || 'unknown';
      if (!students.has(key)) {
        students.set(key, {
          userId: sub.user_id,
          guestName: sub.guest_name,
          name: sub.guest_name || 'Học sinh đã đăng nhập'
        });
      }
    });
    return Array.from(students.values());
  };

  // Get notes for a specific student
  const getNotesForStudent = (userId: string | null, guestName: string | null) => {
    return studentNotes.filter(note => 
      (userId && note.student_user_id === userId) ||
      (guestName && note.student_guest_name === guestName)
    );
  };

  const handleSaveNote = async () => {
    if (!noteText.trim() || !user) return;

    if (editingNote) {
      // Update existing note
      const { error } = await supabase
        .from('student_notes')
        .update({ note: noteText })
        .eq('id', editingNote.id);

      if (error) {
        toast.error('Không thể cập nhật ghi chú');
      } else {
        toast.success('Đã cập nhật ghi chú');
        fetchStudentNotes();
      }
    } else if (selectedStudent) {
      // Create new note
      const { error } = await supabase
        .from('student_notes')
        .insert({
          session_id: session.id,
          student_user_id: selectedStudent.userId,
          student_guest_name: selectedStudent.guestName,
          note: noteText,
          created_by: user.id
        });

      if (error) {
        toast.error('Không thể thêm ghi chú');
      } else {
        toast.success('Đã thêm ghi chú');
        fetchStudentNotes();
      }
    }

    setNoteDialogOpen(false);
    setEditingNote(null);
    setSelectedStudent(null);
    setNoteText('');
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Bạn có chắc muốn xóa ghi chú này?')) return;

    const { error } = await supabase
      .from('student_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      toast.error('Không thể xóa ghi chú');
    } else {
      toast.success('Đã xóa ghi chú');
      fetchStudentNotes();
    }
  };

  const openAddNote = (student: { userId: string | null; guestName: string | null }) => {
    setSelectedStudent(student);
    setEditingNote(null);
    setNoteText('');
    setNoteDialogOpen(true);
  };

  const openEditNote = (note: StudentNote) => {
    setEditingNote(note);
    setSelectedStudent(null);
    setNoteText(note.note);
    setNoteDialogOpen(true);
  };

  const handleSaveContent = async () => {
    setIsSaving(true);
    
    const { error } = await supabase
      .from('sessions')
      .update({ content })
      .eq('id', session.id);
    
    if (error) {
      toast.error('Không thể lưu nội dung');
    } else {
      toast.success('Đã lưu nội dung bài giảng');
    }
    
    setIsSaving(false);
  };

  const handleGradeSubmission = async () => {
    if (!selectedSubmission) return;
    
    const { error } = await supabase
      .from('submissions')
      .update({
        teacher_note: teacherNote || null,
        score: score ? parseFloat(score) : null
      })
      .eq('id', selectedSubmission.id);
    
    if (error) {
      toast.error('Không thể lưu đánh giá');
    } else {
      toast.success('Đã lưu đánh giá');
      fetchSubmissions();
      setGradeDialogOpen(false);
      setSelectedSubmission(null);
      setTeacherNote('');
      setScore('');
    }
  };

  const handleDeleteSubmission = async (submissionId: string, filePath: string) => {
    if (!confirm('Bạn có chắc muốn xóa bài nộp này?')) return;
    
    // Delete file from storage
    await supabase.storage.from('submissions').remove([filePath]);
    
    // Delete record from database
    const { error } = await supabase
      .from('submissions')
      .delete()
      .eq('id', submissionId);
    
    if (error) {
      toast.error('Không thể xóa bài nộp');
    } else {
      toast.success('Đã xóa bài nộp');
      fetchSubmissions();
    }
  };

  const getStudentName = (sub: Submission) => {
    return sub.guest_name || 'Học sinh đã đăng nhập';
  };

  // Detect suspicious submissions: same fingerprint with different names
  const getSuspiciousFingerprints = () => {
    const fingerprintMap = new Map<string, Set<string>>();
    
    submissions.forEach(sub => {
      if (sub.device_fingerprint) {
        const name = getStudentName(sub);
        if (!fingerprintMap.has(sub.device_fingerprint)) {
          fingerprintMap.set(sub.device_fingerprint, new Set());
        }
        fingerprintMap.get(sub.device_fingerprint)!.add(name);
      }
    });
    
    // Return fingerprints that have multiple different names
    const suspicious = new Set<string>();
    fingerprintMap.forEach((names, fingerprint) => {
      if (names.size > 1) {
        suspicious.add(fingerprint);
      }
    });
    
    return suspicious;
  };

  const suspiciousFingerprints = getSuspiciousFingerprints();
  
  const isSuspicious = (sub: Submission) => {
    return sub.device_fingerprint && suspiciousFingerprints.has(sub.device_fingerprint);
  };

  const getSuspiciousNames = (fingerprint: string) => {
    return submissions
      .filter(s => s.device_fingerprint === fingerprint)
      .map(s => getStudentName(s));
  };

  const downloadFile = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from('submissions')
      .download(filePath);
    
    if (error) {
      toast.error('Không thể tải file');
      return;
    }
    
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filePath.split('/').pop() || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isPreviewMode) {
    return (
      <SessionContentView
        title={session.title}
        sessionOrder={session.session_order}
        content={content}
        className={classData.name}
        classCode={classData.code}
        onBack={() => setIsPreviewMode(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <span>{classData.name}</span>
            <span>•</span>
            <Badge variant="outline" className="font-mono">{classData.code}</Badge>
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            Buổi {session.session_order}: {session.title}
          </h2>
        </div>
        {session.is_active ? (
          <Badge className="bg-green-500">Đang mở nộp bài</Badge>
        ) : (
          <Badge variant="secondary">Đã đóng</Badge>
        )}
      </div>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Nội dung bài giảng
          </TabsTrigger>
          <TabsTrigger value="submissions" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Bài nộp ({submissions.length})
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            Ghi chú ({studentNotes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ghi chú bài giảng</CardTitle>
              <CardDescription>
                Soạn nội dung buổi học cho học sinh xem
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUploader 
                sessionId={session.id}
                onFileUploaded={(file) => {
                  // Auto-insert markdown at cursor or end
                  const markdown = file.type === 'image' 
                    ? `![${file.name}](${file.url})`
                    : `[📎 ${file.name}](${file.url})`;
                  setContent((prev) => prev + '\n\n' + markdown);
                  toast.success('Đã thêm vào nội dung bài giảng');
                }}
              />
              <Textarea
                placeholder="Nhập nội dung bài giảng (hỗ trợ Markdown)..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
              <Collapsible>
                <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <p className="font-medium text-foreground">Cú pháp Markdown</p>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">Tiêu đề</p>
                        <div className="space-y-1">
                          <div><code className="bg-background px-1.5 py-0.5 rounded"># Heading 1</code></div>
                          <div><code className="bg-background px-1.5 py-0.5 rounded">## Heading 2</code></div>
                          <div><code className="bg-background px-1.5 py-0.5 rounded">### Heading 3</code></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">Định dạng chữ</p>
                        <div className="space-y-1">
                          <div><code className="bg-background px-1.5 py-0.5 rounded">**in đậm**</code></div>
                          <div><code className="bg-background px-1.5 py-0.5 rounded">*in nghiêng*</code></div>
                          <div><code className="bg-background px-1.5 py-0.5 rounded">~~gạch ngang~~</code></div>
                          <div><code className="bg-background px-1.5 py-0.5 rounded">`code inline`</code></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">Danh sách</p>
                        <div className="space-y-1">
                          <div><code className="bg-background px-1.5 py-0.5 rounded">- Mục không số</code></div>
                          <div><code className="bg-background px-1.5 py-0.5 rounded">1. Mục có số</code></div>
                          <div><code className="bg-background px-1.5 py-0.5 rounded">  - Mục con</code></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">Media & Link</p>
                        <div className="space-y-1">
                          <div><code className="bg-background px-1.5 py-0.5 rounded">![alt](url-ảnh)</code></div>
                          <div><code className="bg-background px-1.5 py-0.5 rounded">[text](url)</code></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">Trích dẫn & Code</p>
                        <div className="space-y-1">
                          <div><code className="bg-background px-1.5 py-0.5 rounded">&gt; Trích dẫn</code></div>
                          <div><code className="bg-background px-1.5 py-0.5 rounded">`code inline`</code></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">Code Block (có highlight)</p>
                        <div className="space-y-1">
                          <div><code className="bg-background px-1.5 py-0.5 rounded">```javascript</code></div>
                          <div><code className="bg-background px-1.5 py-0.5 rounded">```python</code></div>
                          <div><code className="bg-background px-1.5 py-0.5 rounded">```html</code></div>
                          <div><code className="bg-background px-1.5 py-0.5 rounded">```css</code></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">Khác</p>
                        <div className="space-y-1">
                          <div><code className="bg-background px-1.5 py-0.5 rounded">---</code> <span className="text-muted-foreground">Đường kẻ</span></div>
                          <div><code className="bg-background px-1.5 py-0.5 rounded">| A | B |</code> <span className="text-muted-foreground">Bảng</span></div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/50">
                      <p className="font-medium text-foreground mb-2">Ví dụ code block:</p>
                      <pre className="bg-background px-3 py-2 rounded text-xs overflow-x-auto">
{`\`\`\`javascript
function hello() {
  console.log("Xin chào!");
}
\`\`\``}
                      </pre>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsPreviewMode(true)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Xem trước
                </Button>
                <Button onClick={handleSaveContent} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Đang lưu...' : 'Lưu nội dung'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submissions">
          <Card>
            <CardHeader>
              <CardTitle>Danh sách bài nộp</CardTitle>
              <CardDescription>
                Xem và chấm điểm bài nộp của học sinh
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSubmissions ? (
                <div className="text-center py-8 text-muted-foreground">
                  Đang tải...
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Chưa có bài nộp nào
                </div>
              ) : (
                <div className="space-y-4">
                  {suspiciousFingerprints.size > 0 && (
                    <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <span className="text-sm font-medium">
                          Phát hiện {suspiciousFingerprints.size} thiết bị có nhiều tên khác nhau
                        </span>
                      </div>
                      <Button
                        variant={showOnlySuspicious ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => setShowOnlySuspicious(!showOnlySuspicious)}
                      >
                        {showOnlySuspicious ? "Hiển thị tất cả" : "Chỉ xem nghi ngờ"}
                      </Button>
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Học sinh</TableHead>
                        <TableHead>Thiết bị</TableHead>
                        <TableHead>Loại file</TableHead>
                        <TableHead>Thời gian nộp</TableHead>
                        <TableHead>Điểm</TableHead>
                        <TableHead>Hành động</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions
                        .filter(sub => !showOnlySuspicious || isSuspicious(sub))
                        .map((sub) => (
                        <TableRow key={sub.id} className={isSuspicious(sub) ? 'bg-destructive/10 hover:bg-destructive/20' : ''}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                            {isSuspicious(sub) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                  <div className="space-y-1 text-xs">
                                    <p className="font-semibold text-destructive">Cảnh báo: Trùng thiết bị!</p>
                                    <p>Các tên đã nộp từ thiết bị này:</p>
                                    <ul className="list-disc pl-4">
                                      {getSuspiciousNames(sub.device_fingerprint!).map((name, i) => (
                                        <li key={i}>{name}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {getStudentName(sub)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {sub.device_fingerprint ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={`flex items-center gap-1 cursor-help ${isSuspicious(sub) ? 'text-destructive' : ''}`}>
                                  <Fingerprint className={`h-4 w-4 ${isSuspicious(sub) ? 'text-destructive' : 'text-muted-foreground'}`} />
                                  <span className="font-mono text-xs">{sub.device_fingerprint.substring(0, 8)}...</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-sm">
                                <div className="space-y-1 text-xs">
                                  <p><strong>ID:</strong> {sub.device_fingerprint}</p>
                                  {sub.device_info && typeof sub.device_info === 'object' && (
                                    <>
                                      <p><strong>Platform:</strong> {(sub.device_info as Record<string, string>).platform}</p>
                                      <p><strong>Screen:</strong> {(sub.device_info as Record<string, string>).screenResolution}</p>
                                      <p><strong>Timezone:</strong> {(sub.device_info as Record<string, string>).timezone}</p>
                                    </>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground text-xs">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium">{sub.file_type || 'N/A'}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(sub.submitted_at).toLocaleString('vi-VN')}
                        </TableCell>
                        <TableCell>
                          {sub.score !== null ? (
                            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary text-primary-foreground">{sub.score}</span>
                          ) : (
                            <span className="text-muted-foreground">Chưa chấm</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadFile(sub.file_path)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Dialog open={gradeDialogOpen && selectedSubmission?.id === sub.id} onOpenChange={(open) => {
                              setGradeDialogOpen(open);
                              if (open) {
                                setSelectedSubmission(sub);
                                setTeacherNote(sub.teacher_note || '');
                                setScore(sub.score?.toString() || '');
                              }
                            }}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Đánh giá bài nộp</DialogTitle>
                                  <DialogDescription>
                                    {getStudentName(sub)}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  {sub.code_snippet && (
                                    <div>
                                      <Label>Code snippet</Label>
                                      <pre className="mt-2 p-4 bg-muted rounded-lg text-sm overflow-auto max-h-48">
                                        {sub.code_snippet}
                                      </pre>
                                    </div>
                                  )}
                                  <div className="space-y-2">
                                    <Label htmlFor="score">Điểm</Label>
                                    <Input
                                      id="score"
                                      type="number"
                                      min="0"
                                      max="10"
                                      step="0.5"
                                      placeholder="0 - 10"
                                      value={score}
                                      onChange={(e) => setScore(e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="teacher-note">Nhận xét</Label>
                                    <Textarea
                                      id="teacher-note"
                                      placeholder="Nhập nhận xét cho học sinh..."
                                      value={teacherNote}
                                      onChange={(e) => setTeacherNote(e.target.value)}
                                      rows={4}
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <Button onClick={handleGradeSubmission}>
                                      <Save className="h-4 w-4 mr-2" />
                                      Lưu đánh giá
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => handleDeleteSubmission(sub.id, sub.file_path)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Ghi chú học sinh</CardTitle>
              <CardDescription>
                Ghi chú quá trình học của từng học sinh trong buổi học này
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingNotes ? (
                <div className="text-center py-8 text-muted-foreground">
                  Đang tải...
                </div>
              ) : getUniqueStudents().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Chưa có học sinh nào nộp bài để ghi chú
                </div>
              ) : (
                <div className="space-y-4">
                  {getUniqueStudents().map((student, idx) => {
                    const notes = getNotesForStudent(student.userId, student.guestName);
                    return (
                      <Card key={idx} className="border">
                        <CardHeader className="py-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-medium">{student.name}</CardTitle>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAddNote({ userId: student.userId, guestName: student.guestName })}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Thêm ghi chú
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="py-2">
                          {notes.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">Chưa có ghi chú</p>
                          ) : (
                            <ScrollArea className="max-h-[200px]">
                              <div className="space-y-2">
                                {notes.map((note) => (
                                  <div key={note.id} className="p-3 bg-muted rounded-lg">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-sm whitespace-pre-wrap flex-1">{note.note}</p>
                                      <div className="flex gap-1 shrink-0">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7"
                                          onClick={() => openEditNote(note)}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 text-destructive hover:text-destructive"
                                          onClick={() => handleDeleteNote(note.id)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                      {new Date(note.created_at).toLocaleString('vi-VN')}
                                      {note.updated_at !== note.created_at && ' (đã sửa)'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Student Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={(open) => {
        setNoteDialogOpen(open);
        if (!open) {
          setEditingNote(null);
          setSelectedStudent(null);
          setNoteText('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingNote ? 'Chỉnh sửa ghi chú' : 'Thêm ghi chú'}
            </DialogTitle>
            <DialogDescription>
              {editingNote 
                ? `Ghi chú cho: ${editingNote.student_guest_name || 'Học sinh đã đăng nhập'}`
                : selectedStudent 
                  ? `Ghi chú cho: ${selectedStudent.guestName || 'Học sinh đã đăng nhập'}`
                  : ''
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-text">Nội dung ghi chú</Label>
              <Textarea
                id="note-text"
                placeholder="Nhập ghi chú về quá trình học của học sinh..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={6}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
                Hủy
              </Button>
              <Button onClick={handleSaveNote} disabled={!noteText.trim()}>
                <Save className="h-4 w-4 mr-2" />
                {editingNote ? 'Cập nhật' : 'Lưu ghi chú'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
