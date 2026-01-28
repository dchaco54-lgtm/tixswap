---
name: TixSwap Global Rules
description: Reglas globales (cambios mínimos, no romper contratos, seguridad, estilo)
applyTo: "**"
---

- Siempre hacer cambios mínimos (patch), NO reescribir archivos completos si no es necesario.
- Antes de cambiar: localizar el archivo exacto y explicar el plan en 3-6 bullets.
- Nunca romper contratos de API (si cambias respuesta: mantener retrocompatibilidad).
- NO tocar pagos: app/api/payments/** es “intocable” salvo bug confirmado.
- Si falta data (relación null / columna inexistente / env var): responder seguro (null/false) y mensaje claro; nunca reventar build.
- Nunca commitear secretos: nada de passwords/keys en .vscode/, .env.local, etc. Solo .env.local.example.
- Siempre evitar ESLint build-breakers (unused vars, etc.).
- Lee docs/AI_WORKFLOW.md antes de proponer cambios.
