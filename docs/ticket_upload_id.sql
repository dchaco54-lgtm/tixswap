-- Agregar relación opcional entre tickets y ticket_uploads
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS ticket_upload_id uuid;
ALTER TABLE public.tickets
  ADD CONSTRAINT IF NOT EXISTS tickets_ticket_upload_id_fkey
  FOREIGN KEY (ticket_upload_id) REFERENCES public.ticket_uploads(id)
  ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tickets_ticket_upload_id_idx ON public.tickets(ticket_upload_id);
