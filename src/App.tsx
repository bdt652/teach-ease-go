import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import LogViewer from "@/components/LogViewer";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Guest from "./pages/Guest";
import Admin from "./pages/Admin";
import ShareSession from "./pages/ShareSession";
import JoinClass from "./pages/JoinClass";
import NotFound from "./pages/NotFound";
import Analytics from "./pages/Analytics";

const queryClient = new QueryClient();

// Log app initialization
console.log('🚀 Starting EduCode app...');
console.log('🔍 Logger instance:', logger);
console.log('🎯 Current URL:', window.location.href);
console.log('🎯 Is localhost:', window.location.hostname === 'localhost');

try {
  logger.log('APP_INITIALIZED', {
    version: '1.0.0',
    environment: window.location.hostname === 'localhost' ? 'preview' : 'production',
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString()
  });
  console.log('✅ App initialization log sent');
} catch (error) {
  console.error('❌ Failed to send app init log:', error);
}

// Test log after 2 seconds
setTimeout(() => {
  console.log('🧪 Sending test log...');
  try {
    logger.log('TEST_LOG_AFTER_INIT', {
      message: 'This is a test log 2 seconds after app init',
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
    console.log('✅ Test log sent successfully');
  } catch (error) {
    console.error('❌ Failed to send test log:', error);
  }
}, 2000);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/guest" element={<Guest />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/share/:sessionId" element={<ShareSession />} />
            <Route path="/join" element={<JoinClass />} />
            <Route path="/join/:classCode" element={<JoinClass />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <LogViewer />
        {/* <LogTest /> */}
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
