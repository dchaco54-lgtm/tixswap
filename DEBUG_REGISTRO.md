# 🔧 CHECKLIST - DEBUG REGISTRO

## ❌ Error: "Database error saving new user"

### Causas posibles (en orden de probabilidad):

1. **SQL NO ejecutado en Supabase** ⚠️ MÁS PROBABLE
2. Teléfono con formato incorrecto en BD
3. RUT con formato incorrecto en BD
4. Tabla `profiles` no existe
5. Permisos del trigger insuficientes

---

## ✅ PASO 1: VERIFICAR SI EL SQL FUE EJECUTADO

Ve a tu **Supabase SQL Editor** y ejecuta:

```sql
-- Verificar que el trigger existe
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
-- Debe devolver: on_auth_user_created

-- Verificar que la tabla profiles tiene los índices
\d profiles;
-- Debe mostrar:
-- - profiles_email_unique
-- - profiles_rut_unique
```

**Si NO aparece nada:** El SQL NO se ejecutó. Ve al paso 2.

---

## 📝 PASO 2: EJECUTAR EL SQL

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Abre **SQL Editor**
4. Haz click en **New query**
5. **Copia TODO** el contenido de [SETUP_PROFILES_SYNC.sql](../SETUP_PROFILES_SYNC.sql)
6. **Pega** en el editor
7. Haz click **Run** (o Ctrl+Enter)

**Espera a que aparezca:**
```
NOTICE:  Trigger creado correctamente
NOTICE:  Realtime habilitado en profiles
```

---

## 🧪 PASO 3: VERIFICAR DATOS EN PROFILES

Después de ejecutar el SQL, ejecuta:

```sql
SELECT * FROM profiles LIMIT 5;
```

**Debe mostrar:**
- Columnas: id, email, full_name, rut, phone, user_type, seller_tier, created_at
- user_type = 'standard' (default)
- seller_tier = 'basic' (default)

---

## 📞 PASO 4: VERIFICAR FORMATO TELÉFONO

Si aún hay error después de ejecutar SQL, verifica que el teléfono se guarda correctamente:

```sql
SELECT email, phone, length(phone) FROM profiles WHERE phone IS NOT NULL LIMIT 5;
```

**Debe mostrar:**
```
email              | phone           | length
soporte@tixswap.cl | +56963528995    | 12
```

**Si ves:**
- `+56 963528995` (CON ESPACIOS) → ❌ Error en código
- `963528995` (SIN +56) → ❌ Error en normalización
- `NULL` → ❌ El teléfono no se guardó

---

## 🆘 SI SIGUE FALLANDO

### Check 1: Revisar logs del trigger

```sql
-- Ver últimos usuarios creados
SELECT 
  id, 
  email, 
  created_at,
  raw_user_meta_data
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;
```

### Check 2: Revisar errores específicos

En Supabase Dashboard:
1. **Logs** → Ver errores de función
2. **Database** → Revisar que `profiles` tenga las columnas correctas

### Check 3: Re-ejecutar SQL

A veces Supabase necesita que re-ejecutes el SQL:
1. Abre SQL Editor
2. Copia y pega **TODO** SETUP_PROFILES_SYNC.sql
3. Haz click **Run**

---

## ✅ SOLUCIÓN RÁPIDA

Si todo falla:

1. Borra el trigger:
```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
```

2. Re-ejecuta **TODO** SETUP_PROFILES_SYNC.sql

3. Intenta crear cuenta de nuevo

---

## 📊 CHECKLIST DE EJECUCIÓN

- [ ] SQL ejecutado en Supabase
- [ ] Trigger `on_auth_user_created` existe
- [ ] Tabla `profiles` tiene 8 columnas
- [ ] Índices únicos existen en email y rut
- [ ] Realtime habilitado en profiles
- [ ] Puedo ver datos en profiles
- [ ] Teléfono guardado sin espacios (E.164)

---

## 💬 REPORTE DE ERROR

Si aún falla, copia esto:

```
1. Error exacto: [copiar el mensaje del error]
2. ¿Se ejecutó el SQL? [sí/no]
3. ¿Qué viste en `SELECT * FROM profiles`? [vacío/datos]
4. ¿El trigger existe? [sí/no - verificar con SQL]
```

---

**Lo más probable:** No ejecutaste el SQL en Supabase. Hazlo ahora y trata de registrar de nuevo. 🚀
