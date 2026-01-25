# ✅ SINCRONIZACIÓN COMPLETA WEB ↔ SUPABASE

**Estado:** Implementado  
**Fecha:** 20 Enero 2026

## 🎯 OBJETIVO LOGRADO

✅ Profiles como fuente de verdad  
✅ Realtime sync (cambios en BD se reflejan al instante)  
✅ Defaults automáticos (tier='basic', user_type='standard')  
✅ RUT único validado  
✅ Campos inmutables (name, email, rut)  
✅ Phone editable  

---

## 📁 ARCHIVOS MODIFICADOS

### 1. **hooks/useProfile.js** (NUEVO)
Hook personalizado con:
- Fetch inicial del profile desde BD
- Suscripción Realtime a cambios
- Auto-actualización del estado local
- Cleanup al desmontar

### 2. **app/dashboard/page.jsx**
- Usa `useProfile()` hook
- Lee profile desde BD (no state manual)
- Actualiza UI automáticamente con Realtime
- Eliminó `booting` state
- Solo phone editable, name/email/rut read-only

### 3. **SETUP_PROFILES_SYNC.sql** (NUEVO - ejecutar en Supabase)
SQL completo para:
- Defaults en profiles
- Unique constraints (email, rut)
- Trigger robusto que sincroniza auth.users → profiles
- Validación de RUT duplicado
- Habilita Realtime en profiles

---

## 🔧 SETUP (Ejecutar UNA VEZ en Supabase)

1. Ve a **Supabase SQL Editor**
2. Copia TODO el contenido de `SETUP_PROFILES_SYNC.sql`
3. Pega y ejecuta
4. Verifica que aparezcan mensajes de "Trigger creado" y "Realtime habilitado"

---

## ✅ PRUEBAS MANUALES

### Test 1: Registro nuevo
1. Registra usuario con nombre, RUT, email, phone
2. Confirma email
3. Ve a Dashboard → "Mis datos"
4. **Esperado:** Todos los campos con datos correctos (nombre, RUT, email, phone)
5. **Esperado:** Tier = "basic", user_type = "standard" (visible en admin o queries)

### Test 2: RUT duplicado
1. Intenta registrarse con un RUT que ya existe
2. **Esperado:** Error "RUT ya registrado" sin crear usuario huérfano

### Test 3: Campos inmutables
1. Ve a Dashboard → "Mis datos"
2. Click "Editar perfil"
3. **Esperado:** Nombre, email, RUT son solo lectura
4. **Esperado:** Phone es editable
5. Cambia phone y guarda
6. **Esperado:** Phone actualizado, otros campos intactos

### Test 4: Realtime sync
1. Abre Dashboard en browser
2. En Supabase Table Editor, edita manualmente el phone del usuario
3. **Esperado:** Dashboard se actualiza solo (sin refrescar página)
4. Repite con avatar_url
5. **Esperado:** Avatar se actualiza solo

### Test 5: Mobile responsive
1. Abre en móvil o DevTools mobile view
2. Ve a "Mis datos"
3. **Esperado:** Form se ve completo, botones accesibles, no overflow

---

## 🏗️ ARQUITECTURA

```
┌──────────────┐         ┌─────────────┐
│  auth.users  │─TRIGGER→│  profiles   │
└──────────────┘         └─────────────┘
                               │
                               │ Realtime
                               ▼
                         ┌─────────────┐
                         │ useProfile()│
                         └─────────────┘
                               │
                               ▼
                         ┌─────────────┐
                         │  Dashboard  │
                         └─────────────┘
```

**Flujo:**
1. Usuario se registra → `auth.signUp()` con metadata
2. Trigger `handle_new_user()` crea fila en `profiles` automáticamente
3. Dashboard usa `useProfile()` que lee de `profiles`
4. Cualquier cambio en `profiles` → Realtime → UI actualiza

---

## 🔒 SEGURIDAD

- ✅ RUT único validado en BD (constraint + trigger)
- ✅ Email único (auth + profiles constraint)
- ✅ Campos sensibles (name, email, rut) no editables desde client
- ✅ updateProfile() solo acepta phone/avatar_url (allowlist)
- ✅ Avatar upload via route handler (no server action con File object)

---

## 🚀 DEPLOY

Cambios ya pusheados a GitHub. Vercel auto-deploya.

**Post-deploy:**
1. Ejecutar SQL en Supabase (solo primera vez)
2. Probar registro completo
3. Verificar Realtime funciona (cambio manual en DB → refleja en web)

---

## 📝 NOTAS

- **NO se tocó:** Pagos, fees, comisiones, Webpay, checkout (como pedido)
- **Realtime:** Requiere plan Pro+ de Supabase (gratis tiene límite)
- **Fallback:** Si Realtime no está disponible, el hook sigue funcionando (solo sin auto-update)

---

## 🐛 TROUBLESHOOTING

### "Profile no se crea al registrarse"
- Verificar que el SQL trigger esté ejecutado
- Revisar logs de Supabase Functions
- Verificar que signUp() envíe metadata correcta

### "Realtime no funciona"
- Verificar que `supabase_realtime` publication incluya `profiles`
- Ejecutar: `ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;`
- Verificar plan de Supabase (Free tiene límites)

### "Dashboard muestra campos vacíos"
- Abrir DevTools → Console
- Buscar errores de `useProfile`
- Verificar que el usuario tenga fila en `profiles`
- Ejecutar: `SELECT * FROM profiles WHERE id = '<user_id>';`

---

**✅ COMPLETO**
