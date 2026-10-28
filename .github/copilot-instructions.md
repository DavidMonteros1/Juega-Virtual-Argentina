# Instrucciones para Copilot

Antes de trabajar en este repositorio, sigue
[`AGENTS.md`](../AGENTS.md) y el diseño del
[cerebro central](../docs/agent-memory/CENTRAL-BRAIN.md).

El modelo operativo es un agente lógico secuencial: cada sesión recupera el
estado persistido por la anterior y reclama exclusividad antes de operar.
GitHub Issues/PRs son auxiliares de revisión, no el cerebro ni una invitación a
trabajo paralelo. Preserva Auth/RLS, nunca guardes secretos root en memoria y
mantén reglas de juego y pagos fijos, explícitos y auditables. El rol `admin`
de aplicación no es root de Supabase.
