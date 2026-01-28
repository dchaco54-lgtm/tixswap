# App overview

## Flujos clave
- Sell: PDF -> ticket_uploads -> publish -> tickets (ticket_upload_id link)
- Mis publicaciones: tickets por seller_id + join event + join ticket_upload
- Checkout: preview -> create session -> return -> confirm -> order

## DB truth
- Nominadas: ticket_uploads.is_nominated / is_nominada
- Link: tickets.ticket_upload_id -> ticket_uploads.id

## Logs de fixes
- Ver `docs/BUGFIX_LOG.md` para histórico de incidentes y soluciones.
