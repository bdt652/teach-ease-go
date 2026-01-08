import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLogger } from '@/hooks/useLogger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { BookOpen, Eye, Upload, CheckCircle, Plus, LogOut } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ClassEnrollment {
  id: string;
  class_id: string;
  classes: {
    id: string;
    name: string;
    code: string;
  };
}

interface Session {
  id: string;
  title: string;
  content?: string;
  session_order: number;
  class_id: string;
  is_active: boolean;
  created_at: string;
  classes: {
    name: string;
    code: string;
  };
}

interface Submission {
  id: string;
  session_id: string;
  content?: string;
  score?: number;
  teacher_note?: string;
  submitted_at: string;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const { logClassAction, logSessionAction, logSubmissionAction, logAction } = useLogger();
  const [enrolledClasses, setEnrolledClasses] = useState<ClassEnrollment[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassEnrollment | null>(null);
  const [viewingSession, setViewingSession] = useState<Session | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const fetchData = async () => {
    if (!user) return;

    // Fetch enrolled classes
    const { data: enrollments } = await supabase
      .from('class_enrollments')
      .select(`
        id,
        class_id,
        classes (id, name, code)
      `)
      .eq('user_id', user.id);

    if (enrollments) {
      setEnrolledClasses(enrollments as ClassEnrollment[]);

      // Fetch active sessions for enrolled classes only
      const classIds = enrollments.map(e => e.class_id);

      if (classIds.length > 0) {
        // Lấy nhiều buổi học hơn để hiển thị cho các lớp khác nhau
        const { data: sessions } = await supabase
          .from('sessions')
          .select(`
            *,
            classes (name, code)
          `)
          .in('class_id', classIds)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(20); // Lấy nhiều buổi học hơn

        if (sessions) {
          setActiveSessions(sessions as Session[]);
        }
      }
    }

    // Fetch submissions
    const { data: submissionData } = await supabase
      .from('submissions')
      .select('*')
      .eq('student_id', user.id);

    if (submissionData) {
      setSubmissions(submissionData as Submission[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const hasSubmitted = (sessionId: string) => {
    return submissions.some(sub => sub.session_id === sessionId);
  };

  const getSubmission = (sessionId: string) => {
    return submissions.find(sub => sub.session_id === sessionId);
  };

  const handleJoinClass = async () => {
    if (!joinCode.trim()) {
      toast.error('Vui lòng nhập mã lớp');
      return;
    }

    setIsJoining(true);
    try {
      // Find class by code
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('code', joinCode.trim())
        .single();

      if (classError || !classData) {
        toast.error('Không tìm thấy lớp học với mã này');
        logClassAction('JOIN_FAILED', classData?.id || '', 'Unknown', { code: joinCode.trim(), error: 'Class not found' });
        return;
      }

      // Check if already enrolled
      const { data: existingEnrollment } = await supabase
        .from('class_enrollments')
        .select('id')
        .eq('user_id', user?.id)
        .eq('class_id', classData.id)
        .single();

      if (existingEnrollment) {
        toast.error('Bạn đã tham gia lớp học này rồi');
        logClassAction('JOIN_FAILED', classData.id, classData.name, { code: joinCode.trim(), error: 'Already enrolled' });
        return;
      }

      // Enroll in class
      const { error: enrollError } = await supabase
        .from('class_enrollments')
        .insert({
          user_id: user?.id,
          class_id: classData.id,
        });

      if (enrollError) {
        toast.error('Không thể tham gia lớp học');
        logClassAction('JOIN_FAILED', classData.id, classData.name, { code: joinCode.trim(), error: enrollError.message });
        return;
      }

      toast.success(`Đã tham gia lớp "${classData.name}" thành công!`);
      logClassAction('JOIN_SUCCESS', classData.id, classData.name, { code: joinCode.trim() });
      setJoinCode('');
      fetchData();
    } catch (error) {
      toast.error('Có lỗi xảy ra khi tham gia lớp');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveClass = async (enrollmentId: string, className: string) => {
    try {
      const { error } = await supabase
        .from('class_enrollments')
        .delete()
        .eq('id', enrollmentId);

      if (error) {
        toast.error('Không thể rời khỏi lớp học');
        return;
      }

      toast.success(`Đã rời khỏi lớp "${className}"`);
      fetchData();
    } catch (error) {
      toast.error('Có lỗi xảy ra');
    }
  };

  return (
    <div className="space-y-8">
      {/* Classes Section */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Lớp học của tôi</h2>
        <p className="text-muted-foreground mb-4">Danh sách lớp học bạn đã tham gia</p>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : enrolledClasses.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Chưa tham gia lớp học nào</h3>
              <p className="text-muted-foreground text-center mb-6">
                Hãy tham gia lớp học bằng mã mời từ giáo viên
              </p>
              <Button onClick={() => setIsJoining(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Tham gia lớp
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {enrolledClasses.map((enrollment) => (
              <Card key={enrollment.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono">
                      {enrollment.classes.code}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleLeaveClass(enrollment.id, enrollment.classes.name)}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardTitle className="text-lg">{enrollment.classes.name}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Active Sessions Section */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Buổi học theo lớp</h2>
        <p className="text-muted-foreground mb-4">Xem bài giảng và nộp bài tập theo từng lớp học</p>

        {loading ? (
          <div className="space-y-6">
            {[1, 2].map(i => (
              <div key={i} className="space-y-4">
                <div className="h-6 bg-muted rounded w-1/3" />
                <div className="grid md:grid-cols-1 gap-4">
                  <Card className="animate-pulse">
                    <CardHeader>
                      <div className="h-6 bg-muted rounded w-3/4" />
                    </CardHeader>
                  </Card>
                </div>
              </div>
            ))}
          </div>
        ) : activeSessions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Không có buổi học nào đang mở</h3>
              <p className="text-muted-foreground text-center">
                Giáo viên sẽ mở buổi học khi đến giờ
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Group sessions by class */}
            {enrolledClasses.map((enrollment) => {
              const classSessions = activeSessions.filter(session => session.class_id === enrollment.class_id);

              if (classSessions.length === 0) return null;

              return (
                <div key={enrollment.id} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">
                      {enrollment.classes.code}
                    </Badge>
                    <h3 className="text-lg font-semibold">{enrollment.classes.name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {classSessions.length} buổi học
                    </Badge>
                  </div>

                  <div className="grid md:grid-cols-1 gap-4">
                    {classSessions
                      .sort((a, b) => b.session_order - a.session_order) // Sắp xếp theo session_order giảm dần (buổi mới nhất trước)
                      .map((session) => {
                      const submitted = hasSubmitted(session.id);
                      const submission = getSubmission(session.id);

                      return (
                        <Card key={session.id}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="font-mono">
                                {session.classes.code}
                              </Badge>
                              {submitted && (
                                <Badge className="bg-green-500">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Đã nộp
                                </Badge>
                              )}
                            </div>
                            <CardTitle className="text-base">
                              Buổi {session.session_order}: {session.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {session.content && (
                              <div className="p-3 bg-muted rounded-lg text-sm max-h-24 overflow-auto mb-3 prose prose-xs max-w-none">
                                <ReactMarkdown>
                                  {session.content}
                                </ReactMarkdown>
                              </div>
                            )}

                            {submission?.score !== null && submission?.score !== undefined && (
                              <div className="p-3 bg-primary/10 rounded-lg mb-3">
                                <p className="text-sm">
                                  <strong>Điểm:</strong> {submission?.score}
                                </p>
                                {submission.teacher_note && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {submission.teacher_note}
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                  logSessionAction('VIEW_CONTENT', session.id, session.title, session.class_id);
                                  setViewingSession(session);
                                }}
                              >
                                <Eye className="h-3 w-3 mr-2" />
                                Xem bài giảng
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  logSessionAction('START_SUBMISSION', session.id, session.title, session.class_id);
                                  setSelectedSession(session);
                                }}
                                disabled={submitted}
                              >
                                <Upload className="h-3 w-3 mr-2" />
                                {submitted ? 'Đã nộp' : 'Nộp bài'}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Join Class Dialog */}
      <Dialog open={isJoining} onOpenChange={setIsJoining}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tham gia lớp học</DialogTitle>
            <DialogDescription>
              Nhập mã lớp học từ giáo viên để tham gia
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="joinCode">Mã lớp học</Label>
              <Input
                id="joinCode"
                placeholder="Nhập mã lớp học"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinClass()}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleJoinClass}
                disabled={isJoining}
                className="flex-1"
              >
                {isJoining ? 'Đang tham gia...' : 'Tham gia'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsJoining(false);
                  setJoinCode('');
                }}
              >
                Hủy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Session Dialog */}
      <Dialog open={!!viewingSession} onOpenChange={() => setViewingSession(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewingSession && `Buổi ${viewingSession.session_order}: ${viewingSession.title}`}
            </DialogTitle>
          </DialogHeader>
          {viewingSession && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Nội dung bài giảng:</h4>
                <div className="text-sm prose prose-sm max-w-none">
                  <ReactMarkdown>
                    {viewingSession.content || 'Không có nội dung'}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Submit Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Nộp bài tập - {selectedSession?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <SubmitDialog
              session={selectedSession}
              onSubmit={() => {
                setSelectedSession(null);
                fetchData();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Class Details Dialog */}
      <Dialog open={!!selectedClass} onOpenChange={() => setSelectedClass(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Chi tiết lớp học</DialogTitle>
          </DialogHeader>
          {selectedClass && <ClassDetails enrollment={selectedClass} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Submit Dialog Component
function SubmitDialog({ session, onSubmit }: { session: Session; onSubmit: () => void }) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error('Vui lòng nhập nội dung bài làm');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('submissions')
        .insert({
          session_id: session.id,
          student_id: user?.id,
          content: content.trim(),
        });

      if (error) {
        toast.error('Không thể nộp bài tập');
        logSubmissionAction('CREATE_FAILED', '', session.id, { error: error.message, contentLength: content.trim().length });
        return;
      }

      toast.success('Đã nộp bài tập thành công!');
      logSubmissionAction('CREATE_SUCCESS', '', session.id, { contentLength: content.trim().length });
      onSubmit();
    } catch (error) {
      toast.error('Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="content">Nội dung bài làm</Label>
        <Textarea
          id="content"
          placeholder="Nhập nội dung bài làm của bạn..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
          {submitting ? 'Đang nộp...' : 'Nộp bài'}
        </Button>
        <Button variant="outline" onClick={onSubmit}>
          Hủy
        </Button>
      </div>
    </div>
  );
}

// Class Details Component
function ClassDetails({ enrollment }: { enrollment: ClassEnrollment }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('class_id', enrollment.class_id)
        .order('session_order', { ascending: true });

      if (data) {
        setSessions(data as Session[]);
      }
      setLoading(false);
    };

    fetchSessions();
  }, [enrollment.class_id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="font-mono">
          {enrollment.classes.code}
        </Badge>
        <h3 className="text-lg font-semibold">{enrollment.classes.name}</h3>
      </div>

      <div>
        <h4 className="font-medium mb-3">Danh sách buổi học:</h4>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-muted-foreground">Chưa có buổi học nào</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">
                    Buổi {session.session_order}: {session.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {session.is_active ? 'Đang mở' : 'Đã đóng'}
                  </p>
                </div>
                <Badge variant={session.is_active ? 'default' : 'secondary'}>
                  {session.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
