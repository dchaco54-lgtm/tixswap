# 🔧 Solución del Loop de Autenticación - Implementación Completa

## 📋 Problema Identificado

### Causa Raíz: Mismatch localStorage vs Cookies

**Antes (BUG):**
- `middleware.js` → Usa `@supabase/auth-helpers-nextjs` con **cookies**
- `lib/supabaseClient.js` → Usa `@supabase/supabase-js` con **localStorage**

**Resultado:**
1. Usuario confirma correo → sesión se guarda en localStorage
2. Middleware lee cookies → NO encuentra sesión
3. Middleware redirige a `/login`
4. Cliente lee localStorage → "hay sesión" → intenta ir a `/dashboard`
5. **LOOP INFINITO** 🔄

---

## ✅ Solución Implementada

### Migración Completa a Auth por Cookies

Toda la aplicación ahora usa `@supabase/auth-helpers-nextjs` con cookies, consistente con el middleware.

---

## 📁 Archivos Modificados/Creados

### Nuevos Archivos

1. **`lib/supabase/client.js`** - Cliente para Client Components
   ```javascript
   import { createClient } from '@/lib/supabase/client'
   const supabase = createClient()
   ```

2. **`lib/supabase/server.js`** - Cliente para Server/Route Handlers
   ```javascript
   import { createClient } from '@/lib/supabase/server'
   import { cookies } from 'next/headers'
   const supabase = createClient(cookies())
   ```

3. **`app/auth/callback/route.js`** - Route Handler PKCE
   - Intercambia código por sesión
   - Establece cookies automáticamente
   - Maneja errores y redirects

4. **`MIGRATION_ONBOARDING.sql`** - Campos para onboarding
   - `onboarding_done`
   - `onboarding_skipped_at`
   - `onboarding_completed_at`

5. **`lib/supabaseClient.js`** - Wrapper de compatibilidad
   - Mantiene API antigua
   - Usa nuevo cliente internamente
   - Permite migración gradual

### Archivos Modificados

1. **`app/register/page.jsx`**
   - ✅ Usa `createClient()` de auth-helpers
   - ✅ `emailRedirectTo` apunta a `/auth/callback?redirectTo=/dashboard`
   - ✅ PKCE habilitado por defecto

2. **`app/login/page.jsx`**
   - ✅ Usa `createClient()` de auth-helpers
   - ✅ Verifica sesión con cookies
   - ✅ Muestra errores del callback
   - ✅ Timeout de 3s para evitar UI pegada

3. **`lib/supabaseClient.legacy.js`** (renombrado)
   - Cliente antiguo preservado para referencia

---

## 🚀 Flujo de Confirmación (Nuevo)

### Registro → Confirmación → Dashboard

1. **Usuario se registra** (`/register`)
   ```javascript
   supabase.auth.signUp({
     email, password,
     options: {
       emailRedirectTo: 'https://www.tixswap.cl/auth/callback?redirectTo=/dashboard'
     }
   })
   ```

2. **Recibe correo** con link:
   ```
   https://www.tixswap.cl/auth/callback?code=xxx&redirectTo=/dashboard
   ```

3. **Route Handler** (`/auth/callback/route.js`)
   ```javascript
   const { data, error } = await supabase.auth.exchangeCodeForSession(code);
   // ✅ Sesión en cookies
   // ✅ Redirect a /dashboard
   ```

4. **Middleware** (`middleware.js`)
   ```javascript
   const { data: { session } } = await supabase.auth.getSession();
   // ✅ Lee cookies → encuentra sesión
   // ✅ Permite acceso a /dashboard
   ```

5. **Dashboard** carga normalmente ✅

---

## 🧪 Testing Manual

### Prerequisitos

1. **Verificar Supabase Dashboard** → Authentication → URL Configuration:
   - **Site URL**: `https://www.tixswap.cl`
   - **Redirect URLs** (separados por coma):
     ```
     https://www.tixswap.cl/auth/callback,
     http://localhost:3000/auth/callback
     ```

