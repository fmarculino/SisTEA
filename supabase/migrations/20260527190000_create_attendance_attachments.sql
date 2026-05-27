-- 1. Criar tabela de metadados de anexos do atendimento
CREATE TABLE IF NOT EXISTS public.attendance_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID NOT NULL REFERENCES public.attendances(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL, -- Caminho do arquivo no bucket (ex: attendance_id/nome_unico.ext)
    file_name TEXT NOT NULL, -- Nome original do arquivo (ex: laudo.pdf)
    size_bytes INTEGER NOT NULL, -- Tamanho em bytes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.attendance_attachments ENABLE ROW LEVEL SECURITY;

-- 3. Definir Políticas de Segurança RLS para a tabela de anexos
CREATE POLICY "Admin full attachments" 
ON public.attendance_attachments 
FOR ALL 
USING (public.get_user_role() = 'SMS_ADMIN');

CREATE POLICY "Clinic users view own attachments" 
ON public.attendance_attachments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.attendances
    WHERE id = attendance_attachments.attendance_id 
      AND clinic_id = public.get_user_clinic_id()
  )
);

CREATE POLICY "Clinic users insert own attachments" 
ON public.attendance_attachments 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.attendances
    WHERE id = attendance_attachments.attendance_id 
      AND clinic_id = public.get_user_clinic_id()
  )
);

CREATE POLICY "Clinic users delete own attachments" 
ON public.attendance_attachments 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.attendances
    WHERE id = attendance_attachments.attendance_id 
      AND clinic_id = public.get_user_clinic_id()
  )
);

-- 4. Criar o bucket de armazenamento no Supabase Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attendance-attachments', 
  'attendance-attachments', 
  false, 
  10485760, -- 10MB em bytes
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- 5. Definir políticas RLS no Storage para o bucket 'attendance-attachments'
CREATE POLICY "Allow authenticated full access to own clinic files"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'attendance-attachments')
WITH CHECK (bucket_id = 'attendance-attachments');
