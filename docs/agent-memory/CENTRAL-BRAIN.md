# Diseño portable del cerebro central

## Propósito

Persistir una sola línea de trabajo a través de sesiones sucesivas. El modelo
puede cambiar entre sesiones, pero el agente lógico conserva identidad
operativa, objetivos, decisiones, procedimientos, errores resueltos y el
próximo paso. Este documento distingue la arquitectura objetivo de lo ya
implementado y verificado; las notificaciones Realtime y el cliente publicado
siguen pendientes.

El diseño de memoria debe vivir en el backend compartido del entorno de agentes
y continuar disponible durante la vida del proyecto. El propietario confirmó
el Supabase existente como QA descartable aunque el Dashboard etiqueta su rama
`main` como `Production`. Esta autorización aplica solo a ese proyecto. Reutilizar
el cerebro desde otros proyectos requerirá clientes autenticados y autorización
adecuados para cada uno; no compartir sesiones de Auth entre proyectos Supabase.

## Componentes y autoridad

- **Supabase Brain:** fuente compartida para estado de sesión, handoffs,
  decisiones, procedimientos y bitácora append-only. Una sola sesión de agente
  puede mantener el lease de escritura.
- **Workspace local compartido:** instrucciones y snapshots de fallback
  legibles por las sesiones sucesivas que usan este mismo entorno. No requieren
  push para estar disponibles aquí.
- **`SESSION-STATE.md`:** handoff compacto vigente y fallback mientras la
  interfaz remota del Brain no esté disponible para agentes; se actualiza al
  cierre de cada sesión y apunta al detalle.
- **Repositorio Git:** versionado y revisión del código/migraciones. No es el
  canal de comunicación entre sesiones del mismo entorno y no almacena secretos.
- **Capa de acceso del agente:** existe un cliente web local autenticado que
  llama RPC estrechas; aún no está publicado ni probado con Auth real. No hay
  MCP/CLI ni se entrega al modelo una cadena de conexión privilegiada o clave
  `service_role`.
- **Supabase Realtime:** integración futura, aún no implementada; no se asume
  que las sesiones activas reciban notificaciones.
- **Control humano:** el propietario aprueba cambios de permisos, reglas
  económicas, despliegues y operaciones destructivas.

Orden para resolver estados conflictivos: seguridad y controles de plataforma;
datos operativos confirmados ahora; último handoff persistido; decisiones
aceptadas/versionadas; playbooks reproducidos; documentos históricos. Una nota
no fechada o sin evidencia nunca invalida el estado consultado.

## Modelo de información propuesto

La migración `supabase/migrations/20261028160500_jva_agent_brain.sql` está
aplicada en el Supabase QA actual y sus RPC principales pasaron pruebas
transaccionales con rollback. Implementa `jva_brain_state`,
`jva_brain_sessions`, `jva_brain_events`, `jva_brain_lease` y funciones
autorizadas por el rol `ai_auditor`. La tabla siguiente conserva entidades
objetivo que no todas están materializadas como tablas independientes:

| Entidad lógica | Campos mínimos | Uso |
|---|---|---|
| `brain_sessions` | `id`, `agent_key`, `status`, `started_at`, `heartbeat_at`, `ended_at`, `summary` | Ciclo de una sesión y recuperación |
| `brain_state` | `key`, `value_json`, `version`, `updated_at`, `updated_by` | Snapshot compacto de objetivo, entorno, estado QA y siguiente paso |
| `brain_events` | `id`, `session_id`, `event_type`, `payload_json`, `created_at` | Log append-only de hallazgos, decisiones, acciones y resultados |
| `brain_tasks` | `id`, `title`, `status`, `owner_session_id`, `scope_json`, `next_step`, `updated_at` | Única tarea activa y sus bloqueos |
| `brain_playbooks` | `id`, `symptom`, `verified_steps`, `evidence_ref`, `confidence`, `updated_at` | Soluciones verificadas y buscables |
| `brain_decisions` | `id`, `decision`, `rationale`, `supersedes_id`, `approved_by`, `created_at` | Decisiones vigentes e historial de supersesión |
| `brain_experiments` | `id`, `environment`, `rules_version`, `parameters_json`, `seed`, `sample_size`, `results_json`, `reconciliation_json` | Trazabilidad de simulaciones y auditorías QA |
| `brain_lease` | `singleton_key`, `session_id`, `expires_at`, `generation` | Exclusión de escritores para el agente lógico único |

