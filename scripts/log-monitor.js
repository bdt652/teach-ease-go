#!/usr/bin/env node

import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

// Get environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load from .env.local first, then fallback to process.env
let supabaseUrl = process.env.VITE_SUPABASE_URL;
let supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  try {
    // Try to load dotenv if available
    const dotenv = await import('dotenv');
    dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
    supabaseUrl = process.env.VITE_SUPABASE_URL;
    supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  } catch (e) {
    // dotenv not available, continue
  }
}

// Check if we have Supabase config
const hasSupabase = !!(supabaseUrl && supabaseKey);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function getActionColor(action) {
  if (action.startsWith('AUTH_')) return colors.blue;
  if (action.startsWith('CLASS_')) return colors.green;
  if (action.startsWith('SESSION_')) return colors.yellow;
  if (action.startsWith('SUBMISSION_')) return colors.magenta;
  if (action.startsWith('FILE_')) return colors.cyan;
  if (action === 'NAVIGATION') return colors.white;
  return colors.white;
}

if (!hasSupabase) {
  console.log('⚠️  Supabase environment variables not found');
  console.log('🚀 Running in LOCAL mode - monitoring browser logs via WebSocket');
  console.log('');

  // Start a simple WebSocket server to receive logs from browser
  const wss = new WebSocketServer({ port: 8080 });

  console.log('🔌 WebSocket server started on port 8080');
  console.log('📡 Waiting for browser to connect...\n');

  wss.on('connection', (ws) => {
    console.log('✅ Browser connected! Ready to receive logs...\n');

    ws.on('message', (data) => {
      try {
        const logData = JSON.parse(data.toString());
        const time = new Date().toLocaleTimeString('vi-VN', {
          hour12: false,
          timeZone: 'Asia/Ho_Chi_Minh'
        });

        const user = logData.userEmail || logData.userId || 'Anonymous';
        const ip = logData.ipAddress || '127.0.0.1';
        const page = logData.page || '/';
        const action = logData.action;

        console.log(`🚀 [${time}] ${getActionColor(action)}${action}${colors.reset} ${colors.green}${user}${colors.reset} ${colors.yellow}[${ip}]${colors.reset} @${page} (live)`);

        if (logData.details && Object.keys(logData.details).length > 0) {
          console.log(`  📋 Details: ${JSON.stringify(logData.details)}`);
        }
        console.log('');

      } catch (error) {
        console.log('📨 Raw log:', data.toString());
      }
    });

    ws.on('close', () => {
      console.log('❌ Browser disconnected');
    });
  });

  console.log('🎯 Local log monitor is running...');
  console.log('💡 Open http://localhost:6500 in browser to see live logs');
  console.log('💡 Logs will appear here when users interact with the app\n');

} else {
  // Supabase mode
  console.log('🚀 EduCode User Action Log Monitor');
  console.log('==================================');
  console.log('Monitoring user actions via Supabase real-time...\n');

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh'
    });
  }

  function formatLog(log) {
    const time = formatTimestamp(log.timestamp);
    const user = log.user_email || log.user_id || 'Anonymous';
    const ip = log.ip_address || 'Unknown';
    const page = log.page || '-';
    const env = log.environment;
    const color = getActionColor(log.action);

    return `${colors.bright}[${time}]${colors.reset} ${color}${log.action}${colors.reset} ${colors.green}${user}${colors.reset} ${colors.yellow}[${ip}]${colors.reset} @${page} (${env})`;
  }

  async function monitorLogs() {
    console.log('📡 Setting up real-time subscription...\n');

    const channel = supabase
      .channel('user_action_logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_action_logs'
        },
        (payload) => {
          const log = payload.new;
          console.log(formatLog(log));

          // Show details if available
          if (log.details && Object.keys(log.details).length > 0) {
            console.log(`  📋 Details: ${JSON.stringify(log.details, null, 2)}`);
          }
          console.log(''); // Empty line for spacing
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Connected to Supabase real-time');
          console.log('🎯 Waiting for user actions...\n');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Failed to connect to Supabase real-time');
        }
      });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down log monitor...');
      supabase.removeChannel(channel);
      process.exit(0);
    });
  }

  // Start monitoring
  monitorLogs().catch(error => {
    console.error('❌ Failed to start log monitor:', error);
    process.exit(1);
  });
}

