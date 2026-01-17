# 🚀 Quick Start: Profile System

## ¿Qué se implementó?

Un sistema completo de gestión de perfil de usuario en `/app/dashboard/page.jsx` con:

- ✅ Avatar upload a Storage
- ✅ Edición de nombre, email, teléfono, estado
- ✅ Solicitud de cambio para email/RUT (via tickets)
- ✅ Modal onboarding para perfiles incompletos
- ✅ Anti-duplicado en solicitudes

---

## ⚡ Setup (5 minutos)

### 1. SQL Migration
Copia el contenido de `MIGRATION_PROFILES.sql` y ejecuta en **Supabase → SQL Editor**:
- Agrega columnas `avatar_url`, `status`
- Crea índice RUT
- ✅ Listo

### 2. Crear Bucket 'avatars'
En **Supabase → Storage**:
1. Click "New Bucket"
2. Nombre: `avatars`
3. Privacy: Public
4. ✅ Listo

### 3. Env Variables
Asegúrate que `.env.local` tiene:
```env
SUPABASE_SERVICE_ROLE_KEY=[TU_KEY]
```

### 4. Ya listo! 🎉

---

## 🛠️ Usar en Código

### Obtener perfil actual
```javascript
import { getCurrentProfile } from '@/lib/profileActions';

const result = await getCurrentProfile();
// result.profile = { id, full_name, email, avatar_url, status, ... }
```

### Actualizar perfil
```javascript
import { updateProfile } from '@/lib/profileActions';

const result = await updateProfile({
  full_name: "Juan Pérez",
  status: "online"
});
```

### Subir avatar
```javascript
import { uploadAvatar } from '@/lib/profileActions';

const result = await uploadAvatar(file, userId);
// result.avatarUrl = URL pública del avatar
```

### Crear ticket de cambio
```javascript
import { createProfileChangeTicket } from '@/lib/profileActions';

const result = await createProfileChangeTicket('email', 'new@email.com', 'Motivo');
// Crea registro en support_tickets con status 'abierto'
```

---

## 🎨 Componentes Disponibles

### ProfileChangeModal
Modal para solicitar cambio de email/RUT:
```jsx
<ProfileChangeModal
  field="email" // 'email' | 'rut'
  currentValue={profile.email}
  onClose={() => setShowModal(false)}
  onSuccess={() => console.log('Ticket creado')}
/>
```

### AvatarUploadSection
Upload de avatar con preview:
```jsx
<AvatarUploadSection
  currentAvatarUrl={profile?.avatar_url}
  userId={user?.id}
  onSuccess={(url) => console.log('Avatar actualizado:', url)}
/>
```

### OnboardingModal
Modal de bienvenida:
```jsx
<OnboardingModal
  onComplete={() => console.log('Listo!')}
/>
```

---

## 📊 Estados en BD

### profiles
```
avatar_url    TEXT NULL        // URL pública del avatar
status        TEXT DEFAULT 'online'  // 'online' | 'busy' | 'away' | 'invisible'
full_name     TEXT            // 3-40 caracteres
email         TEXT            // único
rut           TEXT            // único si no null
is_blocked    BOOLEAN         // bloquea acceso
```

### support_tickets
```
category      'cambio_datos'
subject       'Solicitud cambio de EMAIL - nuevo@email.com'
message       'Solicito cambiar mi email a: ...'
status        'abierto'       // se completa manualmente
requester_*   nombre, email, rut
```

---

## 🧪 Test Rápido

1. Login a dashboard
2. Ir a "Mi perfil"
3. Click "Editar"
4. Cambiar nombre → Guardar
5. Click "Cambiar" en email → Modal
6. Ingresar nuevo email → Solicitar
7. Ver que aparece ticket en `support_tickets` table

---

## ⚠️ Gotchas

1. **Avatar no aparece**: Chequea que bucket 'avatars' sea PUBLIC
2. **Email/RUT cambio muestra error**: Verifica que `support_tickets` existe
3. **Onboarding no muestra**: User debe tener `full_name = null` o `''`
4. **Validation fails**: Chequea que `lib/rutUtils.js` tiene las funciones

---

## 📁 Archivos

```
lib/
  profileActions.js              ← Server actions

components/
  ProfileChangeModal.jsx         ← Modal email/rut
  AvatarUploadSection.jsx        ← Upload avatar
  OnboardingModal.jsx            ← Welcome modal

app/dashboard/
  page.jsx                       ← Modificado con todo integrado

MIGRATION_PROFILES.sql           ← SQL para ejecutar
PROFILE_SYSTEM_SETUP.md          ← Doc completa
PROFILE_SYSTEM_QUICK_START.md    ← Esta doc
```

---

## 🎯 Next Steps

Para integración con chat:

1. Mostrar avatars en lista de chats
2. Mostrar status (🟢 🔴 🟡) en conversaciones
3. Notificar cuando user cambia status

---

✅ Todo listo. ¡Enjoy! 🚀
