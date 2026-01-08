import { supabase } from '@/integrations/supabase/client'

export interface LogEntry {
  timestamp: string;
  userId?: string;
  userEmail?: string;
  action: string;
  details?: any;
  page?: string;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
}

class UserActionLogger {
  private isPreviewMode: boolean;
  private isProduction: boolean;
  private sessionId: string;
  private ipAddress: string | null = null;
  private logQueue: LogEntry[] = [];
  private isSending: boolean = false;
  private wsConnection: WebSocket | null = null;

  constructor() {
    // Check environment - force preview mode for localhost
    this.isPreviewMode = typeof window !== 'undefined' &&
                        window.location.hostname === 'localhost';

    this.isProduction = typeof window !== 'undefined' &&
                       window.location.hostname !== 'localhost';

    console.log('🔧 Logger initialized:', {
      isPreviewMode: this.isPreviewMode,
      isProduction: this.isProduction,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
      port: typeof window !== 'undefined' ? window.location.port : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent.substring(0, 50) + '...' : 'unknown'
    });

    // Generate session ID
    this.sessionId = this.generateSessionId();

    // Try to get IP address
    if (typeof window !== 'undefined') {
      this.detectIPAddress();
    }

    // Test log immediately
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        console.log('🔧 Logger sending test log...');
        this.log('LOGGER_TEST_INIT', {
          message: 'Logger initialized and working',
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: window.navigator.userAgent
        });
      }, 1000);
    }
  }

  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private async detectIPAddress() {
    // For localhost/development, just use local IP
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      this.ipAddress = '127.0.0.1 (Local)';
      return;
    }

    try {
      // Try multiple IP detection services
      const services = [
        'https://api.ipify.org?format=json',
        'https://ipapi.co/json/',
        'https://api.ip.sb/jsonip',
        'https://httpbin.org/ip'
      ];

      for (const service of services) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

          const response = await fetch(service, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0'
            }
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            this.ipAddress = data.ip || data.query || data.origin;
            return;
          }
        } catch (e) {
          continue; // Try next service
        }
      }

      // If all services fail, fallback to WebRTC method
      await this.detectIPFromWebRTC();

    } catch (error) {
      await this.detectIPFromWebRTC();
    }
  }

  private async detectIPFromWebRTC() {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.createDataChannel('');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));

      return new Promise<void>((resolve) => {
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate;
            const ipMatch = candidate.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
            if (ipMatch && ipMatch[1] !== '127.0.0.1' && ipMatch[1] !== '0.0.0.0') {
              this.ipAddress = ipMatch[1] + ' (WebRTC)';
              pc.close();
              resolve();
            }
          }
        };

        // Timeout after 5 seconds
        setTimeout(() => {
          if (!this.ipAddress) {
            this.ipAddress = 'Unknown';
          }
          pc.close();
          resolve();
        }, 5000);
      });
    } catch (e) {
      this.ipAddress = 'Unknown';
    }
  }

  private async sendLogToBackend(entry: LogEntry): Promise<void> {
    try {
      // Always try to send to Supabase first (for both preview and production)
      try {
        const logData = {
          user_id: entry.userId || null,
          user_email: entry.userEmail || null,
          action: entry.action,
          details: entry.details || {},
          page: entry.page || null,
          user_agent: entry.userAgent || null,
          ip_address: entry.ipAddress || null,
          session_id: entry.sessionId || null,
          environment: this.isPreviewMode ? 'preview' : 'production',
          timestamp: entry.timestamp
        };

        const { error } = await supabase
          .from('user_action_logs')
          .insert(logData);

        if (error) {
          console.warn('⚠️ Supabase logging failed:', error.message);
          console.log('📋 Will try WebSocket fallback...');
        } else {
          console.log('📤 Log sent to Supabase successfully:', entry.action);
          return; // Successfully sent to Supabase
        }
      } catch (supabaseError) {
        console.warn('⚠️ Supabase connection failed:', supabaseError);
      }

      // Fallback to WebSocket for local development
      if (this.isPreviewMode && typeof window !== 'undefined') {
        try {
          // Check if WebSocket connection exists
          if (!this.wsConnection) {
            this.wsConnection = new WebSocket('ws://localhost:8080');
            this.wsConnection.onopen = () => {
              console.log('🔌 Connected to local log server');
            };
            this.wsConnection.onerror = (error) => {
              console.warn('❌ WebSocket connection failed:', error);
              this.wsConnection = null;
            };
          }

          if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
            this.wsConnection.send(JSON.stringify(entry));
            console.log('📡 Log sent to WebSocket server');
            return; // Successfully sent to WebSocket
          }
        } catch (wsError) {
          console.warn('⚠️ WebSocket send failed:', wsError);
        }
      }

      // Always show in console for debugging
      console.log('📋 Local Log:', entry);

    } catch (error) {
      console.warn('❌ Failed to send log:', error);
    }
  }

  private scheduleRetry() {
    if (this.isSending) return;

    this.isSending = true;
    setTimeout(async () => {
      await this.processQueue();
    }, 5000); // Retry after 5 seconds
  }

  private async processQueue() {
    if (this.logQueue.length === 0) {
      this.isSending = false;
      return;
    }

    const entry = this.logQueue.shift();
    if (entry) {
      try {
        await this.sendLogToBackend(entry);
      } catch (error) {
        // If still failing, put back in queue
        this.logQueue.unshift(entry);
        this.isSending = false;
        return;
      }
    }

    // Continue processing queue
    setTimeout(() => this.processQueue(), 1000);
  }

  private formatLogEntry(entry: LogEntry): string {
    const time = new Date(entry.timestamp).toLocaleTimeString('vi-VN', {
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh'
    });

    const userInfo = entry.userId ? `[${entry.userEmail || entry.userId}]` : '[Anonymous]';
    const pageInfo = entry.page ? ` @${entry.page}` : '';
    const ipInfo = entry.ipAddress ? ` [${entry.ipAddress}]` : '';

    return `🚀 [${time}]${ipInfo} ${userInfo}${pageInfo} ${entry.action}`;
  }

  log(action: string, details?: any, userInfo?: { id?: string; email?: string }, page?: string) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      userId: userInfo?.id,
      userEmail: userInfo?.email,
      action,
      details,
      page: page || (typeof window !== 'undefined' ? window.location.pathname : undefined),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      ipAddress: this.ipAddress || undefined,
      sessionId: this.sessionId
    };

    // Always log to console for debugging with enhanced formatting
    console.log(`%c${this.formatLogEntry(entry)}`, 'color: #10b981; font-weight: bold; font-size: 12px;');

    if (details && Object.keys(details).length > 0) {
      console.log('%c📋 Details:', 'color: #6b7280; font-weight: bold;', details);
    }

    // Send to backend in production or preview mode (async, non-blocking)
    if (this.isProduction || this.isPreviewMode) {
      this.sendLogToBackend(entry).catch(error => {
        console.warn('Failed to send log to backend:', error);
      });
    }

    // In preview mode, also store logs for potential display
    if (this.isPreviewMode) {
      this.storePreviewLog(entry);
    }
  }

  private storePreviewLog(entry: LogEntry) {
    if (typeof window === 'undefined') return;

    try {
      const logs = JSON.parse(localStorage.getItem('preview_user_logs') || '[]');
      logs.push(entry);

      // Keep only last 100 logs to prevent localStorage bloat
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }

      localStorage.setItem('preview_user_logs', JSON.stringify(logs));
    } catch (error) {
      console.warn('Failed to store preview log:', error);
    }
  }

  getPreviewLogs(): LogEntry[] {
    if (typeof window === 'undefined') return [];

    try {
      return JSON.parse(localStorage.getItem('preview_user_logs') || '[]');
    } catch (error) {
      console.warn('Failed to retrieve preview logs:', error);
      return [];
    }
  }

  clearPreviewLogs() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('preview_user_logs');
    }
  }

  // Specific logging methods for common actions
  logAuth(action: 'login' | 'logout' | 'signup', userInfo?: { id?: string; email?: string }, success?: boolean) {
    this.log(`AUTH_${action.toUpperCase()}`, { success }, userInfo);
  }

  logNavigation(from: string, to: string, userInfo?: { id?: string; email?: string }) {
    this.log('NAVIGATION', { from, to }, userInfo);
  }

  logClassAction(action: string, classId: string, className: string, userInfo?: { id?: string; email?: string }, details?: any) {
    this.log(`CLASS_${action.toUpperCase()}`, { classId, className, ...details }, userInfo);
  }

  logSessionAction(action: string, sessionId: string, sessionTitle: string, classId: string, userInfo?: { id?: string; email?: string }, details?: any) {
    this.log(`SESSION_${action.toUpperCase()}`, { sessionId, sessionTitle, classId, ...details }, userInfo);
  }

  logSubmissionAction(action: string, submissionId: string, sessionId: string, userInfo?: { id?: string; email?: string }, details?: any) {
    this.log(`SUBMISSION_${action.toUpperCase()}`, { submissionId, sessionId, ...details }, userInfo);
  }

  logFileAction(action: string, fileName: string, fileSize?: number, userInfo?: { id?: string; email?: string }, details?: any) {
    this.log(`FILE_${action.toUpperCase()}`, { fileName, fileSize, ...details }, userInfo);
  }
}

export const logger = new UserActionLogger();
