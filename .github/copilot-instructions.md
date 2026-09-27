Lee `AGENTS.md` y cualquier `AGENTS.md` local aplicable. `docs/ENGINEERING_CONSTITUTION.md` es la fuente canónica. Consulta además, según el alcance, `docs/APP_OVERVIEW.md`, `docs/AI_WORKFLOW.md`, `docs/API_CONTRACTS.md`, `docs/DB_MAP.md`, `docs/db/schema.json` y `docs/ENTRIBE_AGENT_SEED.md`.

Reglas:
- Inspeccionar implementación, imports, consumidores, schema, migraciones y tests antes de modificar.
- Separar hechos confirmados, hipótesis e información desconocida; no inventar estructura ni comportamiento.
- No reescribir archivos completos.
- No borrar archivos “por limpieza”.
- Mantener contratos de endpoints existentes (shape JSON).
- Validar server-side autenticación, autorización, ownership, montos y estados críticos.
- Diseñar para retries, duplicados, concurrencia e idempotencia en operaciones transaccionales.
- Bloqueante: CERO ESLint errors en build.
- No tocar pagos/Webpay salvo instrucción explícita.
- No exponer secretos, tokens, QR privados, RUT innecesarios ni datos bancarios.
- Reportar validaciones realmente ejecutadas; no afirmar despliegue o validación en producción sin evidencia.
