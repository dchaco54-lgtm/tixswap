# ✅ CHECKLIST: Poner Webpay en Producción

## 1. Variables de Entorno en Vercel (HACER AHORA)

Ve a: **Vercel Dashboard → Tu Proyecto → Settings → Environment Variables**

Agregar estas 3 variables:

| Variable | Valor | Environment |
|----------|-------|-------------|
| `WEBPAY_ENV` | `production` | Production |
| `WEBPAY_COMMERCE_CODE` | `597053037929` | Production |
| `WEBPAY_API_KEY_SECRET` | `64890ada-9435-474e-b1c4-f7b377cf30f7` | Production |

**IMPORTANTE:** 
- NO las pongas en Preview/Development (para que esos ambientes sigan usando integración)
- Guarda cada una haciendo click en "Save"

---

## 2. Variable del Sitio (VERIFICAR)

Verifica que tengas esta variable (si no existe, agrégala):

| Variable | Valor | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_SITE_URL` | `https://tixswap.cl` | Production |

Esto asegura que las URLs de retorno de Webpay usen HTTPS.

---

## 3. Redeploy (DESPUÉS DE AGREGAR VARIABLES)

1. Ve a: **Deployments** (tab superior)
2. Click en el último deployment
3. Click en los 3 puntos (...) → **"Redeploy"**
4. Espera a que termine (1-2 minutos)

---

## 4. Verificación Post-Deploy (REVISAR LOGS)

Después del deploy, ve a **Logs** y busca en la consola:
- ✅ Debe decir: `[Webpay] Usando ambiente PRODUCTION con código: 5970...`
- ❌ NO debe decir: `[Webpay] Usando ambiente INTEGRATION`

Si ves "INTEGRATION", significa que las variables no se tomaron → Verifica el paso 1 y 3.

---

## 5. Prueba de $50 (TRANSBANK REQUIERE ESTO)

Según el email de Transbank, debes:

1. **Hacer una compra real de $50 en producción**
2. Usar una tarjeta de **crédito o débito real**
3. Verificar que:
   - La transacción se apruebe
   - Se guarde el pago en la base de datos
   - El ticket cambie de estado correctamente

---

## 6. Seguridad - Requerimientos de Transbank

### ✅ HTTPS Obligatorio
- [x] Tu sitio usa HTTPS (tixswap.cl) ✅
- [x] Todos los callbacks usan HTTPS ✅

### ✅ Validación de Montos (YA IMPLEMENTADO)
El código ya valida que los montos coincidan en:
- `/app/api/payments/webpay/return/route.js`

### 📋 Recomendaciones Adicionales (hacer después)
- [ ] Escaneos de vulnerabilidad cada 3 meses
- [ ] Actualizar dependencias regularmente
- [ ] Implementar WAF/IPS si es posible
- [ ] Contraseñas robustas en admin
- [ ] Backups regulares del código y DB
- [ ] Logs de auditoría para transacciones
- [ ] Auditoría externa anual

---

## 7. Página de Resultado (YA IMPLEMENTADO)

Tu página de resultado debe mostrar (verifica que ya lo haga):
- [x] Número de orden
- [x] Monto y moneda
- [x] Código de autorización
- [x] Fecha de transacción
- [x] Tipo de pago (Débito/Crédito)
- [x] Últimos 4 dígitos de tarjeta
- [x] Descripción del ticket

---

## 8. Monitoreo Post-Producción

Después de ir a producción:
1. Revisar logs diariamente la primera semana
2. Verificar que todas las transacciones se guarden correctamente
3. Probar flujos de error (tarjeta rechazada, timeout, etc.)
4. Monitorear emails de notificaciones

---

## 🚨 ROLLBACK (Si algo sale mal)

Si necesitas volver a integración:
1. En Vercel → Environment Variables
2. Cambiar `WEBPAY_ENV` de `production` a `integration`
3. Redeploy
4. Listo, volverás a usar las credenciales de prueba

---

## ✅ LISTO PARA PRODUCCIÓN

Una vez completados todos los pasos:
1. Haz la compra de $50 de prueba
2. Envía confirmación a Transbank
3. ¡Ya estás operando con dinero real! 💰
