# Webpay Plus en Producción

## Variables de entorno en Vercel

Configurar únicamente en **Production**:

| Variable | Valor esperado |
|----------|----------------|
| `WEBPAY_ENV` | `production` |
| `WEBPAY_COMMERCE_CODE` | `YOUR_PRODUCTION_COMMERCE_CODE` |
| `WEBPAY_API_KEY_SECRET` | `YOUR_PRODUCTION_API_KEY_SECRET` |
| `NEXT_PUBLIC_SITE_URL` | `https://tixswap.cl` |

Notas:

- No guardar secretos en Git.
- No copiar credenciales reales a `.env`, `.env.local`, tests, logs ni documentación.
- Preview y Development deben seguir usando integración salvo decisión explícita.

## Pasos en Vercel

1. Ir a `Project Settings -> Environment Variables`.
2. Cargar las variables anteriores en `Production`.
3. Verificar que no existan valores productivos en `Preview` ni `Development`.
4. Hacer un redeploy manual del último deployment productivo.
5. Verificar en logs sólo una de estas líneas:
   - `[Webpay] Ambiente: PRODUCTION`
   - `[Webpay] Ambiente: INTEGRATION`

## Validaciones previas al merge

1. Confirmar que `WEBPAY_ENV=production` sin `WEBPAY_COMMERCE_CODE` falla al iniciar la sesión Webpay.
2. Confirmar que `WEBPAY_ENV=production` sin `WEBPAY_API_KEY_SECRET` falla al iniciar la sesión Webpay.
3. Confirmar que `WEBPAY_ENV=integration` usa integración aunque existan credenciales productivas cargadas por error.
4. Confirmar que el monto enviado a Webpay coincide con `orders.total_clp` y con la validación del callback.
5. Confirmar que el callback duplicado no vuelve a vender el ticket ni duplica correos/notificaciones.

## Procedimiento de prueba

1. Publicar un ticket de prueba.
2. Entrar a checkout y verificar el desglose de monto.
3. Crear sesión Webpay y revisar que la orden quede en `pending` con `payment_state = session_created`.
4. Completar un pago aprobado.
5. Verificar:
   - `orders.status = paid`
   - `orders.payment_state = AUTHORIZED`
   - `tickets.status = sold`
   - `orders.total_paid_clp = orders.total_clp`
   - existencia de auditoría `PAYMENT_SUCCESS`
6. Repetir con rechazo/cancelación y verificar estados `failed` o `canceled` según corresponda.
7. Forzar una discrepancia de monto en ambiente de prueba y verificar `payment_review` + auditoría `PAYMENT_AMOUNT_MISMATCH`.

## Monitoreo

- Revisar logs de `create-session` y `return` después del deploy.
- Revisar filas nuevas en `audit_events` para:
  - `PAYMENT_INITIATED`
  - `PAYMENT_SUCCESS`
  - `PAYMENT_FAILED`
  - `PAYMENT_CANCELED`
  - `PAYMENT_AMOUNT_MISMATCH`
  - `PAYMENT_REVIEW_REQUIRED`
- Revisar órdenes que queden en `payment_review`.
- Revisar tickets que permanezcan en `held` fuera de lo esperado.

## Rollback

1. Cambiar `WEBPAY_ENV` a `integration`.
2. Redeploy manual.
3. Revisar que los logs indiquen `[Webpay] Ambiente: INTEGRATION`.
4. Monitorear órdenes creadas durante la ventana del rollback y conciliar cualquier `payment_review`.

## Advertencias

- No desplegar a producción sin cargar las variables reales en Vercel.
- No forzar producción por presencia de credenciales: el cambio depende sólo de `WEBPAY_ENV`.
- No liberar tickets automáticamente cuando exista posibilidad de autorización pendiente o conciliación manual.
