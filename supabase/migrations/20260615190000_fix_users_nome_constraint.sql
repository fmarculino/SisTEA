-- Migration: Fix users nome constraint and drop redundant trigger
-- Description: Torna a coluna 'nome' opcional (nullable) e remove o trigger 'on_auth_user_created' redundante que causava conflito de chaves duplicadas.

ALTER TABLE public.users ALTER COLUMN nome DROP NOT NULL;

-- Remove o trigger e a função que tentavam duplicar a inserção feita pelo Next.js
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
