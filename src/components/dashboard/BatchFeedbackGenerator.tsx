import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Copy, Check, FileText } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface Student {
  userId: string | null;
  guestName: string | null;
  name: string;
}

interface Submission {
  id: string;
  score: number | null;
  teacher_note: string | null;
}

interface BatchFeedbackGeneratorProps {
  sessionTitle: string;
  sessionOrder: number;
  sessionContent: string | null;
  students: Student[];
  getSubmissionsForStudent: (userId: string | null, guestName: string | null) => Submission[];
}

export default function BatchFeedbackGenerator({
  sessionTitle,
  sessionOrder,
  sessionContent,
  students,
  getSubmissionsForStudent,
}: BatchFeedbackGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [homework, setHomework] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateBatchFeedback = async () => {
    setIsGenerating(true);
    try {
      const studentsWithSubmissions = students.map(s => ({
        name: s.name,
        submissions: getSubmissionsForStudent(s.userId, s.guestName),
      }));

      const { data, error } = await supabase.functions.invoke('generate-student-feedback', {
        body: {
          type: 'batch',
          sessionTitle: `Buổi ${sessionOrder} – ${sessionTitle}`,
          sessionContent,
          students: studentsWithSubmissions,
          homework: homework || 'Chưa có thông tin',
        },
      });

      if (error) throw error;

      if (data?.feedback) {
        setFeedback(data.feedback);
        toast.success('Đã tạo nhận xét chung thành công!');
      }
    } catch (error: any) {
      console.error('Error generating batch feedback:', error);
      toast.error(error.message || 'Không thể tạo nhận xét');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (feedback) {
      navigator.clipboard.writeText(feedback);
      setCopied(true);
      toast.success('Đã sao chép nhận xét!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2">
          <FileText className="h-4 w-4" />
          Nhận xét chung (AI)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Tạo nhận xét chung cho buổi học</DialogTitle>
          <DialogDescription>
            Tạo nhận xét tổng hợp cho tất cả học sinh trong buổi học này để gửi phụ huynh
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {!feedback ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium">Thông tin buổi học:</p>
                <p className="text-sm text-muted-foreground">Buổi {sessionOrder} – {sessionTitle}</p>
                <p className="text-sm text-muted-foreground">{students.length} học sinh</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="homework">Bài tập về nhà (nếu có)</Label>
                <Textarea
                  id="homework"
                  placeholder="Ví dụ: Hoàn thiện bài tập trên Denise..."
                  value={homework}
                  onChange={(e) => setHomework(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleGenerateBatchFeedback}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang tạo nhận xét...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Tạo nhận xét AI
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Nhận xét đã tạo:</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    {copied ? 'Đã sao chép' : 'Sao chép'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setFeedback(null)}
                  >
                    Tạo lại
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 border rounded-lg p-4 bg-background max-h-[400px]">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{feedback}</ReactMarkdown>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
