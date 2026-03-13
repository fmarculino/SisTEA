-- Add missing columns to attendances (acting as the main Frequency Control sheet)
ALTER TABLE attendances
ADD COLUMN authorization_date date,
ADD COLUMN authorized_quantity integer NOT NULL DEFAULT 20,
ADD COLUMN attendance_character text;

-- Create attendance_sessions table
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    attendance_id uuid NOT NULL REFERENCES attendances(id) ON DELETE CASCADE,
    session_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    status text NOT NULL DEFAULT 'Realizada',
    created_at timestamp with time zone NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT attendance_sessions_pkey PRIMARY KEY (id)
);

-- RLS Policies for attendance_sessions
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Select policies
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."attendance_sessions";
CREATE POLICY "Enable read access for all users" ON "public"."attendance_sessions"
FOR SELECT USING (true);

-- Insert policies
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."attendance_sessions";
CREATE POLICY "Enable insert for authenticated users only" ON "public"."attendance_sessions"
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Update policies
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."attendance_sessions";
CREATE POLICY "Enable update for authenticated users only" ON "public"."attendance_sessions"
FOR UPDATE USING (auth.role() = 'authenticated');

-- Delete policies
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON "public"."attendance_sessions";
CREATE POLICY "Enable delete for authenticated users only" ON "public"."attendance_sessions"
FOR DELETE USING (auth.role() = 'authenticated');

-- Triggers for updated_at
DROP TRIGGER IF EXISTS handle_updated_at ON attendance_sessions;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
