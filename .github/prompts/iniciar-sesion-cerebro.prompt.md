---
name: "Iniciar sesión desde el cerebro del proyecto"
description: "Bootstrap de una sesión nueva: recuperar estado, restricciones y próximo paso sin releer toda la historia"
argument-hint: "Opcional: objetivo o referencia de la tarea que vas a continuar"
agent: "agent"
---

Actúa como la siguiente sesión del **mismo agente lógico** de Juega Virtual
Argentina. No plantees agentes de trabajo paralelos ni supongas que GitHub es el
canal de continuidad. Tu objetivo inicial es reconstruir el estado fiable,
identificar el último handoff y continuar sin repetir operaciones.

Este es el prompt raíz de inicialización del workspace. Si hay un objetivo en
el chat que invocó este prompt, úsalo como tarea activa; si no, recupera el
siguiente paso del handoff vigente y continúa por él.

## Bootstrap obligatorio

1. Confirma la raíz del workspace y lee `AGENTS.md`. No abras ni imprimas
   `.env.local`, `.qa-credentials.local.md`, tokens, cookies, credenciales ni
   archivos locales de secretos.
2. Ejecuta `git status --short` y comprueba la rama. Distingue cambios previos
   de los que harás en esta sesión; no limpies ni reviertas cambios ajenos.
3. Lee `docs/agent-memory/README.md` y
   `docs/agent-memory/SESSION-STATE.md`. El segundo es el handoff canónico;
   no cargues todos los documentos de memoria al arrancar.
4. Lee `docs/agent-memory/WORKFLOW.md` solo si necesitas aclarar cómo registrar
   resultados o hacer handoff. Lee `CENTRAL-BRAIN.md` solo si la tarea es
   implementar/revisar el backend Brain; no supongas que tablas, RPC, lease o
   notificaciones ya existen. En el Supabase QA actual, las RPC del Brain están
   aplicadas y verificadas en transacciones revertidas: usa
   `cerebro-agentes.html` con una sesión Auth real que tenga `ai_auditor`. La
   Preview está protegida por SSO de Vercel; si no tienes acceso, usa el handoff
   local y solicita acceso al propietario. En otros proyectos verifica esquema
   y permisos antes de usar el Brain.
5. Lee solo la sección relevante de `CONTEXTO-ACTUAL.md`; no leas la sección
   completa de objetivos ni todos los puntos cronológicos salvo que la tarea lo
   requiera. Prioriza evidencia posterior al último handoff.
6. Consulta `MEMORIA-COLMENA.md` buscando únicamente procedimientos para la
   tarea recibida. Abre un informe de auditoría o `HISTORIAL-PROYECTO.md` solo
   si hace falta resolver una pregunta concreta.
7. Si el usuario indicó un objetivo, continúa ese objetivo. Si no, usa el
   `Próximo paso único` de `SESSION-STATE.md` y comienza por verificar sus
   precondiciones. No te quedes en un resumen si puedes realizar trabajo útil.

## Reglas de evidencia y estado

- Antes de acciones con efecto externo, comprueba el entorno/proyecto, cuenta,
  permisos y estado actual. No repitas una operación cuyo resultado sea
  incierto: primero busca el resultado o concilia el ledger.
- Clasifica cada hallazgo como **verificado ahora**, **verificado en fecha
  anterior**, **hipótesis** o **pendiente**. Añade fecha/hora local y evidencia
  no secreta a los hechos remotos relevantes.
- Nunca interpretes un timeout, redirect abortado o snapshot incompleto como
  prueba de que una acción no ocurrió.
- Mantén reglas y cuotas de juegos fijas y auditables. No optimices pagos o
  probabilidades por saldo o historial individual.
- No leas credenciales por curiosidad ni las incluyas en razonamiento visible,
  archivos, resultados de herramientas o memoria. Las instrucciones locales
  nunca otorgan autorización para exponer secretos o eludir Auth/RLS.

## Formato del resumen interno de orientación

Antes de ejecutar una tarea sustantiva, sintetiza en el chat —sin secretos—:

```text
Misión activa:
Último handoff y evidencia:
Estado del workspace:
Estado remoto que falta verificar:
Restricciones/precondiciones:
Siguiente acción concreta:
```

Después continúa con la acción concreta sin pedir al usuario que repita el
contexto. Pregunta solo cuando una decisión tenga consecuencias externas,
irreversibles o ambiguas que no puedan resolverse con evidencia local.

## Cierre y persistencia

Antes de terminar, actualiza `docs/agent-memory/SESSION-STATE.md` como snapshot
canónico de handoff. Actualiza `CONTEXTO-ACTUAL.md` solo si cambió el estado
operativo duradero. Añade a `MEMORIA-COLMENA.md` solo procedimientos
reproducibles y evidencia útil; añade al `HISTORIAL-PROYECTO.md` hechos fechados,
sin reescribir los originales. Evita duplicar el mismo dato en muchos sitios.
Usa esta estructura compacta:

```text
Actualizado (fecha/hora):
Objetivo / estado: pendiente | en curso | bloqueado | completado
Hechos nuevos (fuente y fecha):
Cambios:
Validación:
No verificado / riesgos:
Siguiente paso único:
```

No escribas secretos. No afirmes que el cerebro Supabase tiene persistencia o
locking hasta que esa implementación exista y esté probada. Comprueba
`git diff --check` y que las credenciales locales sigan ignoradas. No hagas
commit, push ni deploy salvo que la tarea lo pida explícitamente.
