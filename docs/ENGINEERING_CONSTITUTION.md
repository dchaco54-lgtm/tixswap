# Constitución de ingeniería de Entribe

Este documento es la fuente canónica de principios de ingeniería y trabajo con agentes de IA en este repositorio. `AGENTS.md` y las instrucciones específicas de cada herramienta o directorio pueden agregar restricciones locales, pero no contradecir esta constitución. Si una regla local es más estricta, se aplica la más estricta.

## 1. Mantra

> INSPECT FIRST.  
> UNDERSTAND SECOND.  
> PROPOSE THIRD.  
> MODIFY LAST.

- No inventar información del repositorio.
- Preferir evidencia sobre supuestos.
- Preferir cambios pequeños sobre reescrituras.
- Preferir reutilización sobre duplicación.
- Preferir contratos explícitos.
- Preferir seguridad e integridad sobre conveniencia.

## 2. Fuentes de verdad y orden de lectura

El repositorio, el schema, las migraciones, los contratos y el código existente son la fuente primaria de verdad. La documentación ayuda a navegar el sistema, pero se debe contrastar con la implementación vigente.

Antes de implementar:

1. Leer `AGENTS.md` y cualquier `AGENTS.md` aplicable al directorio.
2. Leer la documentación técnica pertinente: `docs/APP_OVERVIEW.md`, `docs/AI_WORKFLOW.md`, `docs/API_CONTRACTS.md`, `docs/DB_MAP.md`, `docs/db/schema.json` y `docs/ENTRIBE_AGENT_SEED.md`.
3. Inspeccionar archivos exactos, imports, consumidores, rutas, schema, migraciones, tests e implementaciones antiguas o duplicadas.
4. Separar explícitamente hechos confirmados, hipótesis e información desconocida.
5. Si falta evidencia, inspeccionar o pedir la información necesaria; nunca inventar tablas, columnas, endpoints, estados, variables de entorno o comportamiento de producción.

## 3. Arquitectura y alcance

- Promover alta cohesión, bajo acoplamiento y separación de responsabilidades.
- Preferir funciones pequeñas y lógica de dominio separada de la UI.
- Reutilizar helpers, componentes, patrones y rutas existentes.
- Evitar abstracciones anticipadas o innecesarias.
- No borrar archivos por limpieza ni renombrar rutas sin revisar todos sus consumidores.
- No cambiar versiones mayores, framework o arquitectura salvo solicitud explícita.
- Mantener retrocompatibilidad de contratos API, salvo que exista una migración deliberada y aprobada.

## 4. Datos, SQL y Supabase

- Verificar en el schema y las migraciones las primary keys, foreign keys, unique constraints, nullability, indexes, relaciones y transaction boundaries.
- No crear fuentes de verdad duplicadas.
- Revisar autenticación, autorización, RLS, ownership, uso de service role y exposición de datos.
- Un cliente con service role omite RLS: toda operación debe autorizarse explícitamente antes de ejecutarse.
- Toda migración debe ser revisable, reproducible y compatible con el estado esperado; no asumir que un archivo de migración ya fue aplicado en producción.
- No modificar `docs/db/schema.json` como sustituto de una migración ni asumir que representa producción sin verificar su procedencia y fecha.

## 5. Seguridad y privacidad

Nunca confiar en valores críticos enviados por el cliente, incluidos precios, montos, roles, IDs de usuario, seller IDs, ownership, estados o estado de pagos. Derivarlos o validarlos server-side contra fuentes confiables.

- Validar autenticación, autorización y propiedad del recurso en toda operación sensible.
- Aplicar mínimo privilegio a datos, storage, tokens y credenciales.
- Nunca exponer secrets, tokens, QR privados, RUT innecesarios, datos bancarios ni contenido privado de entradas.
- Nunca commitear `.env.local` ni claves. En `.env.local.example` solo se documentan nombres y valores ficticios seguros.
- No mostrar stack traces ni detalles internos sensibles al usuario.

## 6. Concurrencia e integridad transaccional

En reservas, tickets, checkout, órdenes, callbacks, pagos, refunds y seller payouts, analizar:

- requests simultáneos;
- callbacks duplicados y retries;
- partial failures;
- atomicidad y transaction boundaries;
- race conditions;
- idempotencia;
- estado obsoleto.

No usar botones deshabilitados ni estado del frontend como mecanismo de integridad. Las invariantes críticas deben sostenerse en servidor y, cuando corresponda, en constraints o transacciones de base de datos.

## 7. JavaScript, TypeScript y asincronismo

- Usar asincronismo explícito; preferir `async`/`await` cuando mejora claridad.
- No dejar promises sin manejar ni ocultar errores.
- No paralelizar operaciones dependientes.
- Usar `Promise.all` solo cuando las operaciones sean realmente independientes y se comprenda su semántica de fallo.
- Mantener cero errores de TypeScript y ESLint en el build; variables o imports no usados se corrigen antes de entregar.

