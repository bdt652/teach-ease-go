import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Upload, FileCode, Link, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Session {
  id: string;
  title: string;
  session_order: number;
  classes: {
    name: string;
    code: string;
  };
}

interface SubmissionFormProps {
  session: Session;
  onBack: () => void;
  onSuccess: () => void;
  isGuest?: boolean;
  guestName?: string;
}

export default function SubmissionForm({ 
  session, 
  onBack, 
  onSuccess, 
  isGuest = false,
  guestName = ''
}: SubmissionFormProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionType, setSubmissionType] = useState<'file' | 'code' | 'link'>('file');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [codeContent, setCodeContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        toast.error('File quá lớn. Tối đa 100MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      let filePath = '';
      let fileType = '';
      let codeSnippet = '';

      const timestamp = Date.now();
      const submitterName = isGuest ? guestName : (user?.email || 'user');
      const sanitizedName = submitterName.replace(/[^a-zA-Z0-9]/g, '_');

      if (submissionType === 'file' && selectedFile) {
        // Upload file to storage
        const fileExt = selectedFile.name.split('.').pop() || '';
        filePath = `${session.classes.code}/${session.id}/${sanitizedName}_${timestamp}.${fileExt}`;
        fileType = fileExt;

        const { error: uploadError } = await supabase.storage
          .from('submissions')
          .upload(filePath, selectedFile);

        if (uploadError) {
          throw new Error('Không thể tải file lên: ' + uploadError.message);
        }
      } else if (submissionType === 'code') {
        // Store code as text file
        const blob = new Blob([codeContent], { type: 'text/plain' });
        filePath = `${session.classes.code}/${session.id}/${sanitizedName}_${timestamp}.txt`;
        fileType = 'code';
        codeSnippet = codeContent;

        const { error: uploadError } = await supabase.storage
          .from('submissions')
          .upload(filePath, blob);

        if (uploadError) {
          throw new Error('Không thể lưu code: ' + uploadError.message);
        }
      } else if (submissionType === 'link') {
        // Store link as text file
        const blob = new Blob([linkUrl], { type: 'text/plain' });
        filePath = `${session.classes.code}/${session.id}/${sanitizedName}_${timestamp}_link.txt`;
        fileType = 'link';

        const { error: uploadError } = await supabase.storage
          .from('submissions')
          .upload(filePath, blob);

        if (uploadError) {
          throw new Error('Không thể lưu link: ' + uploadError.message);
        }
      }

      // Create submission record
      const submissionData: {
        session_id: string;
        file_path: string;
        file_type: string;
        code_snippet: string | null;
        user_id?: string;
        guest_name?: string;
      } = {
        session_id: session.id,
        file_path: filePath,
        file_type: fileType,
        code_snippet: codeSnippet || null,
      };

      if (isGuest) {
        submissionData.guest_name = guestName;
      } else {
        submissionData.user_id = user?.id;
      }

      const { error: insertError } = await supabase
        .from('submissions')
        .insert(submissionData);

      if (insertError) {
        throw new Error('Không thể lưu bài nộp: ' + insertError.message);
      }

      toast.success('Nộp bài thành công!');
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = () => {
    if (submissionType === 'file') return selectedFile !== null;
    if (submissionType === 'code') return codeContent.trim().length > 0;
    if (submissionType === 'link') return linkUrl.trim().length > 0;
    return false;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Badge variant="outline" className="font-mono">{session.classes.code}</Badge>
            <span>•</span>
            <span>{session.classes.name}</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            Nộp bài - Buổi {session.session_order}: {session.title}
          </h2>
          {isGuest && guestName && (
            <p className="text-muted-foreground">Nộp với tên: {guestName}</p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chọn định dạng nộp bài</CardTitle>
          <CardDescription>
            Bạn có thể nộp file, code text, hoặc link sản phẩm
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={submissionType} onValueChange={(v) => setSubmissionType(v as typeof submissionType)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="file" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                File
              </TabsTrigger>
              <TabsTrigger value="code" className="flex items-center gap-2">
                <FileCode className="h-4 w-4" />
                Code
              </TabsTrigger>
              <TabsTrigger value="link" className="flex items-center gap-2">
                <Link className="h-4 w-4" />
                Link
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-4">
              <div className="space-y-2">
                <Label>Chọn file (zip, rar, code files...)</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept=".zip,.rar,.7z,.py,.js,.ts,.cpp,.c,.java,.html,.css,.txt"
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Đã chọn: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Hỗ trợ: .zip, .rar, .7z, .py, .js, .ts, .cpp, .c, .java, .html, .css, .txt (Tối đa 100MB)
                </p>
              </div>
            </TabsContent>

            <TabsContent value="code" className="space-y-4">
              <div className="space-y-2">
                <Label>Paste code của bạn</Label>
                <Textarea
                  placeholder="Dán code của bạn vào đây..."
                  value={codeContent}
                  onChange={(e) => setCodeContent(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>
            </TabsContent>

            <TabsContent value="link" className="space-y-4">
              <div className="space-y-2">
                <Label>Link sản phẩm (GitHub, CodePen, Website...)</Label>
                <Input
                  type="url"
                  placeholder="https://github.com/username/project"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex gap-2 justify-end">
            <Button variant="outline" onClick={onBack}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={!isValid() || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang nộp...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Nộp bài
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
