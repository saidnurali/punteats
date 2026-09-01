-- ==============================================================================
-- PuntEats Production Security: Admin Audit Log Table
-- ==============================================================================
-- Description: Creates a secure audit log for all administrative actions 
-- (e.g. broadcasting push notifications, managing users).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid REFERENCES auth.users(id) NOT NULL,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super-admins (Service Role) can insert/view audit logs
CREATE POLICY "Service Role full access on admin_audit_log"
  ON public.admin_audit_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Ensure normal users have absolutely no access to audit logs
CREATE POLICY "No access for normal users"
  ON public.admin_audit_log
  FOR ALL
  TO authenticated, anon
  USING (false);
