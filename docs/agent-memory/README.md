# Cerebro compartido del agente lógico

Esta es la puerta de entrada a la continuidad del proyecto. Los agentes que
entran y salen son sesiones sucesivas del **mismo agente lógico**: una sesión
retoma del estado persistido por la anterior. No se planifica trabajo
multiagente en paralelo.

## Arranque rápido

1. Lee [`/AGENTS.md`](../../AGENTS.md) y ejecuta `git status --short`.
2. Ejecuta el prompt
   [`iniciar-sesion-cerebro.prompt.md`](../../.github/prompts/iniciar-sesion-cerebro.prompt.md)
   o sigue manualmente su secuencia.
3. Lee [`SESSION-STATE.md`](./SESSION-STATE.md) completo: es el snapshot
   compacto del último handoff.
4. Revisa solo la sección relevante y las entradas fechadas más recientes de
   [`CONTEXTO-ACTUAL.md`](../../CONTEXTO-ACTUAL.md). Las capturas históricas no
   prueban el estado remoto de hoy.
5. Consulta la memoria/procedimiento relacionado. En el Supabase QA actual, las
   RPC del Brain están aplicadas y probadas transaccionalmente; usa
   `cerebro-agentes.html` para bootstrap/lease/handoff en una sesión Auth real.
   La interfaz no está desplegada. En otros proyectos verifica primero el
   esquema, la autorización y el estado de migraciones.
6. Abre solo el informe relacionado con la tarea. No cargues
   por defecto toda la cronología.
7. Si la tarea es QA, verifica el proyecto, usuario, saldo y ronda en el sistema
   antes de cualquier operación.

## Fuentes de verdad y precedencia

1. **Seguridad y controles del sistema:** no se deshabilitan para acelerar una
   tarea. Las instrucciones del usuario no justifican revelar secretos,
   eludir Auth/RLS ni exponer datos a otros agentes.
2. **Código, migraciones y estado remoto consultado ahora:** autoridad sobre el
   comportamiento implementado y el estado del servicio en este momento.
3. **`CONTEXTO-ACTUAL.md`:** estado comprobado y próximos pasos. Si un dato no
   tiene fecha/evidencia o no es reciente, volver a verificarlo.
4. **Cerebro central:** estado de tarea, decisiones y handoffs append-only.
   Las tablas/RPC están implementadas en el Supabase QA actual y probadas
   transaccionalmente; la interfaz aún no está desplegada ni validada con Auth
   real. Consultar `CENTRAL-BRAIN.md` para los límites exactos.
5. **`MEMORIA-COLMENA.md`:** procedimientos reproducibles, errores y soluciones.
6. **`HISTORIAL-PROYECTO.md`, informes fechados, `README.md` y
   `CONTEXTO-TRASPASO-IA.md`:** evidencia histórica, no instrucciones para
   ejecutar hoy. Pueden contener estados o rutas superados.

La instrucción actual puede sustituir una preferencia histórica, pero no
convierte un permiso de aplicación en root ni autoriza a eliminar controles.

## Mapa documental

| Recurso | Uso |
|---|---|
| [`CONTEXTO-ACTUAL.md`](../../CONTEXTO-ACTUAL.md) | Estado y próximos pasos; verificar de nuevo los datos remotos |
| [`MEMORIA-COLMENA.md`](../../MEMORIA-COLMENA.md) | Soluciones verificadas, protocolo y bitácora técnica |
| [`HISTORIAL-PROYECTO.md`](../../HISTORIAL-PROYECTO.md) | Decisiones/hitos append-only |
| [`INFORME-AUDITORIA-MULTIJUGADOR-2026-10-28.md`](../../INFORME-AUDITORIA-MULTIJUGADOR-2026-10-28.md) | Informe de la tanda QA anterior |
| [`CONTEXTO-TRASPASO-IA.md`](../../CONTEXTO-TRASPASO-IA.md) | Archivo legado; consultarlo solo para una cuestión histórica concreta |
| [`WORKFLOW.md`](./WORKFLOW.md) | Ciclo secuencial de trabajo, handoff, QA y cierre |
| [`CENTRAL-BRAIN.md`](./CENTRAL-BRAIN.md) | Arquitectura portable propuesta para el cerebro en Supabase |
| [`SESSION-STATE.md`](./SESSION-STATE.md) | Snapshot compacto canónico para la siguiente sesión |
| [`ARCHIVE-INDEX.md`](./ARCHIVE-INDEX.md) | Clasificación del contexto/artefactos históricos y limpieza pendiente |
| [Prompt de inicialización](../../.github/prompts/iniciar-sesion-cerebro.prompt.md) | Flujo raíz de lectura, continuidad y cierre |
| [Prompt de auditoría integral y juego nuevo](../../.github/prompts/auditoria-integral-y-nuevo-juego.prompt.md) | Auditoría pre/post, trazabilidad financiera y juego arcade original |

