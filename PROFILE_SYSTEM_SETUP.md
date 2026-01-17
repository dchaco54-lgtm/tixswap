# 🎯 Implementación: Sistema de Perfil Editable para TixSwap

**Fecha:** 2024  
**Características:** Avatar upload, edición de nombre, status, solicitudes de cambio de email/RUT, onboarding

---

## 📋 Resumen de Cambios

Este sistema implementa la gestión completa de perfil de usuario para preparar la integración de chat/community. Incluye:

- ✅ **Avatar Upload**: Subida a Supabase Storage con validación (2MB, JPG/PNG/WebP)
- ✅ **Edición de Nombre**: Validación 3-40 caracteres
- ✅ **Estado del Usuario**: Online/Busy/Away/Invisible
- ✅ **Solicitud de Cambio de Email/RUT**: Vía tickets de soporte con anti-duplicado
- ✅ **Onboarding Modal**: Mostrado si `profile.full_name` está vacío
- ✅ **Bloqueo de Cuenta**: Banner si `is_blocked = true`

---

## 🛠️ Pasos de Implementación

### 1️⃣ Ejecutar Migración SQL

Ve a **Supabase → SQL Editor** y ejecuta el contenido de:

```bash
MIGRATION_PROFILES.sql
```

**Qué hace:**
- Agrega columnas `avatar_url` y `status` a la tabla `profiles`
- Crea índice único parcial para RUT (evita duplicados en no-null)
- Configura constraint para validar valores de status

**Nota:** El bucket 'avatars' en Storage se debe crear manualmente desde la UI de Supabase:
1. Ve a **Storage > New Bucket**
2. Nombre: `avatars`
3. Privacy: Public (para URLs públicas)
4. Opcional: Agrega policies RLS

---

### 2️⃣ Verificar Dependencias

Asegúrate de que `lib/rutUtils.js` exista con estas funciones:
- `validateRut(rut)` - valida formato RUT
- `formatRut(rut)` - formatea RUT como "XX.XXX.XXX-K"
- `cleanRut(rut)` - elimina caracteres especiales

El archivo ya existe en el repo, no requiere cambios.

---

### 3️⃣ Configurar Variables de Entorno

Si no las tienes, asegúrate de que en `.env.local` estén:

```env
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]
```

El `SUPABASE_SERVICE_ROLE_KEY` es necesario para los server actions en `lib/profileActions.js`.

---

## 📁 Archivos Creados/Modificados

### Nuevos Archivos

| Archivo | Descripción |
|---------|-----------|
| `lib/profileActions.js` | Server actions para perfil: getCurrentProfile, updateProfile, uploadAvatar, deleteAvatar, createProfileChangeTicket, findOpenChangeTicket |
| `components/ProfileChangeModal.jsx` | Modal para solicitar cambio de email/RUT |
| `components/AvatarUploadSection.jsx` | Componente para upload y gestión de avatar |
| `components/OnboardingModal.jsx` | Modal de bienvenida para perfiles incompletos |
| `MIGRATION_PROFILES.sql` | Script SQL para migración de BD |

### Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `app/dashboard/page.jsx` | Integración de nuevos componentes, estados para edición completa, llamada a server actions |

---

## 🚀 Características Implementadas

### 1. Avatar Upload
```jsx
<AvatarUploadSection 
  currentAvatarUrl={profile?.avatar_url}
  userId={user?.id}
  onSuccess={handleAvatarSuccess}
/>
```

- Valida tamaño (max 2MB)
- Valida tipo (JPG, PNG, WebP)
- Sube a `storage/avatars/{userId}/{filename}`
- Almacena URL en `profiles.avatar_url`
- Permite eliminar avatar

### 2. Edición de Nombre
- Campo editable en modo "Editar"
- Validación 3-40 caracteres
- Mostrado en real-time durante edición

### 3. Estado del Usuario
- Dropdown con 4 opciones: Online, Busy, Away, Invisible
- Se actualiza en BD al guardar
- Mostrado con emoji (🟢 🔴 🟡 ⚫)

### 4. Solicitud de Cambio Email/RUT
```jsx
const result = await createProfileChangeTicket(field, requestedValue, reason)
```

- Abre `ProfileChangeModal` al hacer click
- Valida email/RUT
- Crea ticket en `support_tickets` con status 'abierto'
- **Anti-duplicado**: Verifica si existe ticket abierto antes de crear
- Notifica al usuario si ya hay uno pendiente

