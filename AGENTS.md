# TixSwap – Reglas de trabajo del agente (AGENTS)

## Idioma / tono
- Español (Chile), directo, sin humo.

## Objetivo Nº1 (anti-rupturas)
- NO romper endpoints existentes (misma forma del JSON).
- Cambios mínimos: editar líneas puntuales, NO reescrituras masivas.
- Si hay duda, primero INSPECCIÓN (queries, grep, revisar schema) antes de codear.
- Nunca inventar campos/tablas: si no existe en schema.json, se pregunta o se inspecciona.

## Quality gate (bloqueante)
- CERO errores ESLint/TS en build de Vercel.
- Variables no usadas = build roto. Se arregla sí o sí.

## Seguridad
- Nunca commitear .env.local ni claves.
- Solo .env.local.example con nombres de variables, sin valores.

## Zonas intocables (salvo orden explícita)
- app/api/payments/** y todo Webpay/BancoChile: NO tocar si funciona.
- Si hay que tocarlo: cambios mínimos y con checklist de regresión.

## Regla especial: “Mis publicaciones”
- /api/tickets/my-publications debe:
  - filtrar por seller_id del usuario autenticado
  - retornar tickets + event + ticket_upload (si existe)
  - mantener summary {total, active, paused, sold}
- Si ticket_upload_id está null, el endpoint debe seguir funcionando (ticket_upload = null, is_nominated = false).

## Regla especial: “Nominadas”
- La verdad está en ticket_uploads (is_nominated / is_nominada).
- tickets.ticket_upload_id es el vínculo.
- is_nominated que consume el front debe salir “normalizado”:
  - ticket_upload?.is_nominated ?? ticket_upload?.is_nominada ?? false

## Formato obligatorio de entrega cuando se implementa algo
1) Archivos exactos a tocar
2) Qué cambia (bullets)
3) Patch/diff preciso
4) Comandos a correr (npm run build)
5) Checklist final (UI + endpoint + prod)

