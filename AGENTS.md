# TixSwap – AI Operating Rules (AGENTS.md)

## Idioma y tono
- Responde SIEMPRE en español (Chile), directo, sin relleno.
- Si hay ambigüedad, asume lo más probable y ofrece 1 alternativa (no 10).

## Estilo de trabajo (lo más importante)
- NO reescribas archivos enteros “porque sí”.
- Preferir cambios mínimos: editar líneas puntuales, mantener firmas, mantener el shape de respuestas.
- Si un endpoint ya funciona, NO cambies su contract (shape) sin dejar retrocompatibilidad.
- Antes de tocar BD, SIEMPRE verificar con information_schema / queries de inspección.

## Output esperado (cómo debes entregar cambios)
1) Qué archivo(s) tocar (rutas exactas)
2) Qué cambia (bullet points)
3) Patch/diff o edición precisa (sin inventar)
4) Comandos a correr (npm run build, etc.)
5) Qué revisar en UI / endpoints (checklist)

## Reglas de calidad (anti-parto)
- Cero ESLint errors en build. Evitar variables no usadas.
- Nunca introducir secretos en el repo:
  - NO commitear `.env.local`
  - Sí commitear `.env.local.example`
- Siempre mantener `.gitignore` sano (NO ignorar `*.ts` globalmente).
- Si agregas columnas en Supabase: incluye SQL de migración + validación SELECT.

## Next.js / App Router
- Rutas API: `app/api/**/route.(js|ts)`
- Respuestas deben ser JSON consistente:
  - `200` ok
  - `401` no auth
  - `500` error interno con mensaje claro
- No romper endpoints críticos:
  - `/api/tickets/my-publications` debe devolver `{ tickets: [], summary: {total, active, paused, sold} }`

## Supabase
- Client components: solo `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Service role SOLO en server (route handlers/utilities server). Nunca en "use client".
- Si falta env var en build/local:
  - manejarlo dentro del handler (lazy) y responder 500 JSON claro.

## Commit / Deploy
- Commits chicos, mensaje claro: `fix: ...`, `chore: ...`, `feat: ...`
- Antes de push: `npm run build` (y si existe, `npm run lint`)
