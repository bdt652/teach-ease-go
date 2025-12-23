import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, BookOpen, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInWeeks, addWeeks } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import ClassDetail from './ClassDetail';

interface Class {
  id: string;
  code: string;
  name: string;
  schedule_info: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
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
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
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
    
    // Validate dates
    if (startDate && endDate && startDate > endDate) {
      toast.error('Ngày bắt đầu phải trước ngày kết thúc');
      return;
    }

    // Validate times
    if (startTime && endTime && startTime >= endTime) {
      toast.error('Giờ bắt đầu phải trước giờ kết thúc');
      return;
    }
    
    setIsCreating(true);
    
    const { data: newClass, error } = await supabase
      .from('classes')
      .insert({
        name: newClassName,
        code: newClassCode.toUpperCase(),
        schedule_info: newSchedule || null,
        start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
        end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
        start_time: startTime || null,
        end_time: endTime || null,
        teacher_id: user.id
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        toast.error('Mã lớp đã tồn tại');
      } else {
        toast.error('Không thể tạo lớp: ' + error.message);
      }
      setIsCreating(false);
      return;
    }

    // Tự động tạo các buổi học nếu có ngày bắt đầu và kết thúc
    if (startDate && endDate && newClass) {
      const weeks = differenceInWeeks(endDate, startDate) + 1; // +1 để bao gồm tuần đầu
      const sessionsToCreate = [];
      
      for (let i = 0; i < weeks; i++) {
        const sessionDate = addWeeks(startDate, i);
        sessionsToCreate.push({
          class_id: newClass.id,
          title: `Buổi ${i + 1}`,
          session_order: i + 1,
          is_active: i === 0 // Chỉ buổi đầu tiên active
        });
      }
      
      if (sessionsToCreate.length > 0) {
        const { error: sessionError } = await supabase
          .from('sessions')
          .insert(sessionsToCreate);
        
        if (sessionError) {
          toast.error('Tạo lớp thành công nhưng không thể tạo buổi học');
        } else {
          toast.success(`Tạo lớp thành công với ${sessionsToCreate.length} buổi học!`);
        }
      }
    } else {
      toast.success('Tạo lớp thành công!');
    }
    
    resetForm();
    setIsCreateOpen(false);
    fetchClasses();
    setIsCreating(false);
  };

  const resetForm = () => {
    setNewClassName('');
    setNewClassCode('');
    setNewSchedule('');
    setStartDate(undefined);
    setEndDate(undefined);
    setStartTime('');
    setEndTime('');
  };

  const formatDateDisplay = (dateStr: string | null) => {
    if (!dateStr) return null;
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: vi });
  };

  const formatTimeDisplay = (timeStr: string | null) => {
    if (!timeStr) return null;
    // Time comes as "HH:MM:SS", we only need "HH:MM"
    return timeStr.substring(0, 5);
  };

  if (selectedClass) {
    return (
      <ClassDetail 
        classData={selectedClass} 
        onBack={() => setSelectedClass(null)}
        onClassUpdate={() => {
          fetchClasses();
        }}
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
        
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tạo lớp mới
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Tạo lớp học mới</DialogTitle>
              <DialogDescription>
                Điền thông tin để tạo lớp học mới
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateClass} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="class-name">Tên môn học *</Label>
                <Input
                  id="class-name"
                  placeholder="VD: Python Cơ bản"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-code">Mã lớp *</Label>
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
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ngày bắt đầu</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM/yyyy") : "Chọn ngày"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Ngày kết thúc</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd/MM/yyyy") : "Chọn ngày"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => startDate ? date < startDate : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Giờ bắt đầu</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="start-time"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">Giờ kết thúc</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="end-time"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schedule">Ghi chú lịch học</Label>
                <Input
                  id="schedule"
                  placeholder="VD: Mỗi Chủ nhật hàng tuần"
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
                <div className="space-y-1 text-sm text-muted-foreground">
                  {(cls.start_date || cls.end_date) && (
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="h-4 w-4" />
                      <span>
                        {formatDateDisplay(cls.start_date) || '?'} - {formatDateDisplay(cls.end_date) || '?'}
                      </span>
                    </div>
                  )}
                  {(cls.start_time || cls.end_time) && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>
                        {formatTimeDisplay(cls.start_time) || '?'} - {formatTimeDisplay(cls.end_time) || '?'}
                      </span>
                    </div>
                  )}
                  {cls.schedule_info && (
                    <div className="text-xs">{cls.schedule_info}</div>
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
