# Instrucciones para Claude

Antes de proponer o modificar código:

1. Lee `AGENTS.md` y cualquier `AGENTS.md` aplicable al directorio.
2. Lee `docs/ENGINEERING_CONSTITUTION.md`, fuente canónica de ingeniería.
3. Consulta, según el alcance, `docs/APP_OVERVIEW.md`, `docs/AI_WORKFLOW.md`, `docs/API_CONTRACTS.md`, `docs/DB_MAP.md`, `docs/db/schema.json` y `docs/ENTRIBE_AGENT_SEED.md`.

Trabaja repository-first: inspecciona implementación, imports, consumidores, schema, migraciones y tests; separa hechos, hipótesis y desconocidos. Haz cambios mínimos, conserva contratos, no inventes estructura y no toques pagos/Webpay sin instrucción explícita. Mantén cero errores de ESLint/TypeScript en el build.

Responde en español de Chile, directo y con evidencia. Para implementaciones, entrega archivos tocados, cambio y motivo, diff, validaciones ejecutadas, resultado del build, riesgos y pasos manuales. No afirmes despliegue ni validación en producción sin haberlos observado.
