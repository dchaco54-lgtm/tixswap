# 🧪 Testing del Sistema de Onboarding y Tour

## Objetivo
Verificar que el flujo de onboarding y tour funciona correctamente para nuevos usuarios sin tocar funcionalidades de pago.

---

## Prerequisitos

- Tener acceso al dashboard (`/dashboard`)
- Navegador con DevTools abierto (para localStorage)
- Probar en desktop y móvil (responsive)

---

## 🔄 Resetear el Estado (para testing)

Antes de cada prueba, ejecuta esto en la consola del navegador:

```javascript
// Resetear onboarding y tour
localStorage.removeItem('tixswap_onboarding_skip_until');
localStorage.removeItem('tixswap_onboarding_tour_completed');
console.log('✅ Estado reseteado');
```

---

## ✅ Caso 1: Usuario nuevo sin nombre (Flujo completo)

### Setup
1. Crear/usar cuenta sin `full_name` en el perfil
2. O manualmente editar perfil y borrar el nombre

### Pasos
1. **Navegar a `/dashboard`**
   - ✅ Debe aparecer el modal de onboarding
   - ✅ Modal muestra título "¡Bienvenido a TixSwap! 🎫"
   - ✅ Se ven dos botones: "Actualizar ahora" y "Actualizar más tarde"

2. **Hacer clic en "Actualizar ahora"**
   - ✅ Modal se cierra
   - ✅ Sección "Mis datos" entra en modo edición
   - ✅ Después de 500ms aparece el tour guiado

3. **Completar el tour**
   - ✅ Paso 1: Wallet (highlight + tooltip/bottom-sheet)
   - ✅ Paso 2: Vender (🎫 Vender)
   - ✅ Paso 3: Mis ventas
   - ✅ Paso 4: Mis compras
   - ✅ Paso 5: Soporte
   - ✅ Cada paso muestra contador "Paso X de 5"
   - ✅ Botones "Saltar tour" y "Siguiente" funcionan
   - ✅ En el último paso, botón dice "¡Listo!"

4. **Terminar tour**
   - ✅ Tour desaparece
   - ✅ Dashboard queda funcional
   - ✅ Recargar página NO muestra el tour nuevamente

---

## ⏭️ Caso 2: Usuario omite el onboarding

### Setup
1. Resetear estado (ver arriba)
2. Usuario sin `full_name`

### Pasos
1. **Navegar a `/dashboard`**
   - ✅ Modal de onboarding aparece

2. **Hacer clic en "Actualizar más tarde"**
   - ✅ Modal se cierra inmediatamente
   - ✅ NO entra en modo edición
   - ✅ Después de 500ms aparece el tour guiado

3. **Verificar skip duration**
   ```javascript
   // En consola del navegador
   const skipUntil = localStorage.getItem('tixswap_onboarding_skip_until');
   const daysLeft = (parseInt(skipUntil) - Date.now()) / (1000 * 60 * 60 * 24);
   console.log('Días restantes de skip:', daysLeft); // ~7 días
   ```

4. **Recargar página**
   - ✅ Modal NO aparece (skip activo por 7 días)
   - ✅ Dashboard funciona normalmente

---

## 🔄 Caso 3: Usuario cierra tour con ESC

### Pasos
1. Resetear estado
2. Navegar a `/dashboard` → modal → "Actualizar ahora"
3. Cuando aparezca el tour, presionar **ESC**
   - ✅ Tour se cierra inmediatamente
   - ✅ localStorage tiene `tixswap_onboarding_tour_completed = true`
   - ✅ Recargar no muestra el tour

---

## 📱 Caso 4: Tour en móvil (responsive)

### Setup
1. Resetear estado
2. Abrir Chrome DevTools → Toggle device toolbar (Cmd+Shift+M)
3. Seleccionar iPhone 12 Pro o similar

### Pasos
1. **Navegar a `/dashboard`**
   - ✅ Modal de onboarding es responsive (no se sale de pantalla)
   - ✅ Botones se apilan verticalmente en móvil

