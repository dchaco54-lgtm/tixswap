BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS warnings text;

COMMENT ON COLUMN public.events.warnings IS 'Advertencias/recomendaciones opcionales mostradas en la página del evento';

COMMIT;
