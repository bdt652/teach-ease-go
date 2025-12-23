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
import { ArrowLeft, Plus, FileText, Users, CheckCircle, Circle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import SessionDetail from './SessionDetail';

interface Class {
  id: string;
  code: string;
  name: string;
  schedule_info: string | null;
}

interface Session {
  id: string;
  title: string;
  content: string | null;
  session_order: number;
  is_active: boolean;
  created_at: string;
}

interface ClassDetailProps {
  classData: Class;
  onBack: () => void;
}

export default function ClassDetail({ classData, onBack }: ClassDetailProps) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  
  // Create session form
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionContent, setNewSessionContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('class_id', classData.id)
      .order('session_order', { ascending: true });
    
    if (error) {
      toast.error('Không thể tải danh sách buổi học');
    } else {
      setSessions(data || []);
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

  if (selectedSession) {
    return (
      <SessionDetail
        session={selectedSession}
        classData={classData}
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
          <h2 className="text-2xl font-bold text-foreground">{classData.name}</h2>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Badge variant="outline" className="font-mono">{classData.code}</Badge>
            {classData.schedule_info && <span>• {classData.schedule_info}</span>}
          </div>
        </div>
        
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Buổi {session.session_order}
                    </span>
                    {session.is_active ? (
                      <Badge className="bg-green-500">Đang mở</Badge>
                    ) : (
                      <Badge variant="secondary">Đã đóng</Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-1">{session.title}</CardTitle>
                </div>
                <div className="flex items-center gap-4">
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
