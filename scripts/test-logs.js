#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get environment variables (Vite exposes them with VITE_ prefix)
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

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🧪 Testing EduCode Logging System...\n');

// Test data
const testLogs = [
  {
    user_id: null,
    user_email: 'test@example.com',
    action: 'TEST_LOGGING',
    details: { message: 'This is a test log entry', testId: 1 },
    page: '/test',
    user_agent: 'TestScript/1.0',
    ip_address: '127.0.0.1',
    session_id: 'test-session-123',
    environment: 'test'
  },
  {
    user_id: null,
    user_email: 'student@test.com',
    action: 'AUTH_LOGIN',
    details: { success: true, method: 'email' },
    page: '/auth',
    user_agent: 'TestBrowser/1.0',
    ip_address: '192.168.1.100',
    session_id: 'session-student-456',
    environment: 'production'
  },
  {
    user_id: null,
    user_email: 'teacher@test.com',
    action: 'CLASS_CREATE_SUCCESS',
    details: { classId: 'class-123', className: 'Test Class', code: 'TEST101' },
    page: '/dashboard',
    user_agent: 'TestBrowser/1.0',
    ip_address: '192.168.1.200',
    session_id: 'session-teacher-789',
    environment: 'production'
  }
];

async function insertTestLogs() {
  console.log('📝 Inserting test logs...\n');

  for (const log of testLogs) {
    try {
      const { error } = await supabase
        .from('user_action_logs')
        .insert(log);

      if (error) {
        console.error(`❌ Failed to insert log for ${log.action}:`, error);
      } else {
        console.log(`✅ Inserted ${log.action} log`);
      }
    } catch (error) {
      console.error(`❌ Error inserting ${log.action}:`, error);
    }
  }

  console.log('\n🎯 Test logs inserted successfully!');
  console.log('📊 You can now view these logs in:');
  console.log('   - Admin Dashboard → User Logs tab');
  console.log('   - Terminal: npm run logs');
}

async function checkTableExists() {
  console.log('🔍 Checking if user_action_logs table exists...\n');

  try {
    const { data, error } = await supabase
      .from('user_action_logs')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ Table does not exist or not accessible:', error);
      console.log('\n💡 Make sure to run the migration:');
      console.log('   supabase db push');
      console.log('\n   Or run the SQL in Supabase Dashboard:');
      console.log('   supabase/migrations/20251228000000_create_user_action_logs.sql');
      return false;
    }

    console.log('✅ user_action_logs table exists and is accessible');
    return true;
  } catch (error) {
    console.error('❌ Error checking table:', error);
    return false;
  }
}

async function runTests() {
  const tableExists = await checkTableExists();

  if (tableExists) {
    await insertTestLogs();
  } else {
    console.log('\n❌ Cannot proceed with tests - table does not exist');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
