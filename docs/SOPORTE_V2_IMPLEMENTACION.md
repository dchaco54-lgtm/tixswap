# Sistema de Soporte TixSwap v2 - Instrucciones de Implementación

## ✅ COMPLETADO (Commit: eca7326)

### 1. Migración SQL (`docs/MIGRATION_SUPPORT_SYSTEM.sql`)
- ✅ Columna `app_role` agregada a `profiles` (valores: 'user' | 'admin')
- ✅ Admins configurados (davidchacon_17@hotmail.com, soporte@tixswap.cl)
- ✅ Estados normalizados: 'abierto' → 'open', etc.
- ✅ Columnas `last_message_at` y `code` (TS-XXXX) agregadas
- ✅ Trigger para actualizar `last_message_at` automáticamente
- ✅ RLS (Row Level Security) configurado
- ✅ Índices para performance

### 2. Helper de Estados (`lib/support/status.js`)
- ✅ Enum `TICKET_STATUS` con estados estandarizados
- ✅ Función `statusLabel()` - labels en español
- ✅ Función `statusBadgeClass()` - clases Tailwind para badges
- ✅ Función `normalizeStatus()` - conversión legacy
- ✅ Función `canChat()` - verificar si se puede chatear
- ✅ Función `isTerminalStatus()` - verificar estados finales
- ✅ Función `getNextValidStatuses()` - transiciones válidas

### 3. APIs Admin Actualizadas
- ✅ `/app/support/admin/tickets/route.js` - usa `app_role` con fallback
- ✅ `/app/support/admin/ticket/route.js` - usa `app_role` con fallback
- ✅ `/app/support/admin/update/route.js` - usa `app_role` con fallback

### 4. Profile Actions
- ✅ `lib/profileActions.js` - `createProfileChangeTicket()` usa estado 'open'

### 5. UI Usuario - Dashboard Soporte
- ✅ Importa helper de estados
- ✅ Mejoras visuales parciales
- ⚠️ PENDIENTE: Terminar actualización del listado de tickets

---

## 🔨 PENDIENTE (PRIORIDAD ALTA)

### PASO 1: Ejecutar Migración SQL

**CRÍTICO - HACER PRIMERO**

```bash
# 1. Ir a Supabase Dashboard → SQL Editor
# 2. Copiar TODO el contenido de docs/MIGRATION_SUPPORT_SYSTEM.sql
# 3. Ejecutar el script completo
# 4. Verificar resultados:
#    - Admins configurados correctamente
#    - Estados normalizados (sin 'abierto', todo es 'open')
#    - Trigger funcionando
```

**Verificación post-migración:**
```sql
-- Ver admins
SELECT email, full_name, app_role FROM profiles WHERE app_role = 'admin';

-- Ver estados de tickets
SELECT status, COUNT(*) FROM support_tickets GROUP BY status;

-- Verificar trigger
SELECT proname FROM pg_proc WHERE proname = 'update_ticket_last_message';
```

### PASO 2: Terminar UI Dashboard Soporte (`app/dashboard/soporte/page.jsx`)

**Ubicación:** Línea ~295 en adelante

**Cambios necesarios:**

1. **Reemplazar función `pill()` antigua:**
```jsx
// ELIMINAR:
function pill(status) {
  const base = "px-3 py-1 rounded-full text-xs font-extrabold border";
  // ... código viejo
}

// Ya no se necesita, usamos statusBadgeClass() del helper
```

2. **Actualizar listado de tickets** (línea ~295):
```jsx
// BUSCAR esta sección:
{tickets.slice(0, 25).map((t) => (
  <button
    key={t.id}
    // ...
  >
    {/* ACTUALIZAR ESTA PARTE */}
  </button>
))}

// REEMPLAZAR CON:
{tickets.slice(0, 25).map((t) => {
  const ticketCode = t.code || `TS-${t.ticket_number}`;
  const statusText = statusLabel(t.status);
  
  return (
    <button
      key={t.id}
      onClick={() =>
        router.push(`/dashboard/tickets?open=${encodeURIComponent(t.id)}`)
      }
      className="w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold text-blue-600 tracking-wide">
              {ticketCode}
            </span>
            <span className={statusBadgeClass(t.status)}>
              {statusText}
            </span>
          </div>
          <div className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-blue-700 transition">
            {t.subject || "Sin asunto"}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
            <span>{CATEGORY_LABEL(t.category)}</span>
            <span>·</span>
            <span>
              {t.last_message_at || t.created_at
                ? new Date(t.last_message_at || t.created_at).toLocaleString("es-CL", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : "—"}
            </span>
          </div>
        </div>
        <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
})}
```

