# Supabase — instrucciones locales

Estas reglas complementan `../AGENTS.md` y `../docs/ENGINEERING_CONSTITUTION.md`.

- Inspeccionar `docs/db/schema.json`, migraciones existentes, código consumidor y políticas RLS antes de proponer cambios.
- No inventar tablas, columnas, relaciones, constraints ni estados. Confirmar primary keys, foreign keys, unique constraints, nullability e índices.
- No editar el snapshot del schema como sustituto de una migración ni asumir que una migración ya está aplicada en producción.
- Mantener migraciones pequeñas, reproducibles y revisables; documentar orden, compatibilidad, rollback o mitigación y verificación manual.
- Revisar autenticación, autorización, ownership y RLS. Recordar que service role omite RLS y exige autorización explícita en servidor.
- Analizar atomicidad, concurrencia, idempotencia y partial failures en cambios que afecten tickets, órdenes, pagos o payouts.
- Nunca incluir secretos ni valores reales de entorno en SQL, documentación o ejemplos.
