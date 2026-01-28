# TixSwap – Workflow de trabajo con IA

## Nuestro estilo (NO se negocia)
- Cambios mínimos (patch).
- NO reescritura masiva.
- NO romper contratos de endpoints.
- Cero errores ESLint en build.

## Errores comunes (y cómo evitarlos)
1) Vercel build falla por ESLint (unused vars).
   - Solución: eliminar params no usados, no dejar warnings que se vuelven errors.
2) Mis publicaciones se rompe por contract / shape JSON.
   - Mantener `{ tickets, summary }` siempre.
3) Supabase: campos/relaciones que “no existen”.
   - Verificar en schema.json antes de codear.
4) Env vars faltantes rompen build en server routes.
   - Crear cliente Supabase lazy dentro del handler, fallback 500 JSON claro.

## Zonas intocables
- app/api/payments/** (Webpay/BancoChile) NO tocar salvo bug real.

## Checklist antes de push
- npm run build
- Probar endpoints críticos:
  - /api/tickets/my-publications
  - /api/checkout/preview
  - /api/payments/webpay/*