3. **Mejorar empty state** (línea ~305):
```jsx
// BUSCAR:
: tickets.length === 0 ? (
  <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 text-slate-600">
    Aún no tienes tickets.
  </div>

// REEMPLAZAR CON:
: tickets.length === 0 ? (
  <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
      <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    </div>
    <p className="font-semibold text-slate-700">No tienes tickets aún</p>
    <p className="text-sm text-slate-500 mt-1">Crea tu primer ticket para contactar a soporte</p>
  </div>
```

### PASO 3: Actualizar UI Conversación de Tickets (`app/dashboard/tickets/page.jsx`)

**TODO:**
1. Importar helper: `import { statusLabel, statusBadgeClass, canChat, TICKET_STATUS } from "@/lib/support/status";`
2. Usar `statusLabel()` y `statusBadgeClass()` en vez de código inline
3. Mejorar composer:
   - Adjuntar archivos con preview
   - Mostrar progress de upload
4. Diferenciar mensajes:
   - "Tú" vs "Soporte TixSwap"
   - Avatar o icono diferenciador
5. Si `ticket.status === TICKET_STATUS.CLOSED`:
   - Bloquear input
   - Mostrar botón "Reabrir ticket"
6. Si `ticket.status === TICKET_STATUS.WAITING_USER`:
   - Mostrar aviso: "⚠️ Necesitamos más información de tu parte"
   - Resaltar input de respuesta

**Estructura sugerida:**
```jsx
const isTerminal = ticket?.status === TICKET_STATUS.CLOSED || ticket?.status === TICKET_STATUS.RESOLVED;
const canSendMessage = canChat(ticket?.status);

{isTerminal && (
  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
    <div className="flex items-center gap-2">
      <svg className="w-5 h-5 text-amber-600" .../>
      <p className="text-sm font-semibold text-amber-900">
        Este ticket está {ticket.status === 'closed' ? 'cerrado' : 'resuelto'}
      </p>
    </div>
    <button onClick={handleReopenTicket} className="mt-3 tix-btn-ghost">
      Reabrir ticket
    </button>
  </div>
)}

{ticket?.status === TICKET_STATUS.WAITING_USER && (
  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
    <div className="flex items-center gap-2">
      <svg className="w-5 h-5 text-blue-600" .../>
      <p className="text-sm font-semibold text-blue-900">
        Necesitamos más información para resolver tu caso
      </p>
    </div>
  </div>
)}
```

### PASO 4: Actualizar UI Admin Soporte (`app/admin/soporte/page.jsx`)

**TODO:**

1. **Importar helper:**
```jsx
import { statusLabel, statusBadgeClass, TICKET_STATUS, getNextValidStatuses } from "@/lib/support/status";
```

2. **Arreglar validación admin:**
   - Ya debería funcionar con la migración SQL y cambios en APIs
   - Verificar que no usa `prof?.role`, debe ser `prof?.app_role`

3. **Mejorar filtros:**
```jsx
// Agregar dropdown de estados
<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
  <option value="all">Todos los estados</option>
  <option value="open">Abiertos</option>
  <option value="in_progress">En progreso</option>
  <option value="waiting_user">Esperando usuario</option>
  <option value="resolved">Resueltos</option>
  <option value="closed">Cerrados</option>
</select>

// Búsqueda por TS-XXXX, email, RUT
<input 
  type="text"
  placeholder="Buscar por TS-XXXX, email o RUT"
  value={query}
  onChange={(e) => setQuery(e.target.value)}
/>
```

