import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, Plus, FileText, Users, CheckCircle, Circle, Trash2, PauseCircle, Pencil, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format, addWeeks } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import SessionDetail from './SessionDetail';

interface Class {
  id: string;
  code: string;
  name: string;
  schedule_info: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
}

interface Session {
  id: string;
  title: string;
  content: string | null;
  session_order: number;
  is_active: boolean;
  created_at: string;
  submission_count?: number;
}

interface ClassDetailProps {
  classData: Class;
  onBack: () => void;
  onClassUpdate?: () => void;
}

export default function ClassDetail({ classData, onBack, onClassUpdate }: ClassDetailProps) {
  const { user } = useAuth();
  const [currentClass, setCurrentClass] = useState<Class>(classData);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  
  // Create session form
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionContent, setNewSessionContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit class form
  const [editName, setEditName] = useState(classData.name);
  const [editCode, setEditCode] = useState(classData.code);
  const [editSchedule, setEditSchedule] = useState(classData.schedule_info || '');
  const [editStartDate, setEditStartDate] = useState<Date | undefined>(
    classData.start_date ? new Date(classData.start_date) : undefined
  );
  const [editEndDate, setEditEndDate] = useState<Date | undefined>(
    classData.end_date ? new Date(classData.end_date) : undefined
  );
  const [editStartTime, setEditStartTime] = useState(classData.start_time?.substring(0, 5) || '');
  const [editEndTime, setEditEndTime] = useState(classData.end_time?.substring(0, 5) || '');
  const [isEditing, setIsEditing] = useState(false);

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, submissions(count)')
      .eq('class_id', classData.id)
      .order('session_order', { ascending: true });
    
    if (error) {
      toast.error('Không thể tải danh sách buổi học');
    } else {
      // Map submissions count
      const sessionsWithCount = (data || []).map((s: any) => ({
        ...s,
        submission_count: s.submissions?.[0]?.count || 0
      }));
      setSessions(sessionsWithCount);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, [classData.id]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsCreating(true);
    
    const nextOrder = sessions.length + 1;
    
    const { error } = await supabase
      .from('sessions')
      .insert({
        class_id: classData.id,
        title: newSessionTitle,
        content: newSessionContent || null,
        session_order: nextOrder,
        is_active: false
      });
    
    if (error) {
      toast.error('Không thể tạo buổi học: ' + error.message);
    } else {
      toast.success('Tạo buổi học thành công!');
      setNewSessionTitle('');
      setNewSessionContent('');
      setIsCreateOpen(false);
      fetchSessions();
    }
    
    setIsCreating(false);
  };

  const handleEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editStartDate && editEndDate && editStartDate > editEndDate) {
      toast.error('Ngày bắt đầu phải trước ngày kết thúc');
      return;
    }

    if (editStartTime && editEndTime && editStartTime >= editEndTime) {
      toast.error('Giờ bắt đầu phải trước giờ kết thúc');
      return;
    }
    
    setIsEditing(true);
    
    const { data, error } = await supabase
      .from('classes')
      .update({
        name: editName,
        code: editCode.toUpperCase(),
        schedule_info: editSchedule || null,
        start_date: editStartDate ? format(editStartDate, 'yyyy-MM-dd') : null,
        end_date: editEndDate ? format(editEndDate, 'yyyy-MM-dd') : null,
        start_time: editStartTime || null,
        end_time: editEndTime || null
      })
      .eq('id', currentClass.id)
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        toast.error('Mã lớp đã tồn tại');
      } else {
        toast.error('Không thể cập nhật: ' + error.message);
      }
    } else if (data) {
      setCurrentClass(data);
      toast.success('Cập nhật lớp học thành công!');
      setIsEditOpen(false);
      onClassUpdate?.();
    }
    
    setIsEditing(false);
  };

  const toggleSessionActive = async (session: Session) => {
    const { error } = await supabase
      .from('sessions')
      .update({ is_active: !session.is_active })
      .eq('id', session.id);
    
    if (error) {
      toast.error('Không thể cập nhật trạng thái');
    } else {
      fetchSessions();
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Bạn có chắc muốn xóa buổi học này?')) return;
    
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId);
    
    if (error) {
      toast.error('Không thể xóa buổi học');
    } else {
      toast.success('Đã xóa buổi học');
      fetchSessions();
    }
  };

  const handleDeleteClass = async () => {
    if (!confirm(`Bạn có chắc muốn xóa lớp "${currentClass.name}"? Tất cả buổi học và bài nộp sẽ bị xóa.`)) return;
    
    // Xóa tất cả sessions trước
    const { error: sessionsError } = await supabase
      .from('sessions')
      .delete()
      .eq('class_id', currentClass.id);
    
    if (sessionsError) {
      toast.error('Không thể xóa các buổi học');
      return;
    }
    
    // Xóa lớp
    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', currentClass.id);
    
    if (error) {
      toast.error('Không thể xóa lớp học');
    } else {
      toast.success('Đã xóa lớp học');
      onClassUpdate?.();
      onBack();
    }
  };

  const getSessionDate = (sessionOrder: number) => {
    if (!currentClass.start_date) return null;
    const startDate = new Date(currentClass.start_date);
    return addWeeks(startDate, sessionOrder - 1);
  };

  const postponeSession = async (session: Session) => {
    if (!confirm(`Hoãn "${session.title}"? Lịch kết thúc sẽ lùi 1 tuần và thêm 1 buổi học mới.`)) return;
    
    // Thêm 1 buổi học mới ở cuối
    const nextOrder = sessions.length + 1;
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        class_id: currentClass.id,
        title: `Buổi ${nextOrder}`,
        session_order: nextOrder,
        is_active: false
      });
    
    if (sessionError) {
      toast.error('Không thể thêm buổi học mới');
      return;
    }
    
    // Lùi ngày kết thúc 1 tuần
    if (currentClass.end_date) {
      const newEndDate = addWeeks(new Date(currentClass.end_date), 1);
      const { data, error: classError } = await supabase
        .from('classes')
        .update({ end_date: format(newEndDate, 'yyyy-MM-dd') })
        .eq('id', currentClass.id)
        .select()
        .single();
      
      if (classError) {
        toast.error('Không thể cập nhật ngày kết thúc');
        return;
      }
      if (data) {
        setCurrentClass(data);
      }
    }
    
    toast.success(`Đã hoãn buổi học. Thêm Buổi ${nextOrder} và lùi ngày kết thúc 1 tuần.`);
    fetchSessions();
    onClassUpdate?.();
  };

  if (selectedSession) {
    return (
      <SessionDetail
        session={selectedSession}
        classData={currentClass}
        onBack={() => setSelectedSession(null)}
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
          <h2 className="text-2xl font-bold text-foreground">{currentClass.name}</h2>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Badge variant="outline" className="font-mono">{currentClass.code}</Badge>
            {currentClass.schedule_info && <span>• {currentClass.schedule_info}</span>}
          </div>
        </div>
        
        <Button variant="destructive" size="icon" onClick={handleDeleteClass} title="Xóa lớp học">
          <Trash2 className="h-4 w-4" />
        </Button>
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Pencil className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Chỉnh sửa lớp học</DialogTitle>
              <DialogDescription>
                Cập nhật thông tin lớp học
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditClass} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Tên môn học *</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-code">Mã lớp *</Label>
                <Input
                  id="edit-code"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                  maxLength={20}
                  required
                />
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
                          !editStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editStartDate ? format(editStartDate, "dd/MM/yyyy") : "Chọn ngày"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editStartDate}
                        onSelect={setEditStartDate}
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
                          !editEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editEndDate ? format(editEndDate, "dd/MM/yyyy") : "Chọn ngày"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editEndDate}
                        onSelect={setEditEndDate}
                        disabled={(date) => editStartDate ? date < editStartDate : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-start-time">Giờ bắt đầu</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-start-time"
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end-time">Giờ kết thúc</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-end-time"
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-schedule">Ghi chú lịch học</Label>
                <Input
                  id="edit-schedule"
                  placeholder="VD: Mỗi Chủ nhật hàng tuần"
                  value={editSchedule}
                  onChange={(e) => setEditSchedule(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={isEditing}>
                  {isEditing ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Thêm buổi học
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Thêm buổi học mới</DialogTitle>
              <DialogDescription>
                Buổi học #{sessions.length + 1}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-title">Tiêu đề buổi học</Label>
                <Input
                  id="session-title"
                  placeholder="VD: Giới thiệu Python"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="session-content">Nội dung bài giảng</Label>
                <Textarea
                  id="session-content"
                  placeholder="Nhập nội dung bài giảng (Markdown được hỗ trợ)..."
                  value={newSessionContent}
                  onChange={(e) => setNewSessionContent(e.target.value)}
                  rows={10}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? 'Đang tạo...' : 'Tạo buổi học'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Chưa có buổi học nào</h3>
            <p className="text-muted-foreground text-center mb-4">
              Thêm buổi học đầu tiên cho lớp này
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Thêm buổi học
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card 
              key={session.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader className="flex flex-row items-center gap-4">
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => setSelectedSession(session)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-muted-foreground">
                      Buổi {session.session_order}
                    </span>
                    {getSessionDate(session.session_order) && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {format(getSessionDate(session.session_order)!, 'dd/MM/yyyy', { locale: vi })}
                      </span>
                    )}
                    {session.is_active ? (
                      <Badge className="bg-green-500">Đang mở</Badge>
                    ) : (
                      <Badge variant="secondary">Đã đóng</Badge>
                    )}
                    {session.submission_count !== undefined && session.submission_count > 0 && (
                      <Badge variant="outline" className="text-xs">
                        <FileText className="h-3 w-3 mr-1" />
                        {session.submission_count} bài nộp
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-1">{session.title}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={session.is_active}
                      onCheckedChange={() => toggleSessionActive(session)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {session.is_active ? 'Mở' : 'Đóng'}
                    </span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      postponeSession(session);
                    }}
                    title="Hoãn buổi học - lùi lịch kết thúc 1 tuần"
                  >
                    <PauseCircle className="h-4 w-4 mr-1" />
                    Hoãn
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