2. **Verificar Authentication → Email Templates**:
   - Template "Confirm signup" debe tener link a:
     ```
     {{ .SiteURL }}/auth/callback?code={{ .TokenHash }}
     ```

### Flujo de Testing

#### ✅ Caso 1: Registro Nuevo

1. Ir a `/register`
2. Completar formulario y enviar
3. Ver mensaje "Debes confirmar tu correo"
4. Abrir email recibido
5. Hacer clic en "Confirmar mi cuenta"
6. **Resultado esperado:**
   - Redirige a `/auth/callback?code=xxx`
   - Procesa en ~1-2 segundos
   - Redirige a `/dashboard?confirmed=true`
   - **NO debe haber loop**
   - **NO debe quedar en "Confirmando..."**

#### ✅ Caso 2: Login con Cuenta Confirmada

1. Ir a `/login`
2. Ingresar email y contraseña
3. **Resultado esperado:**
   - Login exitoso
   - Redirige a `/dashboard`
   - Sesión persiste en cookies
   - Reload no pide login nuevamente

#### ✅ Caso 3: Login con Cuenta NO Confirmada

1. Ir a `/login`
2. Ingresar email de cuenta sin confirmar
3. **Resultado esperado:**
   - Error: "Debes confirmar tu correo..."
   - Mostrar link a reenviar confirmación (si existe)

#### ❌ Caso 4: Link Expirado/Inválido

1. Usar link de confirmación viejo o inválido
2. **Resultado esperado:**
   - Redirige a `/login?error=no_code&message=...`
   - Mostrar mensaje de error claro
   - Opción de ir a login o registro

### Debugging en Browser

```javascript
// En consola del navegador (mientras estés logueado):

// 1. Ver sesión actual
const { data, error } = await (await fetch('/api/auth/session')).json();
console.log('Sesión:', data);

// 2. Ver cookies de Supabase
document.cookie.split(';').filter(c => c.includes('supabase'));

// 3. Verificar localStorage (debe estar vacío de sesiones)
Object.keys(localStorage).filter(k => k.includes('supabase'));
```

---

## 🐛 Troubleshooting

### Loop Infinito Persiste

**Síntomas:**
- Página recarga constantemente
- Navega entre `/login` y `/dashboard`

**Solución:**
```bash
# 1. Limpiar caché del navegador
# 2. Borrar todas las cookies de tixswap.cl
# 3. Borrar localStorage
# 4. Recargar página

# O ejecutar en consola:
localStorage.clear();
document.cookie.split(';').forEach(c => {
  document.cookie = c.split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/';
});
location.reload();
```

### "Confirmando tu correo..." Infinito

**Posibles causas:**
1. Link de confirmación inválido/expirado
2. Error en `exchangeCodeForSession`
3. Redirect URL no configurado en Supabase

**Solución:**
```bash
# 1. Verificar logs en Network tab (DevTools)
# 2. Buscar llamada a /auth/callback
# 3. Ver respuesta (debería ser 302 redirect)

# 4. Verificar Supabase Dashboard:
# Authentication > URL Configuration > Redirect URLs
```

### Sesión No Persiste Después de Login

**Posibles causas:**
1. Cookies bloqueadas
2. SameSite=Strict en producción
3. Dominio incorrecto

**Solución:**
```javascript
// En app/auth/callback/route.js, verificar:
console.log('[Callback] Cookies set:', cookies().getAll());

// Si está vacío, revisar configuración de Next.js
```

---

## 📊 Checklist de Deployment

### Antes de Deploy

- [ ] Ejecutar `MIGRATION_ONBOARDING.sql` en Supabase SQL Editor
- [ ] Verificar env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Commit y push de todos los archivos modificados

### En Supabase Dashboard

- [ ] **Authentication → URL Configuration**
  - Site URL: `https://www.tixswap.cl`
  - Redirect URLs:
    ```
    https://www.tixswap.cl/auth/callback,
    http://localhost:3000/auth/callback
    ```

- [ ] **Authentication → Email Templates**
  - "Confirm signup" template debe usar:
    ```html
    <a href="{{ .SiteURL }}/auth/callback?code={{ .TokenHash }}">
      Confirmar mi cuenta
    </a>
    ```