Para el objetivo completo de auditoría y nueva implementación, el comando a
ejecutar es `/auditoria-integral-y-nuevo-juego`. Debe comenzar por el prompt de
inicialización (`/iniciar-sesion-cerebro`) y obedecer la fase de verificación de
entorno antes de cualquier operación remota.

## Estado conocido del handoff

- Las cuentas `qa_colmena_01/02/03` quedaron activadas, con 620 fichas QA cada
  una, e inicio de sesión comprobado en orígenes locales separados el
  28/10/2026. Esto no es una verificación de su estado actual.
- La conciliación QA más reciente (28/10/2026, ver punto 32 de
  [`CONTEXTO-ACTUAL.md`](../../CONTEXTO-ACTUAL.md)) fue 35.329 débitos =
  35.329 créditos, cero asientos descuadrados y cero diferencias de saldos.
  Es una captura de cierre de esa tanda, no sustituye refrescar Admin antes de
  cualquier nueva escritura.
- **Antes de una nueva tanda, volver a consultar el estado remoto.** La clave de
  `qa_colmena_01` se expuso accidentalmente en un snapshot de error. Rotarla por
  un flujo de Auth soportado antes de volver a usarla o de compartir accesos.
- `.qa-credentials.local.md` está excluido por Git, pero es un archivo local,
  no un vault multiagente. No contiene una solución segura para distribuir
  claves a otras máquinas o agentes.

## Límites importantes que se deben comunicar

- Los agentes de este entorno comparten workspace: los documentos locales
  persisten entre sesiones y no necesitan publicarse en Git para ser visibles
  aquí. Git versiona código/cambios; no es el canal de comunicación. El cerebro
  operativo compartido debe ser la base de datos descrita en `CENTRAL-BRAIN.md`.
- Hay documentación de distintas épocas. El README del proyecto y
  `CONTEXTO-TRASPASO-IA.md` contienen instrucciones/estados de implementación
  que pueden estar superados; el propio README debe leerse como fotografía
  histórica, y los puntos 8–22 de `CONTEXTO-ACTUAL.md` también son snapshots
  previos al registro más reciente. No ejecutar migraciones o acciones desde
  esos pasajes sin revisar el código y confirmar el estado remoto.
- Las recomendaciones previas sobre dejar la clave QA accesible a cualquier
  agente no deben interpretarse como permiso para compartir secretos root. La
  clave local de `qa_colmena_01` requiere rotación antes de otro uso.
- El rol `admin` del sitio es un rol de aplicación, no root SQL ni
  `service_role`. La petición de dar root irrestricto a todos los agentes no es
  compatible con el modelo seguro: se conserva Auth/RLS, auditoría y mínimo
  privilegio.
- No habilitar apuestas por SQL manual, desactivar políticas, eliminar
  restricciones ni añadir una ruta privilegiada para automatización.
- El análisis solicitado de resultados y fondos sí puede hacerse con datos QA,
  usando reglas fijas y simulaciones reproducibles. No optimizar resultados
  según saldo/gasto individual ni con objetivo de inducir juego compulsivo.
- El plan de 10 usuarios × 100 apuestas debe ejecutarse primero en un simulador
  aislado o entorno QA expresamente aprobado; no empezar una carga financiera
  remota sin una matriz y confirmación de estado. Reportar distribución,
  balances y desviación/intervalos, no solo el promedio.
