# API Contracts (NO romper)

## GET /api/tickets/my-publications
Response:
{
  "tickets": [...],
  "summary": { "total": number, "active": number, "paused": number, "sold": number }
}

Reglas:
- Si ticket_upload no existe: ticket_upload:null, is_nominated:false
