# Bugfix Log

## 2026-01-28 — Wallet en /dashboard/wallet rompe con "Application error"
- **Síntoma**: Pantalla en blanco con "client-side exception" al abrir Wallet.
- **Causa raíz**: `useMemo` usado en `app/dashboard/WalletSection.jsx` sin importarlo.
- **Fix**: Agregar `useMemo` al import de React.
- **Archivo**: `app/dashboard/WalletSection.jsx`
- **Validación**:
  - Abrir `/dashboard/wallet` en producción y confirmar que carga.
  - (Opcional) `npm run build` / `npm run lint`.

## 2026-01-28 — Menú lateral duplicado en detalle de publicación
- **Síntoma**: En `/dashboard/publications/[id]` se ve el sidebar duplicado.
- **Causa raíz**: El layout de `/dashboard` ya renderiza `DashboardSidebar`, y el detalle de publicación lo volvía a renderizar dentro de la página.
- **Fix**: Remover `DashboardSidebar` del `page.jsx` del detalle; dejarlo solo en `app/dashboard/layout.jsx`.
- **Archivo**: `app/dashboard/publications/[id]/page.jsx`
- **Cómo evitarlo**: Sidebar solo se monta en el layout de `/dashboard`, nunca dentro de páginas hijas.

## 2026-07-04 — Mis publicaciones responde `No autorizado`
- **Síntoma**: `/dashboard/publicaciones` carga el módulo, pero el endpoint `/api/tickets/my-publications` responde `401 No autorizado`.
- **Causa raíz**: La ruta mezclaba `@supabase/auth-helpers-nextjs` con el cliente nuevo `@supabase/ssr`, generando fallos intermitentes entre cookies y bearer token.
- **Fix**: Migrar la autenticación de la ruta a `createClient(cookies())` y dejar bearer con service-role solo como fast-path opcional.
- **Archivo**: `app/api/tickets/my-publications/route.js`
- **Cómo evitarlo**:
  - En route handlers nuevos no mezclar `createRouteHandlerClient` con `@/lib/supabase/server`.
  - Preferir un solo patrón de auth por ruta: cookies SSR o bearer + service-role.

## 2026-07-04 — Compra Webpay queda `pending` aunque el front complete el flujo
- **Síntoma**: El comprador vuelve a `/dashboard/purchases/[orderId]`, pero la orden queda en `Pendiente`; el vendedor no ve la venta y el PDF queda bloqueado.
- **Causa raíz**: El callback `app/api/payments/webpay/return/route.js` llamaba la RPC `settle_webpay_order_payment` con el parámetro incorrecto `p_total_paid_clp`; la función SQL productiva espera `p_amount_clp`.
- **Fix**: Corregir el nombre del parámetro en la llamada RPC y validar que la migración `supabase/migrations/20260614_webpay_production_hardening.sql` esté aplicada en producción.
- **Archivos**:
  - `app/api/payments/webpay/return/route.js`
  - `supabase/migrations/20260614_webpay_production_hardening.sql`
- **Cómo evitarlo**:
  - Cada cambio en callbacks críticos debe tener test que afirme los nombres exactos de parámetros RPC.
  - Antes de deploy productivo, correr checklist Webpay y verificar que exista la función `public.settle_webpay_order_payment`.

## 2026-07-04 — Comprador no puede descargar PDF de compra pagada
- **Síntoma**: El detalle de compra muestra el botón de PDF, pero no abre archivo o devuelve error.
- **Causa raíz**:
  - La descarga dependía de URL directa con cookies.
  - Había divergencia entre buckets/paths legacy (`tickets`) y nuevos (`ticket-pdfs`, `storage_path_final`, `upload_path`, etc.).
  - Si la orden seguía `pending`, el bloqueo del PDF era esperado por negocio, pero se confundía con un error de archivo.
- **Fix**:
  - Cambiar el botón comprador a `fetch` autenticado con bearer y signed URL.
  - Agregar fallbacks de bucket/path en `/api/tickets/[id]/pdf` y `/api/orders/[orderId]/pdf`.
- **Archivos**:
  - `app/dashboard/purchases/[orderId]/page.jsx`
  - `app/api/tickets/[id]/pdf/route.js`
  - `app/api/orders/[orderId]/pdf/route.js`
- **Cómo evitarlo**:
  - No depender de navegación directa autenticada por cookies cuando el dashboard ya usa access token.
  - Mantener una sola función helper para resolver buckets/paths de uploads.

## 2026-07-04 — Dashboard vendedor rompe por `column profiles.name does not exist`
- **Síntoma**: El vendedor entra a su panel/ventas y la API responde error SQL por `profiles.name`.
- **Causa raíz**: `app/api/orders/my-sales/route.js` seguía consultando el campo legacy `profiles.name`, pero el schema vigente usa `profiles.full_name`.
- **Fix**: Quitar `name` del `select` y normalizar el nombre comprador con `full_name || email || "Comprador"`.
- **Archivo**: `app/api/orders/my-sales/route.js`
- **Cómo evitarlo**:
  - En lecturas de perfiles usar `full_name` como canon.
  - Antes de agregar campos en queries, contrastar con `schema.json` o con introspección real de Supabase.

## 2026-07-04 — Admin pierde visibilidad de PDFs legacy y de entradas no activas
- **Síntoma**:
  - `/admin/uploads` deja de abrir algunos PDFs ya cargados.
  - `/admin/published-tickets` solo muestra tickets `active`, no el universo publicado.
- **Causa raíz**:
  - Los uploads legacy pueden venir con `bucket`, `path` o `file_path`, pero el helper solo resolvía `storage_bucket` y `storage_path*`.
  - El endpoint admin de entradas publicadas tenía hardcodeado `.eq("status", "active")`.
- **Fix**:
  - Extender helpers/API admin para soportar `bucket`, `path`, `file_path`.
  - Permitir ver todas las entradas publicadas y filtrar por `status` desde admin.
- **Archivos**:
  - `lib/ticketUploads.js`
  - `app/api/admin/uploads/route.js`
  - `app/api/admin/published-tickets/route.js`
  - `app/admin/published-tickets/page.jsx`
- **Cómo evitarlo**:
  - Cuando migremos nombres de columnas de storage, mantener compatibilidad de lectura por al menos una versión.
  - No hardcodear estados en vistas admin globales; exponer filtro opcional y resumen por estado.
