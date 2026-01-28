-- Migration: add tier lock and map Ultra -> Elite (display tiers)
-- Safe for profiles only; does NOT touch payment/fees tables.

BEGIN;

-- 1) Add tier_locked flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier_locked boolean NOT NULL DEFAULT false;

-- 2) Map legacy ultra tiers to elite (display only)
UPDATE public.profiles
SET tier = 'elite'
WHERE tier ILIKE 'ultra%';

COMMIT;
