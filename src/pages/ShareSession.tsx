import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import SessionContentView from '@/components/dashboard/SessionContentView';
import { GraduationCap } from 'lucide-react';

interface SessionData {
  id: string;
  title: string;
  content: string | null;
  session_order: number;
  classes: {
    name: string;
    code: string;
  };
}

export default function ShareSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) {
        setError('Link không hợp lệ');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('sessions')
        .select(`
          id,
          title,
          content,
          session_order,
          classes (
            name,
            code
          )
        `)
        .eq('id', sessionId)
        .maybeSingle();

      if (fetchError || !data) {
        setError('Không tìm thấy buổi học hoặc buổi học không tồn tại');
        setLoading(false);
        return;
      }

      setSession(data as SessionData);
      setLoading(false);
    };

    fetchSession();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <p className="text-muted-foreground">Đang tải nội dung...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Không thể truy cập</h1>
          <p className="text-muted-foreground">{error || 'Đã xảy ra lỗi'}</p>
        </div>
      </div>
    );
  }

  return (
    <SessionContentView
      title={session.title}
      sessionOrder={session.session_order}
      content={session.content}
      className={session.classes.name}
      classCode={session.classes.code}
      showControls={true}
    />
  );
}
