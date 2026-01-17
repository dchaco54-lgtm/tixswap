# 🔧 Troubleshooting: Profile System

## ❌ Problemas Comunes

### 1. "Error: SUPABASE_SERVICE_ROLE_KEY not found"

**Causa**: Variable de entorno no configurada

**Solución**:
1. En `.env.local`, agrega:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...
   ```
2. Reinicia servidor dev: `npm run dev`

**Dónde obtener la key**:
- Supabase → Settings → API → Service Role Key
- ⚠️ NO la expongas en público

---

### 2. Avatar upload falla con "403 Forbidden"

**Causa**: Bucket 'avatars' no es público o policies están mal

**Solución**:

#### Opción A: Bucket público (recomendado para avatars)
1. Ve a **Supabase → Storage → avatars**
2. Click en configuración (⚙️)
3. Change privacy to **Public**
4. Guarda

#### Opción B: Policies RLS (si quieres más control)
```sql
CREATE POLICY "Users upload to their folder"
ON storage.objects
FOR INSERT
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');
```

---

### 3. "La columna avatar_url no existe"

**Causa**: Migración SQL no se ejecutó

**Solución**:
1. Abre **Supabase → SQL Editor**
2. Copia contenido de `MIGRATION_PROFILES.sql`
3. Ejecuta con el botón ▶️
4. Verifica en **Table Editor → profiles** que tienes `avatar_url` y `status`

**Si sigue fallando**:
```sql
-- Ejecuta esto manualmente
ALTER TABLE public.profiles ADD COLUMN avatar_url text null;
ALTER TABLE public.profiles ADD COLUMN status text not null default 'online' check (status in ('online','busy','away','invisible'));
```

---

### 4. Modal onboarding no aparece en primer login

**Causa**: User ya tiene `full_name` asignado

**Solución**:
1. Ve a **Supabase → Table Editor → profiles**
2. Busca tu user
3. Edita `full_name` → bórralo (déjalo vacío)
4. Guarda
5. Recarga dashboard → Modal aparece

---

### 5. Email/RUT cambio crea error "Ya existe ticket abierto"

**Esto es intencional** (anti-duplicado). Si quieres permitir duplicados:

1. Abre `lib/profileActions.js`
2. En `createProfileChangeTicket()`, comenta esta sección:
   ```javascript
   // COMENTAR ESTAS LÍNEAS para permitir múltiples tickets:
   // if (checkError?.code !== 'PGRST116' && !checkError) {
   //   return { 
   //     success: false, 
   //     error: `Ya tienes un ticket abierto...`
   //   };
   // }
   ```

**Pero NO lo recomiendo** - es mejor tener un único ticket abierto por cambio.

---

### 6. "support_tickets table doesn't exist"

**Causa**: Tabla no creada o nombre diferente

**Solución**:

1. Verifica en **Supabase → Table Editor** que existe `support_tickets`
2. Si no existe, créala:
   ```sql
   CREATE TABLE public.support_tickets (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     category text NOT NULL,
     subject text NOT NULL,
     message text,
     status text DEFAULT 'abierto',
     requester_email text,
     requester_name text,
     requester_rut text,
     created_at timestamp DEFAULT now(),
     updated_at timestamp DEFAULT now()
   );
   ```

3. Si el nombre es diferente, actualiza en `lib/profileActions.js`:
   ```javascript
   // Cambiar 'support_tickets' por tu nombre real
   const { data } = await supabase
     .from('tu_tabla_de_tickets') // ← aquí
     .insert([...])
   ```

---

### 7. Avatar se sube pero no se muestra

**Causa**: URL no es accesible públicamente

**Solución**:

1. Verifica que bucket es PUBLIC (ver #2)
2. Chequea que la URL tiene este formato:
   ```
   https://[PROJECT].supabase.co/storage/v1/object/public/avatars/[USER_ID]/[FILENAME]
   ```
3. Abre la URL en navegador → Debe mostrar imagen

Si sigue sin funcionar:

```javascript
// En lib/profileActions.js, durante upload:
console.log('Avatar URL:', publicUrl); // Verifica que es correcto
```

---

### 8. Estado no se actualiza al cambiar select

**Causa**: Estado no se está guardando

**Solución**:

1. Abre DevTools → Console
2. Verifica que no hay errores al hacer click en "Guardar"
3. Chequea que `lib/profileActions.js` se importó correctamente:
   ```javascript
   import { updateProfile } from '@/lib/profileActions';
   ```
4. Si sigue, agrega logs:
   ```javascript
   const result = await updateProfile({ status: draftStatus });
   console.log('Update result:', result);
   ```

---

### 9. "RUT no se puede editar" - mensaje confuso

**Causa**: UX - el campo no se muestra en modo edición

**Solución**: Esto es intencional. Si quieres permitir edición:

1. En `app/dashboard/page.jsx`, busca:
   ```jsx
   {editing && (
     <div className="mt-1 p-3 bg-slate-50 rounded-lg border border-slate-200">
       <p className="text-xs text-slate-600">
         El RUT no se puede editar directamente...
       </p>
     </div>
   )}
   ```

2. Reemplaza con:
   ```jsx
   {!editing ? (
     // vista normal
   ) : (
     <input className="tix-input mt-2" value={draftRut} onChange={...} />
   )}
   ```

---

### 10. Validación RUT falla

**Causa**: `lib/rutUtils.js` no importado o no existe

**Solución**:

1. Chequea que `/lib/rutUtils.js` existe
2. Verifica que tiene estas funciones:
   ```javascript
   export function validateRut(rut) { ... }
   export function formatRut(rut) { ... }
   export function cleanRut(rut) { ... }
   ```
3. Si no, importa desde donde esté:
   ```javascript
   import { validateRut } from '@/lib/rutUtils'; // o tu path
   ```

---

## 🔍 Debugging Tips

### Ver logs de servidor
```bash
npm run dev  # Terminal mostrará errores en server actions
```

### Ver request/response
```javascript
// En lib/profileActions.js, agrega:
console.log('Request:', { full_name, email, phone, status });
console.log('Response:', data, error);
```

### Chequear BD directamente
En **Supabase → SQL Editor**:
```sql
-- Ver perfil del usuario
SELECT id, full_name, email, status, avatar_url FROM public.profiles WHERE id = 'USER_ID';

-- Ver tickets abiertos
SELECT * FROM public.support_tickets WHERE status = 'abierto' ORDER BY created_at DESC;
```

### Monitorear Storage
**Supabase → Storage → avatars**:
- Click en carpeta del user
- Verifica que archivos se suben correctamente

---

## ✅ Checklist para Deploy

Antes de ir a producción:

- [ ] SQL migration ejecutada sin errores
- [ ] Bucket 'avatars' creado y PUBLIC
- [ ] `SUPABASE_SERVICE_ROLE_KEY` en env variables
- [ ] `support_tickets` tabla existe
- [ ] Avatar upload funciona localmente
- [ ] Edición de nombre/status funciona
- [ ] Email/RUT cambio crea tickets
- [ ] Onboarding aparece en primer login
- [ ] Tests: avatar upload, email change, onboarding

---

## 🆘 Si nada funciona

1. **Reinicia dev server**: `npm run dev`
2. **Limpia cache**: `rm -rf .next && npm run dev`
3. **Verifica imports**: Todos los `import` tienen path correcto
4. **Console errors**: Abre DevTools → Console, busca errores
5. **Supabase logs**: Ve a Supabase Dashboard → Logs, filtra por errores

Si sigue, crea un issue con:
- Error exacto (screenshot)
- Qué intentaste hacer
- Qué ves en console

---

¡Éxito! 🚀
