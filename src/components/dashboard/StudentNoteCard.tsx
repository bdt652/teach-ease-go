import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Pencil, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface StudentNote {
  id: string;
  session_id: string;
  student_user_id: string | null;
  student_guest_name: string | null;
  note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Submission {
  id: string;
  score: number | null;
  teacher_note: string | null;
}

interface StudentNoteCardProps {
  student: {
    userId: string | null;
    guestName: string | null;
    name: string;
  };
  notes: StudentNote[];
  sessionId: string;
  sessionTitle: string;
  sessionContent: string | null;
  submissions: Submission[];
  onAddNote: () => void;
  onEditNote: (note: StudentNote) => void;
  onDeleteNote: (noteId: string) => void;
  onNoteGenerated: () => void;
}

export default function StudentNoteCard({
  student,
  notes,
  sessionId,
  sessionTitle,
  sessionContent,
  submissions,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onNoteGenerated,
}: StudentNoteCardProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateAIFeedback = async () => {
    setIsGenerating(true);
    try {
      const previousNotes = notes.map(n => n.note);

      const { data, error } = await supabase.functions.invoke('generate-student-feedback', {
        body: {
          studentName: student.name,
          sessionTitle,
          sessionContent,
          previousNotes,
          submissions,
        },
      });

      if (error) throw error;

      if (data?.feedback) {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Chưa đăng nhập');

        // Save the AI-generated note
        const { error: insertError } = await supabase
          .from('student_notes')
          .insert({
            session_id: sessionId,
            student_user_id: student.userId,
            student_guest_name: student.guestName,
            note: `🤖 **Nhận xét AI - ${sessionTitle}**\n\n${data.feedback}`,
            created_by: user.id,
          });

        if (insertError) throw insertError;

        toast.success('Đã tạo nhận xét AI thành công!');
        onNoteGenerated();
      }
    } catch (error: any) {
      console.error('Error generating AI feedback:', error);
      toast.error(error.message || 'Không thể tạo nhận xét AI');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base font-medium">{student.name}</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateAIFeedback}
              disabled={isGenerating}
              className="text-primary"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Nhận xét AI
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onAddNote}
            >
              <Plus className="h-4 w-4 mr-1" />
              Thêm ghi chú
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-2">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Chưa có ghi chú</p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="p-4 bg-muted rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="prose prose-sm dark:prose-invert max-w-none flex-1">
                      <ReactMarkdown>{note.note}</ReactMarkdown>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onEditNote(note)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onDeleteNote(note.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {new Date(note.created_at).toLocaleString('vi-VN')}
                    {note.updated_at !== note.created_at && ' (đã sửa)'}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
