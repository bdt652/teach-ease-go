import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookOpen, Users, Calendar, Clock, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface ClassInfo {
  id: string;
  code: string;
  name: string;
  schedule_info: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
}

export default function JoinClass() {
  const { classCode } = useParams<{ classCode: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (classCode) {
      fetchClassInfo(classCode);
    } else {
      setLoading(false);
    }
  }, [classCode]);

  useEffect(() => {
    if (user && classInfo) {
      checkEnrollment();
    }
  }, [user, classInfo]);

  const fetchClassInfo = async (code: string) => {
    setLoading(true);
    setError('');
    
    const { data, error } = await supabase
      .from('classes')
      .select('id, code, name, schedule_info, start_date, end_date, start_time, end_time')
      .eq('code', code.toUpperCase())
      .maybeSingle();
    
    if (error) {
      setError('Có lỗi xảy ra khi tìm lớp học');
    } else if (!data) {
      setError('Không tìm thấy lớp học với mã này');
    } else {
      setClassInfo(data);
    }
    
    setLoading(false);
  };

  const checkEnrollment = async () => {
    if (!user || !classInfo) return;
    
    const { data } = await supabase
      .from('class_enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('class_id', classInfo.id)
      .maybeSingle();
    
    setIsEnrolled(!!data);
  };

  const handleJoinClass = async () => {
    if (!user) {
      // Redirect to login with return URL
      navigate(`/auth?redirect=/join/${classCode || manualCode}`);
      return;
    }

    if (!classInfo) return;

    setIsJoining(true);
    
    const { error } = await supabase
      .from('class_enrollments')
      .insert({
        user_id: user.id,
        class_id: classInfo.id
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('Bạn đã tham gia lớp này rồi');
        setIsEnrolled(true);
      } else {
        toast.error('Không thể tham gia lớp: ' + error.message);
      }
    } else {
      toast.success('Đã tham gia lớp thành công!');
      setIsEnrolled(true);
    }
    
    setIsJoining(false);
  };

  const handleSearchClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      navigate(`/join/${manualCode.trim().toUpperCase()}`);
      fetchClassInfo(manualCode.trim());
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: vi });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return null;
    return timeStr.substring(0, 5);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Tham gia lớp học</CardTitle>
          <CardDescription>
            {classCode ? 'Xác nhận tham gia lớp học' : 'Nhập mã lớp để tham gia'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {!classCode && !classInfo && (
            <form onSubmit={handleSearchClass} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="class-code">Mã lớp học</Label>
                <Input
                  id="class-code"
                  placeholder="VD: JSI36"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  className="text-center text-lg font-mono"
                  maxLength={20}
                />
              </div>
              <Button type="submit" className="w-full">
                Tìm lớp học
              </Button>
            </form>
          )}

          {error && (
            <div className="text-center py-4">
              <p className="text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={() => {
                setError('');
                setClassInfo(null);
                navigate('/join');
              }}>
                Thử mã khác
              </Button>
            </div>
          )}

          {classInfo && (
            <div className="space-y-4">
              {/* Class Info */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-lg">{classInfo.name}</h3>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                    {classInfo.code}
                  </code>
                </div>
                
                {(classInfo.start_date || classInfo.end_date) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {formatDate(classInfo.start_date) || '?'} - {formatDate(classInfo.end_date) || '?'}
                    </span>
                  </div>
                )}
                
                {(classInfo.start_time || classInfo.end_time) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {formatTime(classInfo.start_time) || '?'} - {formatTime(classInfo.end_time) || '?'}
                    </span>
                  </div>
                )}

                {classInfo.schedule_info && (
                  <p className="text-sm text-muted-foreground">{classInfo.schedule_info}</p>
                )}
              </div>

              {/* Action Buttons */}
              {isEnrolled ? (
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Bạn đã tham gia lớp này</span>
                  </div>
                  <Button onClick={() => navigate('/dashboard')} className="w-full">
                    Đi đến Dashboard
                  </Button>
                </div>
              ) : user ? (
                <Button 
                  onClick={handleJoinClass} 
                  disabled={isJoining}
                  className="w-full"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Đang tham gia...
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4 mr-2" />
                      Tham gia lớp học
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-center text-muted-foreground">
                    Bạn cần đăng nhập để tham gia lớp học
                  </p>
                  <Button onClick={handleJoinClass} className="w-full">
                    Đăng nhập để tham gia
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Back button */}
          <div className="pt-4 border-t">
            <Button 
              variant="ghost" 
              className="w-full"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Về trang chủ
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