4. **Panel de acciones rápidas** (al abrir ticket):
```jsx
// Cambiar estado con dropdown inteligente
const nextStates = getNextValidStatuses(selectedTicket?.status);

<select 
  value={selectedTicket?.status}
  onChange={(e) => handleChangeStatus(e.target.value)}
>
  {nextStates.map(state => (
    <option key={state} value={state}>
      {statusLabel(state)}
    </option>
  ))}
</select>

// Botones de acción rápida
<button onClick={() => handleChangeStatus(TICKET_STATUS.WAITING_USER)}>
  📎 Solicitar más info
</button>

<button onClick={() => handleChangeStatus(TICKET_STATUS.RESOLVED)}>
  ✅ Resolver
</button>

<button onClick={() => handleChangeStatus(TICKET_STATUS.CLOSED)}>
  🔒 Cerrar
</button>
```

5. **Usar `statusBadgeClass()` en listado de tickets:**
```jsx
{tickets.map(t => (
  <div key={t.id}>
    <span className={statusBadgeClass(t.status)}>
      {statusLabel(t.status)}
    </span>
  </div>
))}
```

---

## 📋 CHECKLIST DE TESTING

Después de completar los cambios, verificar:

### Test 1: Crear Ticket (Usuario)
- [ ] Ir a `/dashboard/soporte`
- [ ] Llenar formulario (categoría, asunto, mensaje)
- [ ] Click "Crear ticket"
- [ ] ✅ Debe mostrar mensaje de éxito con código TS-XXXX
- [ ] ✅ Debe redirigir a `/dashboard/tickets` automáticamente
- [ ] ✅ Ticket aparece en listado con estado "Abierto" (badge azul)

### Test 2: Admin ve Tickets
- [ ] Login como admin (davidchacon_17@hotmail.com)
- [ ] Ir a `/admin/soporte`
- [ ] ✅ NO debe mostrar "FORBIDDEN"
- [ ] ✅ Debe cargar lista de tickets
- [ ] ✅ Filtros funcionan (estado, búsqueda)

### Test 3: Admin Responde
- [ ] Abrir un ticket en admin panel
- [ ] Escribir respuesta
- [ ] ✅ Debe aparecer en conversación del usuario
- [ ] ✅ `last_message_at` debe actualizarse (verificar en DB)

### Test 4: Cambio de Estado
- [ ] Admin cambia estado a "Esperando respuesta"
- [ ] Usuario ve aviso "Necesitamos más información"
- [ ] Usuario responde
- [ ] ✅ Estado debe cambiar automáticamente

### Test 5: Tickets Cerrados
- [ ] Admin cierra ticket
- [ ] Usuario ve ticket cerrado
- [ ] ✅ Input debe estar bloqueado
- [ ] ✅ Debe aparecer botón "Reabrir ticket"
- [ ] Usuario reabre ticket
- [ ] ✅ Debe crear mensaje automático + cambiar estado a 'open'

### Test 6: Normalización de Estados
- [ ] Verificar en DB: `SELECT DISTINCT status FROM support_tickets;`
- [ ] ✅ NO debe haber 'abierto', 'en_revision', etc.
- [ ] ✅ Solo: 'open', 'in_progress', 'waiting_user', 'resolved', 'closed'

### Test 7: RLS y Permisos
- [ ] Usuario A crea ticket
- [ ] Login como Usuario B
- [ ] ✅ Usuario B NO debe ver ticket de Usuario A
- [ ] Login como admin
- [ ] ✅ Admin debe ver TODOS los tickets

---

## 🚀 COMANDOS ÚTILES

### Ver logs en tiempo real
```bash
# Terminal 1: Dev server
npm run dev

# Terminal 2: Logs de Supabase
# (Supabase Dashboard → Logs)
```

### Verificar estados en DB
```sql
-- Ver distribución de estados
SELECT status, COUNT(*) as total
FROM support_tickets
GROUP BY status
ORDER BY total DESC;

-- Ver último mensaje de cada ticket
SELECT 
  id,
  code,
  subject,
  status,
  last_message_at,
  created_at
FROM support_tickets
ORDER BY last_message_at DESC NULLS LAST
LIMIT 10;

-- Ver admins
SELECT id, email, full_name, app_role, user_type
FROM profiles
WHERE app_role = 'admin' OR user_type = 'admin';
```

