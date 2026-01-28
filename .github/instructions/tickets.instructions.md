---
applyTo: "app/api/tickets/**"
---

# Tickets / Mis publicaciones / Nominadas

## Contratos que NO se rompen
- /api/tickets/my-publications debe devolver:
  { tickets: [...], summary: { total, active, paused, sold } }

## Join a ticket_uploads
- Se hace por tickets.ticket_upload_id -> ticket_uploads.id
- Si ticket_upload_id es null:
  - ticket_upload = null
  - is_nominated = false
- Nunca asumir que existe ticket_upload siempre.

## Normalización
- is_nominated final:
  ticket_upload?.is_nominated ?? ticket_upload?.is_nominada ?? false

## Checklist obligatorio antes de push
- curl al endpoint con sesión válida
- Validar summary counts
- Validar que no revienta si ticket_upload_id null
