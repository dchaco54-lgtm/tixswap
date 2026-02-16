# Fix ticket_number default (support_tickets)

1. Abre Supabase Dashboard -> SQL Editor.
2. Ejecuta el archivo `supabase/scripts/support_ticket_number_default.sql`.
3. Inserta un ticket nuevo desde `/dashboard/tickets`.
4. Revisa que `support_tickets.ticket_number` tenga DEFAULT en `information_schema.columns`.
