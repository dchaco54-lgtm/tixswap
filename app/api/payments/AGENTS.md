# Pagos — instrucciones locales

Estas reglas complementan `../../../AGENTS.md` y `../../../docs/ENGINEERING_CONSTITUTION.md`.

- Zona protegida: no modificar por estética ni sin una necesidad confirmada e instrucción explícita.
- Preservar rutas, shapes JSON y compatibilidad de Webpay/Banco de Chile.
- Antes de cambiar, trazar autenticación, monto y currency server-side, estados de orden/ticket, callbacks, retries, idempotencia y efectos en base de datos.
- Considerar callbacks duplicados, ejecución concurrente, partial failures y recuperación de órdenes pendientes.
- No registrar ni exponer tokens, datos bancarios, QR, RUT u otros datos sensibles.
- Exigir tests focalizados, `npm run build` y checklist de regresión del proveedor y del flujo completo.
