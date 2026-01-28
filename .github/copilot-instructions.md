Lee AGENTS.md y docs/db/schema.json antes de proponer cambios.

Reglas:
- No reescribir archivos completos.
- No borrar archivos “por limpieza”.
- Mantener contratos de endpoints existentes (shape JSON).
- Si algo es incierto, primero inspecciona (grep + schema.json + queries) y recién después cambia.
- Bloqueante: CERO ESLint errors en build.
- No tocar pagos/Webpay salvo instrucción explícita.
