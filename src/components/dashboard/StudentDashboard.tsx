import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BookOpen, Upload, CheckCircle, Eye, Plus, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import SubmissionForm from './SubmissionForm';
import SessionContentView from './SessionContentView';

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
  content: string | null;
  session_order: number;
  is_active: boolean;
  class_id: string;
  submission_type?: string;
  submission_instructions?: string;
  allowed_extensions?: string[];
  classes: {
    name: string;
    code: string;
  };
}

interface Submission {
  id: string;
  session_id: string;
  submitted_at: string;
  score: number | null;
  teacher_note: string | null;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [enrolledClasses, setEnrolledClasses] = useState<ClassEnrollment[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [viewingSession, setViewingSession] = useState<Session | null>(null);
  
  // Join class dialog
  const [isJoinOpen, setIsJoinOpen] = useState(false);
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
        const { data: sessions } = await supabase
          .from('sessions')
          .select(`
            *,
            classes (name, code)
          `)
          .in('class_id', classIds)
          .eq('is_active', true);
        
        if (sessions) {
          setActiveSessions(sessions as Session[]);
        }
      }
    }
    
    // Fetch my submissions
    const { data: subs } = await supabase
      .from('submissions')
      .select('*')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false });
    
    if (subs) {
      setMySubmissions(subs);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleJoinClass = async () => {
    if (!user || !joinCode.trim()) return;
    
    setIsJoining(true);
    
    // Find class by code
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id, name, code')
      .eq('code', joinCode.toUpperCase())
      .maybeSingle();
    
    if (classError || !classData) {
      toast.error('Không tìm thấy lớp với mã này');
      setIsJoining(false);
      return;
    }
    
    // Check if already enrolled
    const alreadyEnrolled = enrolledClasses.some(e => e.class_id === classData.id);
    if (alreadyEnrolled) {
      toast.error('Bạn đã tham gia lớp này rồi');
      setIsJoining(false);
      return;
    }
    
    // Enroll in class
    const { error: enrollError } = await supabase
      .from('class_enrollments')
      .insert([{
        class_id: classData.id,
        user_id: user.id
      }]);
    
    if (enrollError) {
      toast.error('Không thể tham gia lớp');
      setIsJoining(false);
      return;
    }
    
    toast.success(`Đã tham gia lớp ${classData.name}`);
    setIsJoinOpen(false);
    setJoinCode('');
    setIsJoining(false);
    fetchData();
  };

  const handleLeaveClass = async (enrollmentId: string, className: string) => {
    if (!confirm(`Bạn có chắc muốn rời khỏi lớp "${className}"?`)) return;
    
    const { error } = await supabase
      .from('class_enrollments')
      .delete()
      .eq('id', enrollmentId);
    
    if (error) {
      toast.error('Không thể rời lớp');
      return;
    }
    
    toast.success('Đã rời khỏi lớp');
    fetchData();
  };

  const hasSubmitted = (sessionId: string) => {
    return mySubmissions.some(s => s.session_id === sessionId);
  };

  const getSubmission = (sessionId: string) => {
    return mySubmissions.find(s => s.session_id === sessionId);
  };

  if (viewingSession) {
    return (
      <SessionContentView
        title={viewingSession.title}
        sessionOrder={viewingSession.session_order}
        content={viewingSession.content}
        className={viewingSession.classes.name}
        classCode={viewingSession.classes.code}
        onBack={() => setViewingSession(null)}
      />
    );
  }

  if (selectedSession) {
    return (
      <SubmissionForm
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
        onSuccess={() => {
          setSelectedSession(null);
          // Refresh submissions
          if (user) {
            supabase
              .from('submissions')
              .select('*')
              .eq('user_id', user.id)
              .order('submitted_at', { ascending: false })
              .then(({ data }) => {
                if (data) setMySubmissions(data);
              });
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* My Classes Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Lớp học của tôi</h2>
            <p className="text-muted-foreground">Các lớp bạn đã tham gia</p>
          </div>
          <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Tham gia lớp
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tham gia lớp học</DialogTitle>
                <DialogDescription>
                  Nhập mã lớp do giáo viên cung cấp
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="join-code">Mã lớp</Label>
                  <Input
                    id="join-code"
                    placeholder="VD: JSI36"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="font-mono"
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleJoinClass}
                  disabled={isJoining || !joinCode.trim()}
                >
                  {isJoining ? 'Đang tham gia...' : 'Tham gia'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

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
              <h3 className="text-lg font-medium text-foreground mb-2">Chưa tham gia lớp nào</h3>
              <p className="text-muted-foreground text-center mb-4">
                Nhập mã lớp do giáo viên cung cấp để tham gia
              </p>
              <Button onClick={() => setIsJoinOpen(true)}>
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
        <h2 className="text-2xl font-bold text-foreground">Buổi học đang mở</h2>
        <p className="text-muted-foreground mb-4">Xem bài giảng và nộp bài tập</p>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                </CardHeader>
              </Card>
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
          <div className="grid md:grid-cols-2 gap-4">
            {activeSessions.map((session) => {
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
                    <CardTitle className="text-lg">
                      Buổi {session.session_order}: {session.title}
                    </CardTitle>
                    <CardDescription>{session.classes.name}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {session.content && (
                      <div className="p-4 bg-muted rounded-lg text-sm max-h-32 overflow-auto">
                        <pre className="whitespace-pre-wrap font-sans">{session.content}</pre>
                      </div>
                    )}
                    
                    {submission?.score !== null && (
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <p className="text-sm">
                          <strong>Điểm:</strong> {submission.score}
                        </p>
                        {submission.teacher_note && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {submission.teacher_note}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      {session.content && (
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setViewingSession(session)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Xem bài giảng
                        </Button>
                      )}
                      <Button
                        className="flex-1"
                        variant={submitted ? 'outline' : 'default'}
                        onClick={() => setSelectedSession(session)}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {submitted ? 'Nộp lại bài' : 'Nộp bài'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}