Cada registro debe incluir referencias a commit, Issue/PR, informe o evidencia
no secreta cuando aplique. El payload se valida por tipo y tamaño. No guardar
contraseñas, tokens, cookies, datos personales, transcripciones con secretos,
`service_role`, URLs de conexión ni claves root en ninguna tabla del cerebro.

## Ciclo de vida de una sesión

1. **Bootstrap:** autenticar el cliente; recuperar el snapshot actual, última
   sesión no cerrada, tarea activa, decisiones vigentes y los pocos playbooks
   coincidentes con el objetivo. La respuesta debe ser un paquete compacto y
   ordenado, no una descarga indiscriminada de toda la historia.
2. **Claim:** llamar a una RPC transaccional que reclama `brain_lease` como
   singleton. Si otro lease vigente existe, la sesión no modifica estado y
   muestra el handoff vigente. No arrancar un segundo agente para continuar.
3. **Trabajo:** registrar intención antes de operaciones con efectos; después
   guardar observación y evidencia. Cambios del snapshot usan número de versión
   para evitar escrituras obsoletas.
4. **Heartbeat:** renovar el lease con frecuencia controlada. Si la sesión cae,
   el lease expira tras un margen; la siguiente sesión reclama el siguiente
   `generation`, carga el log y continúa. La expiración no cancela ni revierte
   una acción remota ya iniciada: primero hay que consultar su resultado.
5. **Handoff:** guardar objetivo, estado, operaciones concluidas, resultados,
   bloqueos, estado de servicios consultado, riesgos y próximo paso concreto.
   Marcar la sesión como `handed_off` y liberar lease. La notificación Realtime
   queda pendiente de una integración y prueba separadas.
6. **Recovery:** detectar un lease vencido, no inferir que la última acción
   falló. Consultar el sistema externo y reconciliar antes de repetir una
   operación potencialmente no idempotente.

La RPC de claim debe usar una transacción/lock de base de datos y un contador
monótono de generación para evitar que una sesión vieja que reaparece escriba
después de perder el lease. Deben probarse simultaneidad accidental, expiración,
reintento, doble invocación, caída entre efecto externo y registro del resultado
y reconexión. Un mutex solo en frontend no basta.

## Seguridad y operaciones administrativas

- RLS deniega todo acceso anónimo; la identidad del agente solo obtiene
  operaciones de memoria que necesita. La escritura de eventos se valida y
  audita. La lectura del cerebro no implica acceso a apuestas ni Auth de
  usuarios.
- No guardar root, `service_role`, contraseña SQL ni credenciales reutilizables
  en Supabase Brain, Git, prompts, MCP responses, memoria de contexto, logs o
  snapshots de navegador. Un archivo local ignorado tampoco es un vault ni un
  mecanismo seguro de continuidad entre sesiones.
- El agente no obtiene root para recuperar conexión. La reconexión se hace con
  identidad no privilegiada renovable. Operaciones de administración se exponen
  solo como acciones específicas, con validación de parámetros, autorización
  explícita, idempotencia cuando sea posible, límites, auditoría y aprobación
  del propietario en operaciones sensibles. No proporcionar SQL arbitrario ni
  acceso de consola al agente.
- Si se requiere un secreto privilegiado para una migración, el runner
  controlado lo obtiene desde un secret manager fuera del contexto del modelo y
  aplica una migración revisada; no lo devuelve al agente. Una desconexión
  requiere nueva autenticación bajo la política del proveedor, no persistencia
  de una sesión root en memoria.
- Mantener separado el permiso de recordar un procedimiento y el permiso de
  ejecutarlo. La memoria puede orientar; la API vuelve a autorizar cada acción.
- Proteger datos QA: limitar retención y acceso, evitar datos personales y
  preparar una tarea de borrado al retirar el proyecto temporal. La arquitectura
  y playbooks no deben depender de credenciales, IDs de usuarios de prueba o
  identificadores del Supabase descartable.

## Conocimiento y aprendizaje acumulativo

Un método resuelto se incorpora como playbook con:

```text
Síntoma:
Entorno y versión:
Causa confirmada o hipótesis:
Pasos reproducibles:
Resultado observado:
Evidencia no secreta:
Confianza: confirmado | probable | no reproducido
Última verificación:
```

Separar siempre hipótesis de causa probada. Un fallo sin solución se guarda como
bloqueo, con intentos hechos y salida observada, para no repetirlos a ciegas.
Los hallazgos nuevos se revisan, se marcan como reemplazados en vez de borrarse,
y se promueven al índice cuando se vuelven útiles.

El snapshot incluye solo:

- misión vigente y criterio de éxito;
- tarea y estado de la única sesión;
- entorno actual y última consulta fechada;
- decisiones vigentes y restricciones;
- pruebas recientes, conciliación y bloqueos;
- rutas a informes/playbooks relevantes;
- siguiente acción única.

