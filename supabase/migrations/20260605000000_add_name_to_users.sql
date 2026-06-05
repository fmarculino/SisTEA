-- Migration: Add name to public.users
-- Description: Adiciona a coluna 'name' na tabela public.users para facilitar a identificação dos usuários.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
