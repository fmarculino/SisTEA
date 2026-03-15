-- Create system_metadata table to track system versioning
CREATE TABLE IF NOT EXISTS public.system_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    current_version TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_metadata ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to all authenticated users"
ON public.system_metadata FOR SELECT
TO authenticated
USING (true);

-- Allow update only for SMS_ADMIN users (using public.users role)
CREATE POLICY "Allow update for SMS_ADMIN"
ON public.system_metadata FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE public.users.id = auth.uid()
        AND public.users.role = 'SMS_ADMIN'
    )
);

-- Insert initial version
INSERT INTO public.system_metadata (current_version)
VALUES ('0.0.1-beta');
