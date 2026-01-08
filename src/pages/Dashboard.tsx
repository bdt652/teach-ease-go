import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLogger } from '@/hooks/useLogger';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LogOut, BookOpen, Users, GraduationCap, Shield, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import TeacherDashboard from '@/components/dashboard/TeacherDashboard';
import StudentDashboard from '@/components/dashboard/StudentDashboard';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading, signOut, hasRole, roles } = useAuth();
  const { logNavigation } = useLogger();
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setProfile(data);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Đã đăng xuất');
    logNavigation('/dashboard', '/');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isTeacher = hasRole('teacher');
  const isStudent = hasRole('student');
  const isAdmin = hasRole('admin');
  const hasNoRole = roles.length === 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">LMS Platform</h1>
              <p className="text-sm text-muted-foreground">
                Xin chào, {profile?.full_name || user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {roles.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Vai trò: {roles.map(r => r === 'teacher' ? 'Giáo viên' : r === 'student' ? 'Học sinh' : 'Admin').join(', ')}
              </div>
            )}
            {(isAdmin || isTeacher) && (
              <Button variant="outline" size="sm" onClick={() => {
                logNavigation('/dashboard', '/analytics');
                navigate('/analytics');
              }}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Thống kê
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => {
                logNavigation('/dashboard', '/admin');
                navigate('/admin');
              }}>
                <Shield className="h-4 w-4 mr-2" />
                Admin
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Đăng xuất
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {hasNoRole && (
          <Card>
            <CardHeader>
              <CardTitle>Chào mừng!</CardTitle>
              <CardDescription>
                Tài khoản của bạn chưa được gán vai trò. Vui lòng liên hệ quản trị viên để được cấp quyền truy cập.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="border-dashed">
                  <CardHeader>
                    <BookOpen className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="text-lg">Giáo viên</CardTitle>
                    <CardDescription>
                      Tạo và quản lý lớp học, buổi học, theo dõi học sinh
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="border-dashed">
                  <CardHeader>
                    <Users className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="text-lg">Học sinh</CardTitle>
                    <CardDescription>
                      Xem bài giảng, nộp bài tập, theo dõi tiến độ học tập
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </CardContent>
          </Card>
        )}

        {isTeacher && <TeacherDashboard />}
        {isStudent && !isTeacher && <StudentDashboard />}
        {isAdmin && !isTeacher && !isStudent && (
          <Card>
            <CardHeader>
              <CardTitle>Admin Dashboard</CardTitle>
              <CardDescription>Quản lý hệ thống</CardDescription>
            </CardHeader>
          </Card>
        )}
      </main>
    </div>
  );
}
