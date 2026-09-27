# Entribe — Reglas de trabajo del agente

## Fuente canónica y lectura obligatoria

- `docs/ENGINEERING_CONSTITUTION.md` es la fuente canónica de principios de ingeniería.
- Antes de cambiar algo, lee este archivo y, cuando existan, `docs/APP_OVERVIEW.md`, `docs/AI_WORKFLOW.md`, `docs/API_CONTRACTS.md`, `docs/DB_MAP.md`, `docs/db/schema.json` y `docs/ENTRIBE_AGENT_SEED.md`.
- Aplica también cualquier `AGENTS.md` más cercano al archivo que se modifica. Una regla local puede ser más estricta, no contradecir la constitución.

## Idioma / tono
- Español (Chile), directo, sin humo.

## Objetivo Nº1 (anti-rupturas)
- No romper endpoints existentes ni su shape JSON.
- Hacer cambios mínimos; no reescrituras masivas.
- Ante dudas, inspeccionar código, consumidores, schema y migraciones antes de modificar.
- Nunca inventar campos o tablas: confirmar en `docs/db/schema.json` y migraciones.

## Quality gate (bloqueante)
- CERO errores ESLint/TS en build de Vercel.
- Variables no usadas = build roto. Se arregla sí o sí.

## Seguridad
- Nunca commitear .env.local ni claves.
- Solo .env.local.example con nombres de variables, sin valores.

## Zonas intocables (salvo orden explícita)
- `app/api/payments/**` y todo Webpay/BancoChile: NO tocar si funciona.
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