## 8. Errores y observabilidad

Diseñar también los failure paths. Cuando corresponda, distinguir errores de validación, autorización, proveedor externo, recuperables e internos.

- No usar `catch` vacíos.
- No convertir todos los fallos en HTTP 500.
- Mantener el shape de respuesta protegido incluso en caminos de error cuando el contrato lo exija.
- Las operaciones críticas deben poder reconstruirse mediante logs y correlación sin registrar información sensible.
- Nunca afirmar que algo está desplegado o validado en producción si no fue observado.

## 9. Performance y dependencias

No optimizar sin evidencia. Buscar N+1, consultas repetidas, índices faltantes, `SELECT *` innecesarios, resultados sin límite, JavaScript innecesario en cliente, dependencias pesadas y rerenders evitables.

Entribe debe permanecer mobile-first y liviano. Antes de agregar una dependencia, comprobar si la plataforma, una dependencia existente o un helper interno ya resuelve el problema. Evaluar mantenimiento, bundle y riesgo de seguridad.

## 10. Testing y validación

Un build exitoso no demuestra que el flujo funciona. La validación proporcional al riesgo debe cubrir:

- happy path y errores;
- inputs inválidos;
- autenticación, autorización y ownership;
- empty states;
- retry y fallos externos cuando corresponda.

Para operaciones transaccionales agregar, según aplique: request duplicado, callback duplicado, ejecución concurrente, partial failure y stale state.

El build bloqueante es `npm run build`. Además, ejecutar tests y verificaciones focalizadas del flujo afectado. Si algo no se ejecutó, declararlo; no presentarlo como aprobado.

## 11. Producto y contexto Entribe

La marca pública es **Entribe**, la razón social es **Entribe SpA**, el dominio principal es `entribe.cl` y la marca anterior es TixSwap/Tixswap. Entribe significa Entry + Tribe. Es un marketplace intermediario de entradas, Chile-first; no es una ticketera primaria ni una red social genérica.

No describir automáticamente el modelo como escrow ni prometer seguridad absoluta. Una funcionalidad nueva debe explicar: problema, usuario, flujo actual, por qué no basta mejorar algo existente, métrica, riesgo de abuso y complejidad incorporada.

Priorizar confianza, liquidez, oferta de vendedores, conversión, transacciones exitosas, claridad de precios, soporte, SEO, performance y recurrencia. Evitar dark patterns.

## 12. Rebranding controlado

El cambio TixSwap → Entribe es una migración controlada, no un reemplazo global ciego. Clasificar cada referencia como:

- visible al usuario;
- configuración;
- identificador técnico interno;
- registro histórico.

Antes de modificar, revisar compatibilidad de dominios, redirects, OAuth, callbacks, remitentes, Supabase y Vercel. Mantener referencias históricas cuando sean necesarias para trazabilidad o compatibilidad.

## 13. Zonas protegidas y contratos vigentes

Pagos, Webpay, Banco de Chile, órdenes, entrega de tickets, refunds y seller payouts son zonas protegidas. No refactorizar por estética. Cualquier cambio requiere inspeccionar montos, currency, estados, callbacks, retries, idempotencia, efectos en base de datos, autorización y recuperación de fallos, con pruebas y checklist de regresión.

`GET /api/tickets/my-publications` debe:

- filtrar por `seller_id` del usuario autenticado;
- retornar tickets, event y `ticket_upload` cuando exista;
- mantener `{ "tickets": [], "summary": { "total": 0, "active": 0, "paused": 0, "sold": 0 } }`;
- tolerar `ticket_upload_id = null`, con `ticket_upload = null` e `is_nominated = false`.

Para nominadas, la fuente de verdad es `ticket_uploads`; el vínculo es `tickets.ticket_upload_id`. La normalización esperada es:

```js
ticket_upload?.is_nominated ?? ticket_upload?.is_nominada ?? false
```

## 14. Flujo obligatorio

Todo cambio sigue:

1. **INSPECT:** reunir evidencia y restricciones.
2. **DIAGNOSE:** explicar estado actual, causa y riesgos.
3. **PLAN:** definir alcance, archivos, contratos y validación.
4. **IMPLEMENT:** aplicar el diff mínimo autorizado.
5. **VALIDATE:** ejecutar checks proporcionales al riesgo.
6. **REPORT:** entregar evidencia y pendientes.

Si la solicitud es solo análisis o diagnóstico, detenerse antes de implementar. Modificar únicamente cuando exista una petición explícita de cambio.

El reporte final de una implementación debe indicar:

- archivos modificados;
- qué cambió y por qué;
- patch o diff preciso;
- tests ejecutados y resultados;
- resultado del build;
- riesgos restantes;
- pasos manuales;
- migraciones y cambios de configuración, o indicar explícitamente que no existen;
- checklist final de UI, endpoints y producción según corresponda.
