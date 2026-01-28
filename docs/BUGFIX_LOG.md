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
