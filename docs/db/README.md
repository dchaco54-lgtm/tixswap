# DB – mapa rápido

## Tickets y nominadas
- tickets.ticket_upload_id -> ticket_uploads.id
- ticket_uploads tiene flags: is_nominated / is_nominada

## Regla
- Si ticket_upload_id es null, la UI debe mostrar “Nominada: No” sin romper.