2. **Iniciar tour**
   - ✅ En móvil, el tour usa **bottom sheet** (panel inferior)
   - ✅ No tooltips pequeños al lado (difícil de leer en móvil)
   - ✅ Bottom sheet muestra:
     - Paso actual
     - Título del paso
     - Descripción
     - Botones "Saltar tour" y "Siguiente"

3. **Highlight del elemento**
   - ✅ Elemento del sidebar tiene highlight con ring azul
   - ✅ Bottom sheet y highlight son visibles simultáneamente

---

## 🖥️ Caso 5: Tour en desktop

### Setup
1. Resetear estado
2. Pantalla de escritorio (>768px width)

### Pasos
1. **Iniciar tour**
   - ✅ Tour usa **tooltip flotante** al lado del elemento
   - ✅ Tooltip tiene flecha apuntando al elemento
   - ✅ Tooltip está posicionado correctamente (no fuera de pantalla)

2. **Hacer clic en "Siguiente"**
   - ✅ Tooltip se mueve al siguiente elemento
   - ✅ Transición suave (animación fade-in)

---

## 🚫 Caso 6: Usuario con perfil completo

### Setup
1. Usuario CON `full_name` y datos completos

### Pasos
1. **Navegar a `/dashboard`**
   - ✅ Modal de onboarding NO aparece
   - ✅ Si nunca hizo el tour, debería aparecer el tour directamente
   - ✅ Si ya completó el tour, dashboard normal

---

## 🎯 Caso 7: Navegación durante el tour

### Pasos
1. Iniciar tour
2. Durante el tour, hacer clic en un elemento del sidebar (ej: "Wallet")
   - ✅ Tour debería cerrarse automáticamente
   - ✅ Navegación funciona normalmente
   - ⚠️ **Nota**: Si esto NO pasa, es un bug menor pero aceptable para MVP

---

## 🐛 Errores comunes

### El tour no aparece
- Verificar localStorage: `localStorage.getItem('tixswap_onboarding_tour_completed')`
- Si está en `true`, resetear

### El modal no aparece
- Verificar localStorage: `localStorage.getItem('tixswap_onboarding_skip_until')`
- Si hay timestamp futuro, resetear
- Verificar que profile.full_name esté vacío

### Tour se posiciona mal
- Verificar que los elementos tengan `data-tour-id` correcto
- Revisar responsive breakpoint (768px)

### Modal se cierra solo
- Verificar que no haya otros event listeners de ESC activos

---

## ✅ Criterios de Aceptación

- [ ] Usuario nuevo ve modal de onboarding
- [ ] Puede elegir "Actualizar ahora" o "Actualizar más tarde"
- [ ] Skip funciona por 7 días (no molesta en esa sesión ni futuras)
- [ ] Tour aparece después del modal (completar u omitir)
- [ ] Tour se puede completar paso a paso
- [ ] Tour se puede saltar con botón "Saltar tour"
- [ ] Tour se puede cerrar con ESC
- [ ] Tour NO aparece después de completado
- [ ] 100% responsive (móvil usa bottom sheet, desktop tooltips)
- [ ] No interfiere con funcionalidad de pagos/wallet/ventas

---

## 🔧 Debugging

### Ver estado actual
```javascript
console.log({
  skipUntil: localStorage.getItem('tixswap_onboarding_skip_until'),
  tourCompleted: localStorage.getItem('tixswap_onboarding_tour_completed')
});
```

### Forzar que aparezca el modal
```javascript
localStorage.removeItem('tixswap_onboarding_skip_until');
// Recargar página
```

### Forzar que aparezca el tour
```javascript
localStorage.removeItem('tixswap_onboarding_tour_completed');
// Programáticamente en dashboard: setShowTour(true)
```

---

## 📝 Notas

- El tour es opcional y no bloquea funcionalidad
- Skip de 7 días es configurable (cambiar `sevenDays` en dashboard/page.jsx)
- Si se quiere mostrar el modal siempre, eliminar check de localStorage en useEffect
- Si se quiere persistir en DB en vez de localStorage, agregar campos a `profiles`:
  - `onboarding_dismissed_at` (timestamp)
  - `onboarding_tour_completed` (boolean)
