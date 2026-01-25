# 🚀 CHECKLIST DEPLOYMENT PROFILE SYNC

## ✅ COMPLETADO (Código)

- [x] Hook `useProfile()` con Realtime creado
- [x] Dashboard integrado con hook
- [x] SQL setup completo ([SETUP_PROFILES_SYNC.sql](SETUP_PROFILES_SYNC.sql))
- [x] Avatar upload via FormData API route
- [x] RUT validation server-side
- [x] Campos inmutables (name/email/rut)
- [x] Solo phone editable desde cliente
- [x] Código pusheado a GitHub
- [x] Documentación completa ([SYNC_IMPLEMENTATION.md](SYNC_IMPLEMENTATION.md))

---

## 🔄 PENDIENTE (Acción manual)

### 1. **Ejecutar SQL en Supabase** ⚠️ CRÍTICO

```bash
# Abrir: https://supabase.com/dashboard/project/{tu-proyecto}/sql/new
# Copiar TODO el contenido de SETUP_PROFILES_SYNC.sql
# Pegar y ejecutar

# Verificar:
SELECT * FROM profiles LIMIT 1;  -- Debe tener defaults
\d profiles;                      -- Debe mostrar constraints únicos
```

**Resultado esperado:**
```
NOTICE:  Defaults aplicados
NOTICE:  Trigger creado correctamente
NOTICE:  Realtime habilitado en profiles
```

### 2. **Verificar Deployment en Vercel**

```bash
# Ir a: https://vercel.com/dashboard
# Ver último deploy (debe incluir commit 180cd92)
# Estado: ✅ Ready
```

### 3. **Testing Manual**

#### Test A: Registro completo
- [ ] Registrar usuario nuevo con todos los campos
- [ ] Confirmar email
- [ ] Login y verificar Dashboard muestra datos correctos
- [ ] Verificar en Supabase que profile tiene `tier='basic'` y `user_type='standard'`

#### Test B: RUT duplicado
- [ ] Intentar registrar con RUT existente
- [ ] Debe mostrar error: "RUT ya registrado"
- [ ] Verificar que NO se creó usuario en `auth.users` (no huérfano)

#### Test C: Realtime sync
- [ ] Abrir Dashboard en browser
- [ ] En Supabase Table Editor, cambiar `phone` del usuario
- [ ] **SIN REFRESCAR**, verificar que Dashboard actualiza solo
- [ ] Repetir con `avatar_url`

#### Test D: Campos inmutables
- [ ] Click "Editar perfil" en Dashboard
- [ ] Verificar: Nombre, Email, RUT son solo lectura (disabled o readonly)
- [ ] Verificar: Phone es editable
- [ ] Cambiar phone y guardar
- [ ] Verificar que solo phone cambió, otros campos intactos

#### Test E: Avatar upload
- [ ] Subir avatar (JPG, PNG, WebP, cualquier imagen <2MB)
- [ ] Verificar: No error "Server Actions"
- [ ] Verificar: Imagen se sube a Storage bucket `avatars/`
- [ ] Verificar: Profile actualiza con nueva URL
- [ ] Verificar: UI muestra nueva imagen sin refresh (Realtime)

---

## 🔍 TROUBLESHOOTING RÁPIDO

### "Profile no aparece después de registro"
```sql
-- Verificar trigger existe:
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Verificar profiles tiene datos:
SELECT id, email, full_name, seller_tier, user_type 
FROM profiles 
WHERE email = 'usuario@test.com';

-- Si está vacío, ejecutar SQL de nuevo
```

### "Realtime no funciona"
```sql
-- Verificar publicación:
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'profiles';

-- Si no aparece:
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
```

### "Avatar upload error"
- Verificar Storage bucket `avatars` existe
- Verificar políticas RLS permiten upload
- Ver DevTools Console para error específico

---

## 📋 RESUMEN EJECUTIVO

**Estado actual:** ✅ Código completo, deploy automático en proceso  
**Acción requerida:** Ejecutar SQL una vez en Supabase  
**Testing:** Manual post-SQL (15 min)  
**Blocker:** Ninguno (SQL es idempotente, se puede re-ejecutar)  

**Próximos pasos:**
1. Ejecutar SQL ahora (5 min)
2. Verificar deploy en Vercel (auto)
3. Testing manual (10 min)
4. Producción

---

**Contacto:** Si algo falla, revisar [SYNC_IMPLEMENTATION.md](SYNC_IMPLEMENTATION.md) sección Troubleshooting
