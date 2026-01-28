# Bugfix Log

## 2026-01-28 — Wallet en /dashboard/wallet rompe con "Application error"
- **Síntoma**: Pantalla en blanco con "client-side exception" al abrir Wallet.
- **Causa raíz**: `useMemo` usado en `app/dashboard/WalletSection.jsx` sin importarlo.
- **Fix**: Agregar `useMemo` al import de React.
- **Archivo**: `app/dashboard/WalletSection.jsx`
- **Validación**:
  - Abrir `/dashboard/wallet` en producción y confirmar que carga.
  - (Opcional) `npm run build` / `npm run lint`.
