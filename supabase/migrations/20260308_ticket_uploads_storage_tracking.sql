BEGIN;

ALTER TABLE public.ticket_uploads
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id),
  ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES public.tickets(id),
  ADD COLUMN IF NOT EXISTS storage_path_staging text,
  ADD COLUMN IF NOT EXISTS storage_path_final text,
  ADD COLUMN IF NOT EXISTS filename_original text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ticket_uploads'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.ticket_uploads ADD COLUMN status text DEFAULT 'staging';
  END IF;
END $$;

UPDATE public.ticket_uploads
SET
  filename_original = COALESCE(filename_original, original_name, original_filename),
  size_bytes = COALESCE(size_bytes, file_size),
  storage_path_staging = COALESCE(storage_path_staging, storage_path),
  storage_path_final = COALESCE(
    storage_path_final,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.tickets t
        WHERE t.ticket_upload_id = ticket_uploads.id
      ) THEN storage_path
      ELSE NULL
    END
  ),
  ticket_id = COALESCE(
    ticket_id,
    (
      SELECT t.id
      FROM public.tickets t
      WHERE t.ticket_upload_id = ticket_uploads.id
      ORDER BY t.created_at DESC
      LIMIT 1
    )
  ),
  event_id = COALESCE(
    event_id,
    (
      SELECT t.event_id
      FROM public.tickets t
      WHERE t.ticket_upload_id = ticket_uploads.id
      ORDER BY t.created_at DESC
      LIMIT 1
    )
  ),
  status = CASE
    WHEN COALESCE(
      ticket_id,
      (
        SELECT t.id
        FROM public.tickets t
        WHERE t.ticket_upload_id = ticket_uploads.id
        ORDER BY t.created_at DESC
        LIMIT 1
      )
    ) IS NOT NULL THEN 'finalized'
    WHEN lower(COALESCE(status, '')) = 'orphaned' THEN 'orphaned'
    ELSE 'staging'
  END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_uploads_storage_path_staging_unique
  ON public.ticket_uploads(storage_path_staging)
  WHERE storage_path_staging IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_uploads_storage_path_final_unique
  ON public.ticket_uploads(storage_path_final)
  WHERE storage_path_final IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_uploads_event_id
  ON public.ticket_uploads(event_id);

CREATE INDEX IF NOT EXISTS idx_ticket_uploads_ticket_id
  ON public.ticket_uploads(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_uploads_status
  ON public.ticket_uploads(status);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ticket_uploads'
      AND policyname = 'ticket_uploads_owner_update'
  ) THEN
    DROP POLICY ticket_uploads_owner_update ON public.ticket_uploads;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ticket_uploads'
      AND policyname = 'ticket_uploads_owner_insert'
  ) THEN
    DROP POLICY ticket_uploads_owner_insert ON public.ticket_uploads;
  END IF;
END $$;

CREATE POLICY ticket_uploads_owner_insert
  ON public.ticket_uploads
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

COMMIT;
