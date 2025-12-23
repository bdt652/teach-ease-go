import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, BookOpen, Users, Calendar, Settings } from 'lucide-react';
import { toast } from 'sonner';
import ClassDetail from './ClassDetail';

interface Class {
  id: string;
  code: string;
  name: string;
  schedule_info: string | null;
  created_at: string;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  
  // Create class form
  const [newClassName, setNewClassName] = useState('');
  const [newClassCode, setNewClassCode] = useState('');
  const [newSchedule, setNewSchedule] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchClasses = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Không thể tải danh sách lớp');
    } else {
      setClasses(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClasses();
  }, [user]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsCreating(true);
    
    const { error } = await supabase
      .from('classes')
      .insert({
        name: newClassName,
        code: newClassCode.toUpperCase(),
        schedule_info: newSchedule || null,
        teacher_id: user.id
      });
    
    if (error) {
      if (error.code === '23505') {
        toast.error('Mã lớp đã tồn tại');
      } else {
        toast.error('Không thể tạo lớp: ' + error.message);
      }
    } else {
      toast.success('Tạo lớp thành công!');
      setNewClassName('');
      setNewClassCode('');
      setNewSchedule('');
      setIsCreateOpen(false);
      fetchClasses();
    }
    
    setIsCreating(false);
  };

  if (selectedClass) {
    return (
      <ClassDetail 
        classData={selectedClass} 
        onBack={() => setSelectedClass(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Lớp học của tôi</h2>
          <p className="text-muted-foreground">Quản lý các lớp học và buổi học</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tạo lớp mới
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tạo lớp học mới</DialogTitle>
              <DialogDescription>
                Điền thông tin để tạo lớp học mới
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateClass} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="class-name">Tên môn học</Label>
                <Input
                  id="class-name"
                  placeholder="VD: Python Cơ bản"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-code">Mã lớp (Unique)</Label>
                <Input
                  id="class-code"
                  placeholder="VD: JSI36"
                  value={newClassCode}
                  onChange={(e) => setNewClassCode(e.target.value.toUpperCase())}
                  maxLength={20}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Học sinh sẽ dùng mã này để nộp bài
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule">Ca học (Tùy chọn)</Label>
                <Input
                  id="schedule"
                  placeholder="VD: 10-12h Chủ nhật"
                  value={newSchedule}
                  onChange={(e) => setNewSchedule(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? 'Đang tạo...' : 'Tạo lớp'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : classes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Chưa có lớp học nào</h3>
            <p className="text-muted-foreground text-center mb-4">
              Bắt đầu bằng cách tạo lớp học đầu tiên
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tạo lớp mới
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <Card 
              key={cls.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedClass(cls)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{cls.name}</CardTitle>
                    <CardDescription className="font-mono text-primary">
                      {cls.code}
                    </CardDescription>
                  </div>
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {cls.schedule_info && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {cls.schedule_info}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
