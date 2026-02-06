BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS nomination_enabled_at timestamptz;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS renomination_cutoff_hours int NOT NULL DEFAULT 36;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS renomination_max_changes int NOT NULL DEFAULT 1;

COMMIT;