El snapshot local equivalente, `SESSION-STATE.md`, usa la misma estructura y
es la fuente de arranque hasta que la nueva sesión verifique que el bootstrap
remoto está operativo.

## Métricas de aceptación

El cerebro estará listo para sustituir el fallback documental solo cuando:

1. Una sesión limpia puede recuperar el objetivo y el próximo paso sin
   transcripción previa ni repetición de instrucciones del propietario.
2. Un proceso de trabajo secuencial impide dos escritores simultáneos,
   recupera un lease vencido y documenta cada claim/handoff.
3. Tras cerrar/reabrir la sesión y reconectar a Supabase, el agente continúa
   desde el último evento confirmado y no repite operaciones de resultado
   incierto.
4. Las credenciales y secretos nunca aparecen en respuestas, eventos,
   snapshots, logs ni telemetría.
5. Una acción no permitida es rechazada aunque el agente la solicite; RLS y las
   RPC mantienen los límites tras expiración y reconexión.
6. Las pruebas QA y estadísticas quedan reproducibles por versión/semilla y
   concilian con el ledger.
7. El cerebro puede exportarse e instalarse en un proyecto Supabase nuevo sin
   copiar cuentas, datos personales, apuestas, secretos ni permisos temporales.

## Estado de implementación

- Git contiene este diseño portable y la documentación de fallback.
- La migración local define persistencia, bootstrap, lease, heartbeat,
  control de versión, handoff y búsqueda de playbooks. `pglast` analizó sus 51
  sentencias PostgreSQL de nivel superior, pero no valida los cuerpos
  PL/pgSQL ni sustituye una ejecución en PostgreSQL.
- Existe una interfaz en `cerebro-agentes.html` para invocar las RPC con la
  sesión Auth existente y el rol `ai_auditor`. Se publicó en Vercel Preview,
  pero Deployment Protection redirige a SSO; no se validó todavía con Auth real.
- El propietario confirmó que el proyecto actual es QA descartable. La
  migración se aplicó desde SQL Editor en `frbnaypbmwahbytxqzwl` (rama `main`,
  etiquetada `Production`) dentro de una transacción. No se usó `service_role`
  desde el cliente.
- Las RPC se probaron en transacciones revertidas con el rol `ai_auditor`:
  bootstrap, claim, heartbeat, guardado/versionado, append, búsqueda y handoff;
  además exclusión, expiración/recuperación, fencing de escritor antiguo,
  rechazo de usuario sin rol y bloqueo de payload sintético con clave
  `password`. El estado persistente quedó en versión 0, sin sesiones/eventos y
  con lease libre; las cuatro tablas tienen RLS.
- Los permisos revisados confirman que `authenticated` puede ejecutar el
  bootstrap, `anon` no; las tablas no son legibles directamente por
  `authenticated`/`service_role` y el helper interno no es ejecutable por
  `authenticated`.
- La interfaz web está desplegada en Preview y protegida por SSO de Vercel; no
  se probó con una sesión Auth real. No existe integración MCP/CLI. La arquitectura depende de
  `jva_user_roles` y del rol `ai_auditor` de esta aplicación, por lo que aún no
  se puede reutilizar sin adaptación desde otros proyectos Supabase.
- `supabase_migrations.schema_migrations` no existe en el proyecto. El SQL
  Editor no registró esta migración en historial de CLI. Antes de usar
  `supabase db push`, reconciliar el historial completo; no marcar solo esta
  migración ni ejecutar todas las anteriores a ciegas.
- El diseño actual depende de `jva_user_roles` y del rol `ai_auditor` de esta
  aplicación; no es aún una instalación portable para proyectos Supabase
  independientes.

## Parámetros de lectura/escritura del contexto

Cuando se implemente el servicio, bootstrap devolverá un paquete compacto con
tamaño configurable (meta inicial: 8–12 KB de contexto útil, sin metadatos
estructurados). Ordenará por vigencia, relevancia para la tarea y calidad de
evidencia; se podrán solicitar detalles por ID. No devolverá toda la historia
por defecto.

Toda escritura del snapshot usará control optimista (`expected_version`) y
devolverá conflicto si ya se aplicó una actualización posterior. Los eventos
serán append-only, con tipo y tamaño validados. Los hechos operativos requieren
`observed_at`, entorno, fuente y nivel de confianza. Intención y resultado
confirmado se guardan como tipos distintos. Secretos se rechazan por esquema y
allowlist y no se indexan.
