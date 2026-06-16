-- =====================================================
-- Migration: Suporte a logos (Instituição + Clínicas)
-- =====================================================

-- 1. Adicionar campo logo_url na tabela clinics
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Criar bucket de logos no Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  1048576, -- 1MB
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de acesso ao bucket de logos
-- Qualquer pessoa autenticada pode ler (logos são públicas)
CREATE POLICY "Public read logos" ON storage.objects
FOR SELECT USING (bucket_id = 'logos');

-- SMS_ADMIN pode fazer upload/atualizar logos da instituição
CREATE POLICY "SMS_ADMIN manage logos" ON storage.objects
FOR ALL USING (
  bucket_id = 'logos'
  AND auth.role() = 'authenticated'
);