- [ ] **Authentication → Providers → Email**
  - ✅ Confirm email: Enabled
  - ✅ Secure email change: Enabled (opcional)

### Post-Deploy

- [ ] Testing en producción:
  - Registro nuevo
  - Confirmación de email
  - Login
  - Logout
- [ ] Verificar que NO hay loops
- [ ] Verificar que sesión persiste
- [ ] Testing en móvil (Safari, Chrome)

---

## 🔒 Seguridad

### PKCE (Proof Key for Code Exchange)

**Por qué es importante:**
- Previene ataques de intercepción de código
- Más seguro que implicit flow
- Requerido para apps móviles/SPAs modernas

**Implementación:**
1. `auth-helpers` habilita PKCE por defecto
2. `exchangeCodeForSession` valida el code_verifier
3. Sesión solo se establece si el intercambio es válido

### Cookies vs localStorage

**Cookies (nuevo):**
- ✅ HTTPOnly posible (más seguro)
- ✅ SameSite protection
- ✅ Expira automáticamente
- ✅ Funciona con SSR/middleware

**localStorage (antiguo):**
- ❌ Vulnerable a XSS
- ❌ No funciona en SSR
- ❌ No expira automáticamente
- ❌ Inconsistente con middleware

---

## 📈 Mejoras Futuras (Opcionales)

### 1. Migración Completa de Archivos Restantes

**Archivos que aún usan `lib/supabaseClient.js` (wrapper):**
- `app/dashboard/page.jsx`
- `app/sell/page.jsx`
- `hooks/useProfile.js`
- Y ~20 más

**Plan de migración:**
1. Actualizar imports a `@/lib/supabase/client`
2. Verificar que no hay cambios de comportamiento
3. Eliminar `lib/supabaseClient.js` wrapper

### 2. Onboarding Modal en Dashboard

**Ya implementado parcialmente:**
- `components/OnboardingModal.jsx`
- `components/DashboardTour.jsx`

**Falta integrar:**
- Leer `onboarding_done` de profiles
- Mostrar modal solo si `onboarding_done = false`
- Actualizar campo al completar/saltar

### 3. Manejo de Email No Confirmado

**Implementar en `/login`:**
```javascript
if (error.message.includes('email not confirmed')) {
  // Mostrar opción de reenviar confirmación
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: form.email
  });
}
```

### 4. Refresh Token Automático

**Ya implementado por auth-helpers:**
- `autoRefreshToken: true` por defecto
- Refresh silencioso antes de expirar
- No requiere intervención manual

---

## 📞 Soporte

### Logs de Debugging

**Server-side (Route Handler):**
```javascript
console.log('[Auth Callback] Code:', code);
console.log('[Auth Callback] Exchange result:', data);
```

**Client-side (Browser):**
```javascript
console.log('[Login] Session check:', session);
console.log('[Register] SignUp result:', data);
```

### Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `invalid_code` | Código expirado/usado | Usuario debe registrarse nuevamente |
| `email not confirmed` | Email sin verificar | Mostrar opción de reenviar |
| `session not found` | Cookies bloqueadas | Verificar configuración browser |
| Loop infinito | localStorage/cookies mismatch | Ejecutar `localStorage.clear()` |

---

## ✅ Resumen de Cambios

### Arquitectura

**Antes:**
```
Usuario → localStorage → ❌ Middleware (cookies) → Loop
```

**Después:**
```
Usuario → Cookies → ✅ Middleware (cookies) → Dashboard
```

### Flujo de Confirmación

**Antes:**
```
Email → Implicit flow → localStorage → ❌ Middleware no ve sesión → Loop
```

**Después:**
```
Email → PKCE code → Route Handler → exchangeCodeForSession → Cookies → ✅ Middleware ve sesión → Dashboard
```

---

**Implementado por:** GitHub Copilot (Claude Sonnet 4.5)  
**Fecha:** Enero 2026  
**Stack:** Next.js 14 + Supabase + Auth Helpers
