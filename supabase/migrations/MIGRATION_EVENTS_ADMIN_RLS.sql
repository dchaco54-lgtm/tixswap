BEGIN;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_admin_insert ON public.events;
CREATE POLICY events_admin_insert
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.user_type = 'admin'
    )
  );

DROP POLICY IF EXISTS events_admin_update ON public.events;
CREATE POLICY events_admin_update
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.user_type = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.user_type = 'admin'
    )
  );

DROP POLICY IF EXISTS events_admin_delete ON public.events;
CREATE POLICY events_admin_delete
  ON public.events
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.user_type = 'admin'
    )
  );

COMMIT;
