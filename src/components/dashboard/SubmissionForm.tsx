import { useState, useRef, useEffect } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Upload, FileCode, Link, Loader2, Image, FileArchive, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

interface Session {
  id: string;
  title: string;
  session_order: number;
  classes: {
    name: string;
    code: string;
  };
  submission_type?: string;
  submission_instructions?: string;
  allowed_extensions?: string[];
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Determine initial submission type based on session config
  const getInitialType = (): 'file' | 'code' | 'link' => {
    const type = session.submission_type;
    if (type === 'link') return 'link';
    if (type === 'code') return 'code';
    return 'file';
  };
  
  const [submissionType, setSubmissionType] = useState<'file' | 'code' | 'link'>(getInitialType());
  
  // Form states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [codeContent, setCodeContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const [deviceInfo, setDeviceInfo] = useState<Record<string, unknown>>({});

  // Initialize fingerprint on mount
  useEffect(() => {
    const getFingerprint = async () => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        setDeviceFingerprint(result.visitorId);
        setDeviceInfo({
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          language: navigator.language,
          screenResolution: `${screen.width}x${screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          colorDepth: screen.colorDepth,
          hardwareConcurrency: navigator.hardwareConcurrency,
          deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 'unknown',
        });
      } catch (error) {
        console.error('Error getting fingerprint:', error);
      }
    };
    getFingerprint();
  }, []);

  // Check if type is allowed based on session config
  const isTypeAllowed = (type: 'file' | 'code' | 'link'): boolean => {
    const configType = session.submission_type;
    if (!configType || configType === 'any') return true;
    if (configType === 'link' && type === 'link') return true;
    if (configType === 'code' && type === 'code') return true;
    if ((configType === 'image' || configType === 'document') && type === 'file') return true;
    return false;
  };

  const getAcceptedFileTypes = (): string => {
    const configType = session.submission_type;
    const extensions = session.allowed_extensions;
    
    if (extensions && extensions.length > 0) {
      return extensions.map(ext => `.${ext}`).join(',');
    }
    
    if (configType === 'image') {
      return '.jpg,.jpeg,.png,.gif,.webp,.bmp';
    }
    if (configType === 'document') {
      return '.zip,.rar,.7z,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx';
    }
    
    return '.zip,.rar,.7z,.py,.js,.ts,.cpp,.c,.java,.html,.css,.txt,.jpg,.jpeg,.png,.gif,.pdf';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        toast.error('File quá lớn. Tối đa 100MB');
        return;
      }
      
      // Check file extension if configured
      const extensions = session.allowed_extensions;
      if (extensions && extensions.length > 0) {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        if (!extensions.includes(fileExt)) {
          toast.error(`Chỉ chấp nhận file: ${extensions.join(', ')}`);
          return;
        }
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
      const submissionData = {
        session_id: session.id,
        file_path: filePath,
        file_type: fileType,
        code_snippet: codeSnippet || null,
        device_fingerprint: deviceFingerprint || null,
        device_info: (Object.keys(deviceInfo).length > 0 ? deviceInfo : null) as Json,
        user_id: isGuest ? undefined : user?.id,
        guest_name: isGuest ? guestName : undefined,
      };

      const { error: insertError } = await supabase
        .from('submissions')
        .insert([submissionData]);

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
          <CardTitle>Nộp bài</CardTitle>
          {session.submission_instructions && (
            <Alert className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Hướng dẫn từ giáo viên:</strong> {session.submission_instructions}
              </AlertDescription>
            </Alert>
          )}
          {session.submission_type && session.submission_type !== 'any' && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">
                {session.submission_type === 'image' && 'Chỉ nộp ảnh'}
                {session.submission_type === 'code' && 'Chỉ nộp code'}
                {session.submission_type === 'document' && 'Chỉ nộp tài liệu'}
                {session.submission_type === 'link' && 'Chỉ nộp link'}
              </Badge>
              {session.allowed_extensions && session.allowed_extensions.length > 0 && (
                <Badge variant="outline">
                  Định dạng: {session.allowed_extensions.join(', ')}
                </Badge>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Tabs value={submissionType} onValueChange={(v) => {
            if (isTypeAllowed(v as typeof submissionType)) {
              setSubmissionType(v as typeof submissionType);
            } else {
              toast.error('Loại nộp bài này không được phép cho buổi học này');
            }
          }}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger 
                value="file" 
                className="flex items-center gap-2"
                disabled={!isTypeAllowed('file')}
              >
                {session.submission_type === 'image' ? (
                  <Image className="h-4 w-4" />
                ) : session.submission_type === 'document' ? (
                  <FileArchive className="h-4 w-4" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {session.submission_type === 'image' ? 'Ảnh' : 
                 session.submission_type === 'document' ? 'Tài liệu' : 'File'}
              </TabsTrigger>
              <TabsTrigger 
                value="code" 
                className="flex items-center gap-2"
                disabled={!isTypeAllowed('code')}
              >
                <FileCode className="h-4 w-4" />
                Code
              </TabsTrigger>
              <TabsTrigger 
                value="link" 
                className="flex items-center gap-2"
                disabled={!isTypeAllowed('link')}
              >
                <Link className="h-4 w-4" />
                Link
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-4">
              <div className="space-y-2">
                <Label>
                  {session.submission_type === 'image' ? 'Chọn ảnh' :
                   session.submission_type === 'document' ? 'Chọn tài liệu' : 
                   'Chọn file'}
                </Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept={getAcceptedFileTypes()}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Đã chọn: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {session.allowed_extensions && session.allowed_extensions.length > 0 
                    ? `Định dạng cho phép: ${session.allowed_extensions.join(', ')} (Tối đa 100MB)`
                    : session.submission_type === 'image'
                    ? 'Hỗ trợ: .jpg, .png, .gif, .webp (Tối đa 100MB)'
                    : session.submission_type === 'document'
                    ? 'Hỗ trợ: .zip, .rar, .pdf, .docx (Tối đa 100MB)'
                    : 'Hỗ trợ: .zip, .rar, .7z, .py, .js, .ts, .cpp, .c, .java, .html, .css, .txt (Tối đa 100MB)'}
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
