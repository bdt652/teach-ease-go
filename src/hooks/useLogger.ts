import { useAuth } from './useAuth';
import { logger } from '@/lib/logger';

export function useLogger() {
  const { user } = useAuth();

  const userInfo = user ? { id: user.id, email: user.email } : undefined;

  const logAction = (action: string, details?: any, page?: string) => {
    logger.log(action, details, userInfo, page);
  };

  const logAuth = (action: 'login' | 'logout' | 'signup', success?: boolean) => {
    logger.logAuth(action, userInfo, success);
  };

  const logNavigation = (from: string, to: string) => {
    logger.logNavigation(from, to, userInfo);
  };

  const logClassAction = (action: string, classId: string, className: string, details?: any) => {
    logger.logClassAction(action, classId, className, userInfo, details);
  };

  const logSessionAction = (action: string, sessionId: string, sessionTitle: string, classId: string, details?: any) => {
    logger.logSessionAction(action, sessionId, sessionTitle, classId, userInfo, details);
  };

  const logSubmissionAction = (action: string, submissionId: string, sessionId: string, details?: any) => {
    logger.logSubmissionAction(action, submissionId, sessionId, userInfo, details);
  };

  const logFileAction = (action: string, fileName: string, fileSize?: number, details?: any) => {
    logger.logFileAction(action, fileName, fileSize, userInfo, details);
  };

  return {
    logAction,
    logAuth,
    logNavigation,
    logClassAction,
    logSessionAction,
    logSubmissionAction,
    logFileAction,
    getPreviewLogs: logger.getPreviewLogs.bind(logger),
    clearPreviewLogs: logger.clearPreviewLogs.bind(logger)
  };
}
