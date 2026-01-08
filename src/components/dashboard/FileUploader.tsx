import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLogger } from '@/hooks/useLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, FileImage, FileText, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UploadedFile {
  name: string;
  url: string;
  type: 'image' | 'document';
}

interface FileUploaderProps {
  sessionId: string;
  onFileUploaded?: (file: UploadedFile) => void;
}

export default function FileUploader({ sessionId, onFileUploaded }: FileUploaderProps) {
  const { logFileAction } = useLogger();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImageFile = (file: File) => {
    return file.type.startsWith('image/');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    for (const file of Array.from(files)) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${sessionId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('lesson-materials')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          toast.error(`Không thể upload ${file.name}: ${uploadError.message}`);
          logFileAction('UPLOAD_FAILED', file.name, file.size, { sessionId, error: uploadError.message });
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('lesson-materials')
          .getPublicUrl(fileName);

        const uploadedFile: UploadedFile = {
          name: file.name,
          url: urlData.publicUrl,
          type: isImageFile(file) ? 'image' : 'document',
        };

        setUploadedFiles((prev) => [...prev, uploadedFile]);
        onFileUploaded?.(uploadedFile);
        toast.success(`Đã upload ${file.name}`);
        logFileAction('UPLOAD_SUCCESS', file.name, file.size, { sessionId, url: urlData.publicUrl });
      } catch (error) {
        toast.error(`Lỗi khi upload ${file.name}`);
        logFileAction('UPLOAD_ERROR', file.name, file.size, { sessionId, error: String(error) });
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const copyToClipboard = async (file: UploadedFile) => {
    let textToCopy: string;
    
    if (file.type === 'image') {
      textToCopy = `![${file.name}](${file.url})`;
    } else {
      textToCopy = `[${file.name}](${file.url})`;
    }

    await navigator.clipboard.writeText(textToCopy);
    setCopiedUrl(file.url);
    toast.success('Đã copy code Markdown');
    
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const removeFile = (url: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.url !== url));
  };

  return (
    <Card className="border-dashed">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label htmlFor="file-upload" className="text-sm font-medium">
              Upload ảnh hoặc tài liệu
            </Label>
            <p className="text-xs text-muted-foreground">
              Hỗ trợ ảnh (PNG, JPG, GIF) và tài liệu (PDF, DOC, DOCX)
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {isUploading ? 'Đang upload...' : 'Chọn file'}
          </Button>
          <Input
            ref={fileInputRef}
            id="file-upload"
            type="file"
            accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm">File đã upload (click để copy code Markdown):</Label>
            <div className="grid gap-2">
              {uploadedFiles.map((file) => (
                <div
                  key={file.url}
                  className="flex items-center gap-3 p-3 bg-muted rounded-lg group"
                >
                  {file.type === 'image' ? (
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-background rounded flex items-center justify-center">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{file.url}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(file)}
                    className="shrink-0"
                  >
                    {copiedUrl === file.url ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.url)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
