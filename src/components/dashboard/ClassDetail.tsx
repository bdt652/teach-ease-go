import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLogger } from '@/hooks/useLogger';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, Plus, FileText, Users, CheckCircle, Circle, Trash2, PauseCircle, Pencil, Calendar as CalendarIcon, Clock, GripVertical, UserMinus, UserPlus } from 'lucide-react';
import AddStudentDialog from './AddStudentDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format, addWeeks } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import SessionDetail from './SessionDetail';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableSessionCard } from './SortableSessionCard';

interface Class {
  id: string;
  code: string;
  name: string;
  schedule_info: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  guest_password?: string | null;
}

interface Session {
  id: string;
  title: string;
  content: string | null;
  session_order: number;
  is_active: boolean;
  created_at: string;
  submission_count?: number;
  submission_type?: string;
  submission_instructions?: string;
  allowed_extensions?: string[];
}

interface EnrolledStudent {
  id: string;
  user_id: string;
  enrolled_at: string;
  profile: {
    full_name: string | null;
  } | null;
}

interface ClassDetailProps {
  classData: Class;
  onBack: () => void;
  onClassUpdate?: () => void;
}

export default function ClassDetail({ classData, onBack, onClassUpdate }: ClassDetailProps) {
  const { user } = useAuth();
  const { logClassAction, logSessionAction, logAction } = useLogger();
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
  const [editGuestPassword, setEditGuestPassword] = useState(classData.guest_password || '');
  const [isEditing, setIsEditing] = useState(false);

  // Edit session form
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editSessionTitle, setEditSessionTitle] = useState('');
  const [editSessionContent, setEditSessionContent] = useState('');
  const [editSubmissionType, setEditSubmissionType] = useState('any');
  const [editSubmissionInstructions, setEditSubmissionInstructions] = useState('');
  const [editAllowedExtensions, setEditAllowedExtensions] = useState('');
  const [isSavingSession, setIsSavingSession] = useState(false);

  // Enrolled students
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [isStudentsOpen, setIsStudentsOpen] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

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

  const fetchEnrolledStudents = async () => {
    setLoadingStudents(true);
    const { data, error } = await supabase
      .from('class_enrollments')
      .select(`
        id,
        user_id,
        enrolled_at,
        profiles!class_enrollments_user_id_fkey(full_name)
      `)
      .eq('class_id', classData.id)
      .order('enrolled_at', { ascending: false });
    
    if (error) {
      toast.error('Không thể tải danh sách học sinh');
    } else {
      const students = (data || []).map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        enrolled_at: item.enrolled_at,
        profile: item.profiles
      }));
      setEnrolledStudents(students);
    }
    setLoadingStudents(false);
  };

  const handleRemoveStudent = async (enrollmentId: string, studentName: string) => {
    if (!confirm(`Bạn có chắc muốn xóa "${studentName}" khỏi lớp?`)) return;
    
    const { error } = await supabase
      .from('class_enrollments')
      .delete()
      .eq('id', enrollmentId);
    
    if (error) {
      toast.error('Không thể xóa học sinh');
    } else {
      toast.success('Đã xóa học sinh khỏi lớp');
      fetchEnrolledStudents();
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [classData.id]);

  useEffect(() => {
    if (isStudentsOpen) {
      fetchEnrolledStudents();
    }
  }, [isStudentsOpen]);

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
      logSessionAction('CREATE_FAILED', '', newSessionTitle, classData.id, { error: error.message });
    } else {
      toast.success('Tạo buổi học thành công!');
      logSessionAction('CREATE_SUCCESS', '', newSessionTitle, classData.id, {
        order: nextOrder,
        hasContent: !!newSessionContent
      });
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
        end_time: editEndTime || null,
        guest_password: editGuestPassword || null
      })
      .eq('id', currentClass.id)
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        toast.error('Mã lớp đã tồn tại');
        logClassAction('UPDATE_FAILED', currentClass.id, editName, { error: 'Mã lớp đã tồn tại', code: editCode });
      } else {
        toast.error('Không thể cập nhật: ' + error.message);
        logClassAction('UPDATE_FAILED', currentClass.id, editName, { error: error.message });
      }
    } else if (data) {
      setCurrentClass(data);
      toast.success('Cập nhật lớp học thành công!');
      logClassAction('UPDATE_SUCCESS', currentClass.id, editName, {
        oldCode: currentClass.code,
        newCode: editCode,
        oldName: currentClass.name,
        newName: editName,
        scheduleChanged: editSchedule !== (currentClass.schedule_info || ''),
        dateChanged: (editStartDate ? format(editStartDate, 'yyyy-MM-dd') : null) !== currentClass.start_date ||
                     (editEndDate ? format(editEndDate, 'yyyy-MM-dd') : null) !== currentClass.end_date,
        timeChanged: editStartTime !== (currentClass.start_time?.substring(0, 5) || '') ||
                     editEndTime !== (currentClass.end_time?.substring(0, 5) || ''),
        passwordChanged: editGuestPassword !== (currentClass.guest_password || '')
      });
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
      logSessionAction('TOGGLE_ACTIVE_FAILED', session.id, session.title, currentClass.id, {
        error: error.message,
        targetState: !session.is_active
      });
    } else {
      logSessionAction('TOGGLE_ACTIVE_SUCCESS', session.id, session.title, currentClass.id, {
        oldState: session.is_active,
        newState: !session.is_active
      });
      fetchSessions();
    }
  };

  const openEditSession = (session: Session) => {
    setEditingSession(session);
    setEditSessionTitle(session.title);
    setEditSessionContent(session.content || '');
    setEditSubmissionType(session.submission_type || 'any');
    setEditSubmissionInstructions(session.submission_instructions || '');
    setEditAllowedExtensions(session.allowed_extensions?.join(', ') || '');
  };

  const handleEditSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;
    
    setIsSavingSession(true);
    
    const extensions = editAllowedExtensions
      .split(',')
      .map(ext => ext.trim().toLowerCase())
      .filter(ext => ext.length > 0);
    
    const { error } = await supabase
      .from('sessions')
      .update({
        title: editSessionTitle,
        content: editSessionContent || null,
        submission_type: editSubmissionType,
        submission_instructions: editSubmissionInstructions || null,
        allowed_extensions: extensions.length > 0 ? extensions : null
      })
      .eq('id', editingSession.id);
    
    if (error) {
      toast.error('Không thể cập nhật buổi học');
      logSessionAction('UPDATE_FAILED', editingSession.id, editSessionTitle, currentClass.id, {
        error: error.message
      });
    } else {
      toast.success('Cập nhật buổi học thành công!');
      logSessionAction('UPDATE_SUCCESS', editingSession.id, editSessionTitle, currentClass.id, {
        oldTitle: editingSession.title,
        newTitle: editSessionTitle,
        contentChanged: editSessionContent !== (editingSession.content || ''),
        submissionTypeChanged: editSubmissionType !== (editingSession.submission_type || 'any'),
        instructionsChanged: editSubmissionInstructions !== (editingSession.submission_instructions || ''),
        extensionsChanged: editAllowedExtensions !== (editingSession.allowed_extensions?.join(', ') || '')
      });
      setEditingSession(null);
      fetchSessions();
    }
    
    setIsSavingSession(false);
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Bạn có chắc muốn xóa buổi học này?')) return;

    const session = sessions.find(s => s.id === sessionId);

    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      toast.error('Không thể xóa buổi học');
      logSessionAction('DELETE_FAILED', sessionId, session?.title || 'Unknown', currentClass.id, {
        error: error.message
      });
    } else {
      toast.success('Đã xóa buổi học');
      logSessionAction('DELETE_SUCCESS', sessionId, session?.title || 'Unknown', currentClass.id);
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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sessions.findIndex((s) => s.id === active.id);
      const newIndex = sessions.findIndex((s) => s.id === over.id);
      
      const newSessions = arrayMove(sessions, oldIndex, newIndex);
      
      // Update local state immediately for better UX
      setSessions(newSessions);
      
      // Update session_order in database
      const updates = newSessions.map((session, index) => ({
        id: session.id,
        session_order: index + 1
      }));
      
      for (const update of updates) {
        await supabase
          .from('sessions')
          .update({ session_order: update.session_order })
          .eq('id', update.id);
      }
      
      toast.success('Đã sắp xếp lại thứ tự buổi học');
    }
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
        
        {/* View Enrolled Students Dialog */}
        <Dialog open={isStudentsOpen} onOpenChange={setIsStudentsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" title="Xem danh sách học sinh">
              <Users className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Danh sách học sinh</DialogTitle>
              <DialogDescription>
                {enrolledStudents.length} học sinh đã tham gia lớp {currentClass.name}
              </DialogDescription>
            </DialogHeader>
            {loadingStudents ? (
              <div className="py-8 text-center text-muted-foreground">Đang tải...</div>
            ) : enrolledStudents.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Chưa có học sinh nào tham gia lớp này
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Học sinh</TableHead>
                      <TableHead>Ngày tham gia</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrolledStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          {student.profile?.full_name || 'Không tên'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(student.enrolled_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveStudent(student.id, student.profile?.full_name || 'Học sinh')}
                            title="Xóa khỏi lớp"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
            
            {/* Add Student Button inside Dialog */}
            <div className="pt-4 border-t">
              <AddStudentDialog
                classId={classData.id}
                className={currentClass.name}
                classCode={currentClass.code}
                enrolledStudentIds={enrolledStudents.map(s => s.user_id)}
                onStudentAdded={fetchEnrolledStudents}
              />
            </div>
          </DialogContent>
        </Dialog>
        
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

              <div className="space-y-2">
                <Label htmlFor="edit-guest-password">Mật khẩu cho học sinh nộp bài (không cần tài khoản)</Label>
                <Input
                  id="edit-guest-password"
                  type="text"
                  placeholder="Để trống nếu không yêu cầu mật khẩu"
                  value={editGuestPassword}
                  onChange={(e) => setEditGuestPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Mật khẩu này dành cho học sinh nộp bài qua trang Guest (không có tài khoản)
                </p>
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sessions.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {sessions.map((session) => (
                <SortableSessionCard
                  key={session.id}
                  session={session}
                  sessionDate={getSessionDate(session.session_order)}
                  onSelect={() => {
                    logSessionAction('VIEW_DETAIL', session.id, session.title, currentClass.id);
                    setSelectedSession(session);
                  }}
                  onToggleActive={() => toggleSessionActive(session)}
                  onEdit={() => openEditSession(session)}
                  onPostpone={() => postponeSession(session)}
                  onDelete={() => deleteSession(session.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Edit Session Dialog */}
      <Dialog open={!!editingSession} onOpenChange={(open) => !open && setEditingSession(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa buổi học</DialogTitle>
            <DialogDescription>
              {editingSession && `Buổi ${editingSession.session_order}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSession} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-session-title">Tiêu đề buổi học</Label>
              <Input
                id="edit-session-title"
                value={editSessionTitle}
                onChange={(e) => setEditSessionTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-session-content">Nội dung bài giảng</Label>
              <Textarea
                id="edit-session-content"
                placeholder="Nhập nội dung bài giảng (Markdown được hỗ trợ)..."
                value={editSessionContent}
                onChange={(e) => setEditSessionContent(e.target.value)}
                rows={6}
              />
            </div>
            
            {/* Submission Configuration */}
            <div className="border-t pt-4 space-y-4">
              <h4 className="font-medium text-foreground">Cấu hình nộp bài</h4>
              
              <div className="space-y-2">
                <Label htmlFor="submission-type">Loại bài nộp yêu cầu</Label>
                <Select value={editSubmissionType} onValueChange={setEditSubmissionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn loại nộp bài" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Tất cả định dạng</SelectItem>
                    <SelectItem value="image">Chỉ ảnh (screenshot, hình)</SelectItem>
                    <SelectItem value="code">Chỉ code (text)</SelectItem>
                    <SelectItem value="document">Chỉ tài liệu (zip, pdf...)</SelectItem>
                    <SelectItem value="link">Chỉ link (GitHub, CodePen...)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {editSubmissionType !== 'any' && editSubmissionType !== 'link' && (
                <div className="space-y-2">
                  <Label htmlFor="allowed-extensions">
                    Định dạng file cho phép (cách nhau bởi dấu phẩy)
                  </Label>
                  <Input
                    id="allowed-extensions"
                    placeholder={
                      editSubmissionType === 'image' ? 'jpg, png, gif' :
                      editSubmissionType === 'code' ? 'py, js, html, css' :
                      'zip, pdf, docx'
                    }
                    value={editAllowedExtensions}
                    onChange={(e) => setEditAllowedExtensions(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ví dụ: jpg, png, gif (để trống = cho phép tất cả)
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="submission-instructions">Hướng dẫn nộp bài</Label>
                <Textarea
                  id="submission-instructions"
                  placeholder="Ví dụ: Chụp ảnh màn hình kết quả code và nộp lên..."
                  value={editSubmissionInstructions}
                  onChange={(e) => setEditSubmissionInstructions(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setEditingSession(null)}>
                Hủy
              </Button>
              <Button type="submit" disabled={isSavingSession}>
                {isSavingSession ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
