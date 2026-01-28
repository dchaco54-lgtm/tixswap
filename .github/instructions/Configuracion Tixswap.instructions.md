---
name: TixSwap API Rules
description: Reglas para app/api/** (Next.js route handlers)
applyTo: "app/api/**"
---

- Nunca cambiar el shape de respuesta sin retrocompatibilidad.
- Para /api/tickets/my-publications:
  - Siempre devolver `{ tickets, summary }`
  - `summary` debe incluir total/active/paused/sold
  - Si falta relación o columna, NO reventar: devolver ticket_upload:null e is_nominated:false.
- Evitar ESLint errors: no dejes parámetros sin usar (si no se usa `request`, eliminarlo).
- Manejar errores con `NextResponse.json({ error }, { status })`.
