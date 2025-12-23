import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, ArrowRight, ArrowLeft, CheckCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import SubmissionForm from '@/components/dashboard/SubmissionForm';
import SessionContentView from '@/components/dashboard/SessionContentView';

const guestSchema = z.object({
  classCode: z.string().trim().min(1, "Vui lòng nhập mã lớp").max(20),
  guestName: z.string().trim().min(2, "Tên phải có ít nhất 2 ký tự").max(100)
});

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
    id: string;
    name: string;
    code: string;
  };
}

export default function Guest() {
  const [step, setStep] = useState<'enter-code' | 'select-session' | 'submit' | 'view-content'>('enter-code');
  const [classCode, setClassCode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [viewingSession, setViewingSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleEnterClass = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = guestSchema.safeParse({ classCode, guestName });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    
    setIsLoading(true);
    
    // Find class and active sessions
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id, name, code')
      .eq('code', classCode.toUpperCase())
      .maybeSingle();
    
    if (classError || !classData) {
      toast.error('Không tìm thấy lớp với mã này');
      setIsLoading(false);
      return;
    }
    
    // Get active sessions for this class
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('*')
      .eq('class_id', classData.id)
      .eq('is_active', true)
      .order('session_order', { ascending: true });
    
    if (!sessionData || sessionData.length === 0) {
      toast.error('Không có buổi học nào đang mở cho lớp này');
      setIsLoading(false);
      return;
    }
    
    // Add class info to sessions
    const sessionsWithClass = sessionData.map(s => ({
      ...s,
      classes: classData
    })) as Session[];
    
    setSessions(sessionsWithClass);
    setStep('select-session');
    setIsLoading(false);
  };

  const handleSelectSession = (session: Session) => {
    setSelectedSession(session);
    setStep('submit');
  };

  const handleSubmissionSuccess = () => {
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Nộp bài thành công!</h2>
            <p className="text-muted-foreground mb-6">
              Bài nộp của bạn đã được ghi nhận.
            </p>
            <div className="space-y-2">
              <Button 
                className="w-full"
                onClick={() => {
                  setSubmitted(false);
                  setStep('select-session');
                }}
              >
                Nộp bài khác
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setSubmitted(false);
                  setStep('enter-code');
                  setClassCode('');
                  setGuestName('');
                  setSessions([]);
                }}
              >
                Quay về trang chủ
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'view-content' && viewingSession) {
    return (
      <SessionContentView
        title={viewingSession.title}
        sessionOrder={viewingSession.session_order}
        content={viewingSession.content}
        className={viewingSession.classes.name}
        classCode={viewingSession.classes.code}
        onBack={() => setStep('select-session')}
      />
    );
  }

  if (step === 'submit' && selectedSession) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <SubmissionForm
            session={selectedSession}
            onBack={() => setStep('select-session')}
            onSuccess={handleSubmissionSuccess}
            isGuest={true}
            guestName={guestName}
          />
        </div>
      </div>
    );
  }

  if (step === 'select-session') {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setStep('enter-code')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Chọn buổi học</h2>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Đang nộp với tên:</span>
                <Badge>{guestName}</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {sessions.map((session) => (
              <Card 
                key={session.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleSelectSession(session)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge variant="outline" className="font-mono mb-2">
                        {session.classes.code}
                      </Badge>
                      <CardTitle className="text-lg">
                        Buổi {session.session_order}: {session.title}
                      </CardTitle>
                      <CardDescription>{session.classes.name}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {session.content && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingSession(session);
                          setStep('view-content');
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Xem bài giảng
                      </Button>
                    )}
                    <Button
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectSession(session);
                      }}
                    >
                      Nộp bài
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <GraduationCap className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Nộp bài</h1>
          <p className="text-muted-foreground mt-2">Nộp bài không cần tài khoản</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nhập thông tin</CardTitle>
            <CardDescription>
              Nhập mã lớp và tên của bạn để nộp bài
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEnterClass} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="class-code">Mã lớp</Label>
                <Input
                  id="class-code"
                  placeholder="VD: JSI36"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  className="font-mono"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-name">Tên hiển thị</Label>
                <Input
                  id="guest-name"
                  placeholder="VD: Nguyễn Văn A"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Đang kiểm tra...' : 'Tiếp tục'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Bạn có tài khoản?{' '}
            <a href="/auth" className="text-primary hover:underline">
              Đăng nhập tại đây
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
