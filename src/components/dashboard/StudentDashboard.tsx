import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Upload, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import SubmissionForm from './SubmissionForm';

interface Session {
  id: string;
  title: string;
  content: string | null;
  session_order: number;
  is_active: boolean;
  class_id: string;
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
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      // Fetch active sessions
      const { data: sessions } = await supabase
        .from('sessions')
        .select(`
          *,
          classes (name, code)
        `)
        .eq('is_active', true);
      
      if (sessions) {
        setActiveSessions(sessions as Session[]);
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

    fetchData();
  }, [user]);

  const hasSubmitted = (sessionId: string) => {
    return mySubmissions.some(s => s.session_id === sessionId);
  };

  const getSubmission = (sessionId: string) => {
    return mySubmissions.find(s => s.session_id === sessionId);
  };

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
      <div>
        <h2 className="text-2xl font-bold text-foreground">Buổi học đang mở</h2>
        <p className="text-muted-foreground">Xem bài giảng và nộp bài tập</p>
      </div>

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
                  
                  <Button
                    className="w-full"
                    variant={submitted ? 'outline' : 'default'}
                    onClick={() => setSelectedSession(session)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {submitted ? 'Nộp lại bài' : 'Nộp bài'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
