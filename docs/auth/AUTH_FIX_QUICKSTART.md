# 🔧 Auth Loop Fix - Quick Reference

## 🐛 El Problema

**Causa:** Middleware usa **cookies**, cliente usaba **localStorage** → Sesión no sincronizada → Loop infinito

**Síntoma:** Después de confirmar email, usuario queda atrapado entre `/login` y `/dashboard`

---

## ✅ La Solución

Migración completa a **auth por cookies** usando `@supabase/auth-helpers-nextjs`

---

## 📁 Archivos Modificados

### Nuevos
- ✨ `lib/supabase/client.js` - Cliente para components
- ✨ `lib/supabase/server.js` - Cliente para server/routes  
- ✨ `app/auth/callback/route.js` - Route handler PKCE
- ✨ `MIGRATION_ONBOARDING.sql` - Campos onboarding
- ✨ `AUTH_FIX_DOCUMENTATION.md` - Docs completos

### Modificados
- 🔧 `app/register/page.jsx` - Usa auth-helpers + PKCE
- 🔧 `app/login/page.jsx` - Usa auth-helpers + manejo errores
- 🔧 `lib/supabaseClient.js` - Wrapper de compatibilidad

### Renombrados
- 📦 `lib/supabaseClient.legacy.js` - Cliente antiguo (preservado)

---

## 🚀 Configuración Supabase Dashboard

### 1. Authentication → URL Configuration

```
Site URL: https://www.tixswap.cl

Redirect URLs:
https://www.tixswap.cl/auth/callback
http://localhost:3000/auth/callback
```

### 2. Authentication → Email Templates → "Confirm signup"

**Verificar que el link sea:**
```html
<a href="{{ .SiteURL }}/auth/callback?code={{ .TokenHash }}">
  Confirmar mi cuenta
</a>
```

**NO debe ser:**
```html
<a href="{{ .SiteURL }}/login?token_hash={{ .TokenHash }}">  ❌ INCORRECTO
```

---

## 🧪 Testing Rápido

### Flujo Completo
1. Ir a `/register` → Completar formulario
2. Recibir email → Click "Confirmar mi cuenta"
3. **Resultado:** Debe ir a `/dashboard` SIN loop
4. Reload → Debe seguir logueado

### Verificar en Browser Console
```javascript
// Ver sesión actual
const { data } = await supabase.auth.getSession();
console.log(data.session); // Debe existir

// Ver cookies (deben existir)
document.cookie.split(';').filter(c => c.includes('supabase'));

// localStorage debe estar VACÍO de sesiones
Object.keys(localStorage).filter(k => k.includes('auth'));
```

---

## 🐛 Troubleshooting

### Loop Persiste
```javascript
// Limpiar TODO
localStorage.clear();
document.cookie.split(';').forEach(c => {
  document.cookie = c.split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/';
});
location.reload();
```

### "Confirmando..." Infinito
1. Verificar Network tab → `/auth/callback` debe dar 302
2. Verificar Redirect URLs en Supabase Dashboard
3. Verificar que email template use el link correcto

---

## 📊 Checklist Pre-Deploy

- [ ] Ejecutar `MIGRATION_ONBOARDING.sql` en Supabase
- [ ] Verificar Redirect URLs en Supabase Dashboard
- [ ] Verificar Email Templates
- [ ] Commit y push todos los cambios
- [ ] Testing en localhost
- [ ] Deploy a staging/producción
- [ ] Testing en producción

---

## 📖 Docs Completos

👉 Ver [AUTH_FIX_DOCUMENTATION.md](AUTH_FIX_DOCUMENTATION.md) para:
- Explicación técnica detallada
- Flujos completos
- Casos edge
- Mejoras futuras
- Debugging avanzado

---

**Implementado:** Enero 2026  
**Stack:** Next.js 14 + Supabase Auth Helpers