### Reset de prueba (si es necesario)
```sql
-- CUIDADO: Esto borra TODOS los tickets de soporte
-- Solo para desarrollo/testing
DELETE FROM support_messages WHERE ticket_id IN (SELECT id FROM support_tickets);
DELETE FROM support_attachments WHERE ticket_id IN (SELECT id FROM support_tickets);
DELETE FROM support_tickets;
```

---

## 📚 REFERENCIAS

### Archivos Clave
- `docs/MIGRATION_SUPPORT_SYSTEM.sql` - Migración completa de DB
- `lib/support/status.js` - Helper de estados (fuente de verdad)
- `lib/profileActions.js` - Crear tickets de cambio de datos
- `app/support/admin/*` - APIs admin (ya actualizadas)
- `app/support/my/*` - APIs usuario
- `app/dashboard/soporte/page.jsx` - UI crear/listar tickets
- `app/dashboard/tickets/page.jsx` - UI conversación
- `app/admin/soporte/page.jsx` - UI admin

### Patrones de Código

**Importar helper:**
```jsx
import { statusLabel, statusBadgeClass, canChat, TICKET_STATUS } from "@/lib/support/status";
```

**Mostrar badge de estado:**
```jsx
<span className={statusBadgeClass(ticket.status)}>
  {statusLabel(ticket.status)}
</span>
```

**Verificar si se puede chatear:**
```jsx
const canSend = canChat(ticket.status);

{canSend ? (
  <textarea />
) : (
  <p>Este ticket está cerrado</p>
)}
```

**Cambiar estado (admin):**
```jsx
const handleChangeStatus = async (newStatus) => {
  const res = await fetch('/support/admin/update', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ticket_id: ticketId,
      status: newStatus,
    }),
  });
  // ...
};
```

---

## ⚠️ NOTAS IMPORTANTES

1. **Migración SQL es CRÍTICA**: Sin ejecutarla, nada funcionará correctamente.
2. **app_role vs user_type**: `app_role` es para permisos, `user_type` es para tier.
3. **Estados normalizados**: Siempre usar constantes de `TICKET_STATUS`.
4. **RLS habilitado**: Las políticas están configuradas, pero respetar permisos en UI.
5. **Trigger automático**: `last_message_at` se actualiza solo, no hacerlo manual.
6. **Códigos TS-XXXX**: Se generan automáticamente con la migración.

---

## 💡 MEJORAS FUTURAS (Opcional)

1. **Notificaciones en tiempo real** (Supabase Realtime)
2. **Adjuntar archivos** en conversaciones
3. **Templates de respuesta** para admin
4. **SLA tracking** (tiempo de respuesta)
5. **Analytics** (tickets por categoría, tiempo promedio de resolución)
6. **Exportar tickets** a CSV/Excel
7. **Buscar en mensajes** (full-text search)

---

## 🆘 TROUBLESHOOTING

### Error: "FORBIDDEN" en admin
```bash
# Verificar:
SELECT email, app_role FROM profiles WHERE email = 'davidchacon_17@hotmail.com';
# Debe mostrar app_role = 'admin'

# Si no:
UPDATE profiles SET app_role = 'admin' WHERE email = 'davidchacon_17@hotmail.com';
```

### Error: Tickets con estado "abierto"
```sql
-- Ejecutar migración de estados:
UPDATE support_tickets SET status = 'open' WHERE status = 'abierto';
```

### Error: last_message_at no se actualiza
```sql
-- Verificar que trigger existe:
SELECT proname FROM pg_proc WHERE proname = 'update_ticket_last_message';

-- Recrear trigger (si no existe):
-- Copiar sección de trigger desde MIGRATION_SUPPORT_SYSTEM.sql
```

### Error: Usuario no ve sus tickets
```sql
-- Verificar RLS:
SELECT tablename, policyname FROM pg_policies WHERE tablename = 'support_tickets';

-- Verificar user_id:
SELECT id, user_id, subject FROM support_tickets WHERE user_id = '<UUID>';
```

---

**Última actualización:** 2026-01-21  
**Commit actual:** eca7326  
**Progreso:** ~60% completo
