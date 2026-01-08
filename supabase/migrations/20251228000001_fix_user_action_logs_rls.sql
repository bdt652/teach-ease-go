-- Fix RLS for user_action_logs table
-- Ensure RLS is enabled and policies are correct

-- Enable RLS (in case it wasn't enabled)
ALTER TABLE user_action_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow inserts for all users" ON user_action_logs;
DROP POLICY IF EXISTS "Allow reads for admin users" ON user_action_logs;

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

-- Verify RLS is enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'user_action_logs'
        AND n.nspname = 'public'
        AND c.relrowsecurity = true
    ) THEN
        RAISE EXCEPTION 'RLS is not enabled on user_action_logs table';
    END IF;

    RAISE NOTICE 'RLS is successfully enabled on user_action_logs table';
END
$$;
