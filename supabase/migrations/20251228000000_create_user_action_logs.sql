-- Create user_action_logs table for storing user actions
CREATE TABLE IF NOT EXISTS user_action_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    page TEXT,
    user_agent TEXT,
    ip_address INET,
    session_id TEXT,
    environment TEXT DEFAULT 'production',
    timestamp TIMESTAMPTZ DEFAULT NOW(),

    -- Add indexes for better query performance
    INDEX idx_user_action_logs_user_id (user_id),
    INDEX idx_user_action_logs_action (action),
    INDEX idx_user_action_logs_timestamp (timestamp),
    INDEX idx_user_action_logs_session_id (session_id),
    INDEX idx_user_action_logs_environment (environment)
);

-- Enable RLS
ALTER TABLE user_action_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow inserts from authenticated and anonymous users
CREATE POLICY "Allow inserts for all users" ON user_action_logs
    FOR INSERT WITH CHECK (true);

-- Create policy to allow reads for admin users only
CREATE POLICY "Allow reads for admin users" ON user_action_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- Grant permissions
GRANT INSERT ON user_action_logs TO anon, authenticated;
GRANT SELECT ON user_action_logs TO authenticated;
