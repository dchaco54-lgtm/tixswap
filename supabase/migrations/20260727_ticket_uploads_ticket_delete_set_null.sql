-- Permite borrar una publicación conservando el upload/PDF asociado.
-- Aplica tanto a la eliminación del vendedor como al mantenedor administrativo.
ALTER TABLE public.ticket_uploads
  DROP CONSTRAINT IF EXISTS ticket_uploads_ticket_id_fkey;

ALTER TABLE public.ticket_uploads
  ADD CONSTRAINT ticket_uploads_ticket_id_fkey
  FOREIGN KEY (ticket_id)
  REFERENCES public.tickets(id)
  ON DELETE SET NULL;