### 5. Onboarding Modal
- Se muestra en primer login si `profile.full_name` está vacío
- Explica qué completar (nombre, avatar, estado)
- Botón "Ir a mi perfil" abre editor

### 6. Bloqueo de Cuenta
- Si `is_blocked = true`, muestra banner rojo
- No impide edición, solo avisa

---

## 🔑 Server Actions Disponibles

### `getCurrentProfile()`
Obtiene perfil completo del usuario autenticado.

```javascript
const result = await getCurrentProfile();
if (result.success) {
  console.log(result.profile); // { id, full_name, email, rut, phone, role, avatar_url, status, ... }
}
```

### `updateProfile(updates)`
Actualiza nombre, email, phone, status.

```javascript
const result = await updateProfile({
  full_name: "Juan Pérez",
  email: "juan@email.com",
  phone: "+569...",
  status: "online"
});
```

**Validaciones:**
- `full_name`: 3-40 caracteres (solo si se pasa)
- `status`: debe estar en ['online', 'busy', 'away', 'invisible']
- `email`: validación básica de email

### `uploadAvatar(file, userId)`
Sube archivo a storage/avatars.

```javascript
const result = await uploadAvatar(file, userId);
if (result.success) {
  console.log(result.avatarUrl); // URL pública del avatar
}
```

**Validaciones:**
- Tamaño máximo: 2MB
- Tipos permitidos: JPG, PNG, WebP

### `deleteAvatar(userId)`
Elimina todos los avatares del usuario de storage.

```javascript
const result = await deleteAvatar(userId);
```

### `createProfileChangeTicket(field, requestedValue, reason?)`
Crea ticket de soporte para cambio de email o RUT.

```javascript
const result = await createProfileChangeTicket('email', 'newemail@example.com', 'Cambié de proveedor');
```

**Anti-duplicado:**
- Chequea si existe ticket abierto para el mismo campo
- Rechaza si ya hay uno abierto

**En BD:**
```sql
INSERT INTO support_tickets (
  category, 
  subject, 
  message, 
  requester_email, 
  requester_name, 
  requester_rut, 
  status
)
```

### `findOpenChangeTicket(field)`
Busca ticket abierto para 'email' o 'rut'.

```javascript
const result = await findOpenChangeTicket('email');
if (result.success && result.ticket) {
  console.log(result.ticket.subject); // Solicitud cambio de EMAIL - ...
}
```

---

## 🎨 UI/UX Details

### Dashboard Tab "Mis datos"
Antes de cambios:
```
┌─────────────────────────┐
│ Nombre (bloqueado)      │
│ Email (editable)        │
│ RUT (bloqueado)         │
│ Teléfono (editable)     │
│ Categoría (read-only)   │
└─────────────────────────┘
```

Después de cambios:
```
┌─────────────────────────┐
│ 🖼️ Avatar (editable)    │
│ 📝 Nombre (editable)    │
│ 📧 Email (con botón)    │
│ 🆔 RUT (con botón)      │
│ 📱 Teléfono (editable)  │
│ 🟢 Estado (editable)    │
│ 🏷️  Categoría (r/o)     │
└─────────────────────────┘
```

### Modales

**ProfileChangeModal**
- Campo para nuevo valor (email/RUT)
- Campo opcional para motivo
- Botones Cancelar/Solicitar
- Muestra errores (ej: "Ya tienes un ticket abierto")

**AvatarUploadSection**
- Preview del avatar actual
- Botón "Cambiar" para seleccionar archivo
- Botón X para eliminar
- Validación en tiempo real

**OnboardingModal**
- 3 puntos con emojis (nombre, avatar, estado)
- Botón "Ir a mi perfil"
- Texto "Puedes completar después"

---

## 🧪 Testing Checklist

### 1. Avatar Upload
- [ ] Subir JPG válido → Se muestra preview y se guarda en Storage
- [ ] Subir PNG válido → Funciona igual
- [ ] Intentar subir archivo > 2MB → Error: "debe pesar menos de 2MB"
- [ ] Intentar subir PDF → Error: "Solo se permiten JPG, PNG o WebP"
- [ ] Eliminar avatar → Se borra de Storage y se actualiza perfil

