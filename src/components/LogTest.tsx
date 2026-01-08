import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLogger } from '@/hooks/useLogger';

export default function LogTest() {
  const { logAction, logClassAction, logSessionAction } = useLogger();

  useEffect(() => {
    console.log('🧪 LogTest component mounted - testing logging...');

    // Test basic logging
    try {
      logAction('TEST_COMPONENT_MOUNT', {
        message: 'LogTest component initialized',
        timestamp: new Date().toISOString()
      });
      console.log('✅ LogTest: Basic log sent');
    } catch (error) {
      console.error('❌ LogTest: Failed to send basic log:', error);
    }

    // Test class action
    try {
      logClassAction('TEST_CLASS', 'test-class-id', 'Test Class', {
        description: 'This is a test class action'
      });
      console.log('✅ LogTest: Class log sent');
    } catch (error) {
      console.error('❌ LogTest: Failed to send class log:', error);
    }

    // Test session action
    try {
      logSessionAction('TEST_SESSION', 'test-session-id', 'Test Session', 'test-class-id', {
        description: 'This is a test session action'
      });
      console.log('✅ LogTest: Session log sent');
    } catch (error) {
      console.error('❌ LogTest: Failed to send session log:', error);
    }

  }, [logAction, logClassAction, logSessionAction]);

  const testMoreLogs = () => {
    logAction('BUTTON_CLICK_TEST', {
      button: 'Test More Logs',
      clickTime: new Date().toISOString()
    });

    logClassAction('CREATE_TEST', 'test-class-2', 'Another Test Class');

    logSessionAction('UPDATE_TEST', 'test-session-2', 'Another Session', 'test-class-2', {
      status: 'updated'
    });
  };

  // Hide the test panel - only show in development mode
  if (typeof window === 'undefined' ||
      window.location.hostname !== 'localhost' ||
      !window.location.port.startsWith('80')) { // Only show in dev server (8001)
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-yellow-100 border border-yellow-300 p-4 rounded-lg shadow-lg">
      <h3 className="font-bold text-yellow-800 mb-2">🧪 Log Test Panel</h3>
      <p className="text-sm text-yellow-700 mb-3">
        Check console and LogViewer for test logs!
      </p>
      <Button onClick={testMoreLogs} size="sm" className="bg-yellow-600 hover:bg-yellow-700">
        Generate More Test Logs
      </Button>
    </div>
  );
}
