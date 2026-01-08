import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Terminal, Eye, Trash2, RefreshCw } from 'lucide-react';
import { logger, LogEntry } from '@/lib/logger';

export default function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useEffect(() => {
    // Check if we're in preview mode
    const previewMode = typeof window !== 'undefined' &&
                       window.location.hostname === 'localhost' &&
                       window.location.port.startsWith('65');
    setIsPreviewMode(previewMode);

    console.log('📊 LogViewer mounted:', {
      previewMode,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
      port: typeof window !== 'undefined' ? window.location.port : 'unknown'
    });

    if (previewMode) {
      // Load initial logs
      const initialLogs = logger.getPreviewLogs();
      setLogs(initialLogs);
      console.log('📋 Initial logs loaded:', initialLogs.length);

      // Refresh logs every 2 seconds
      const interval = setInterval(() => {
        const newLogs = logger.getPreviewLogs();
        setLogs(newLogs);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, []);

  const clearLogs = () => {
    logger.clearPreviewLogs();
    setLogs([]);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('vi-VN', {
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh'
    });
  };

  const getActionColor = (action: string) => {
    if (action.startsWith('AUTH_')) return 'bg-blue-500';
    if (action.startsWith('CLASS_')) return 'bg-green-500';
    if (action.startsWith('SESSION_')) return 'bg-purple-500';
    if (action.startsWith('SUBMISSION_')) return 'bg-orange-500';
    if (action.startsWith('FILE_')) return 'bg-pink-500';
    if (action === 'NAVIGATION') return 'bg-gray-500';
    return 'bg-gray-400';
  };

  if (!isPreviewMode) {
    console.log('❌ LogViewer: Not in preview mode, hiding component');
    return null;
  }

  console.log('✅ LogViewer: Showing log viewer button, logs count:', logs.length);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            className="bg-red-500 hover:bg-red-600 text-white shadow-lg"
            onClick={() => setLogs(logger.getPreviewLogs())}
          >
            <Terminal className="h-4 w-4 mr-2" />
            Logs ({logs.length})
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Preview Logs
              <Badge variant="secondary">{logs.length} entries</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 mb-4">
            <Button size="sm" variant="outline" onClick={() => setLogs(logger.getPreviewLogs())}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={clearLogs}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Logs
            </Button>
          </div>

          <ScrollArea className="h-[60vh]">
            <div className="space-y-2">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No logs yet. Start using the app to see user actions!</p>
                </div>
              ) : (
                logs.slice().reverse().map((log, index) => (
                  <Card key={index} className="p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getActionColor(log.action)}>
                            {log.action}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatTime(log.timestamp)}
                          </span>
                          {log.ipAddress && (
                            <Badge variant="outline" className="text-xs">
                              IP: {log.ipAddress}
                            </Badge>
                          )}
                        </div>

                        <div className="text-sm">
                          <span className="font-medium">
                            {log.userEmail || log.userId || 'Anonymous'}
                          </span>
                          {log.page && (
                            <span className="text-muted-foreground ml-2">@{log.page}</span>
                          )}
                        </div>

                        {log.details && Object.keys(log.details).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              Show details
                            </summary>
                            <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
