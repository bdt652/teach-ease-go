import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { z } from 'zod';
import { GraduationCap, BookOpen, Users, LogIn, ArrowLeft } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Email không hợp lệ" }).max(255),
  password: z.string().min(6, { message: "Mật khẩu phải có ít nhất 6 ký tự" }).max(100),
});

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const validation = loginSchema.safeParse({ email, password });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        setIsLoading(false);
        return;
      }
      
      const { error } = await signIn(email, password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Email hoặc mật khẩu không đúng');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Email chưa được xác nhận');
        } else {
          toast.error('Đăng nhập thất bại: ' + error.message);
        }
      } else {
        toast.success('Đăng nhập thành công!');
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error('Có lỗi xảy ra');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <GraduationCap className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">EduCode</h1>
          <p className="text-muted-foreground mt-2">Hệ thống quản lý lớp học lập trình</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              Đăng nhập
            </CardTitle>
            <CardDescription>Đăng nhập bằng tài khoản của bạn</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 space-y-3">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate('/guest')}
          >
            Nộp bài với tư cách khách (không cần tài khoản)
          </Button>
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Về trang chủ
          </Button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-lg bg-card border">
            <BookOpen className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-xs text-muted-foreground">Quản lý lớp học</p>
          </div>
          <div className="p-4 rounded-lg bg-card border">
            <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-xs text-muted-foreground">Theo dõi học sinh</p>
          </div>
          <div className="p-4 rounded-lg bg-card border">
            <GraduationCap className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-xs text-muted-foreground">Nộp bài dễ dàng</p>
          </div>
        </div>
      </div>
    </div>
  );
}
