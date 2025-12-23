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
import { ArrowLeft, FileText, Users, Download, Save, Eye, MessageSquare, ChevronDown, Trash2, Fingerprint } from 'lucide-react';
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

  useEffect(() => {
    fetchSubmissions();
  }, [session.id]);

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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Học sinh</TableHead>
                      <TableHead>Học sinh</TableHead>
                      <TableHead>Thiết bị</TableHead>
                      <TableHead>Loại file</TableHead>
                      <TableHead>Thời gian nộp</TableHead>
                      <TableHead>Điểm</TableHead>
                      <TableHead>Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">
                          {getStudentName(sub)}
                        </TableCell>
                        <TableCell>
                          {sub.device_fingerprint ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-help">
                                  <Fingerprint className="h-4 w-4 text-muted-foreground" />
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
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
