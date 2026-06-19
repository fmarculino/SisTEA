-- Migration: Add allows_multiple_signatures to clinics
-- Description: Adds a configuration flag to clinics that controls if patient validations can be unified for multiple appointments scheduled on the same day.

ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS allows_multiple_signatures BOOLEAN DEFAULT false NOT NULL;