### 2. Edición de Nombre
- [ ] Editar nombre a "Ana" (3 caracteres) → Guardarse
- [ ] Editar nombre a "X" (1 carácter) → Error: "entre 3 y 40"
- [ ] Editar nombre a 40 caracteres exactos → Guardarse
- [ ] Editar nombre a 41 caracteres → Error: "entre 3 y 40"

### 3. Estado del Usuario
- [ ] Cambiar a "Ocupado" → Se guarda y muestra 🔴
- [ ] Cambiar a "Ausente" → Se guarda y muestra 🟡
- [ ] Cambiar a "Invisible" → Se guarda y muestra ⚫
- [ ] Recargar página → Se mantiene el estado

### 4. Solicitud de Cambio Email
- [ ] Click en "Cambiar" → Abre modal
- [ ] Ingresar email válido → Crear ticket OK
- [ ] Intentar crear otro ticket para email → Error: "Ya tienes un ticket abierto"
- [ ] Verificar en `support_tickets` → status = 'abierto', category = 'cambio_datos'

### 5. Solicitud de Cambio RUT
- [ ] Click en "Cambiar" para RUT → Abre modal
- [ ] Ingresar RUT válido → Crear ticket OK
- [ ] El ticket aparece en banner → "Tienes una solicitud pendiente"

### 6. Onboarding
- [ ] Crear nuevo usuario sin nombre en auth → Entra a dashboard
- [ ] Modal aparece automáticamente
- [ ] Click en "Ir a mi perfil" → Abre modo edición
- [ ] Completar nombre y guardar → Modal desaparece

### 7. Bloqueo de Cuenta
- [ ] Actualizar en BD: `UPDATE profiles SET is_blocked = true WHERE id = '...'`
- [ ] Recargar dashboard → Aparece banner rojo 🚫

---

## ⚠️ Notas Importantes

### Seguridad

1. **Service Role Key**: `lib/profileActions.js` usa `SUPABASE_SERVICE_ROLE_KEY`. Asegúrate de que:
   - No esté expuesta en el cliente
   - Solo se use en server actions
   - Las variables de entorno estén configuradas en Vercel/Netlify

2. **RLS Policies**: Para bucket 'avatars', recomendado:
   ```sql
   CREATE POLICY "Users can upload to their folder"
   ON storage.objects
   FOR INSERT
   USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);
   ```

3. **Email Update**: Si cambias email en `profiles`, también se actualiza en `auth.users`. Supabase puede pedir confirmación.

### Base de Datos

1. **Índice RUT**: El índice `profiles_rut_unique_not_null` permite NULL duplicados pero evita duplicados reales:
   ```sql
   CREATE UNIQUE INDEX profiles_rut_unique_not_null ON public.profiles (rut) WHERE rut IS NOT NULL;
   ```

2. **Status Check**: La constraint `CHECK (status IN (...))` valida solo valores permitidos

3. **Avatar URL**: Es nullable (`TEXT NULL`), así que usuarios sin avatar es válido

### Flujo Email/RUT

1. Usuario hace click en "Cambiar" email/RUT
2. Se abre modal `ProfileChangeModal`
3. Ingresa nuevo valor + razón (opcional)
4. Click en "Solicitar cambio"
5. Server action `createProfileChangeTicket`:
   - Valida que no exista ticket abierto
   - Crea registro en `support_tickets`
   - Retorna error si ya existe
6. Modal se cierra y muestra mensaje ✅
7. Admin revisa ticket y actualiza manualmente la BD

---

## 🔄 Próximos Pasos (no incluidos en esta implementación)

1. **Chat privado**: Integrar la vista de avatars/status en conversaciones
2. **Notificaciones**: Avisar cuando email/RUT cambien (admin lo aprobó)
3. **Tier Sync**: Mostrar tier actual en perfil (ya existe en DB)
4. **Profile Badges**: Mostrar trust signals + tier en perfil público
5. **Search**: Búsqueda de usuarios por nombre (para invitar a chat)

---

## 📞 Soporte

Si algo no funciona:

1. Chequea que la migración SQL se ejecutó sin errores
2. Verifica que el bucket 'avatars' existe en Storage
3. Revisa console.log en browser para errores de red
4. Chequea Supabase logs para errores de BD

---

**Implementación completada:** ✅ Todos los archivos están listos para usar.
