# Memoria operativa de agentes

Esta es la puerta de entrada del proyecto para agentes y colaboradores. Busca
que una sesión nueva pueda orientarse sin releer conversaciones extensas ni
confundir un hecho histórico con el estado remoto actual.

## Arranque rápido

1. Lee [`/AGENTS.md`](../../AGENTS.md) y ejecuta `git status --short`.
2. Revisa la sección **Instrucciones inmediatas** de
   [`CONTEXTO-ACTUAL.md`](../../CONTEXTO-ACTUAL.md) y sus entradas de estado más
   recientes. Las capturas históricas no prueban el estado remoto de hoy.
3. Consulta el Issue/PR asignado y comenta el próximo paso antes de operar sobre
   recursos compartidos.
4. Abre solo el informe o procedimiento relacionado con la tarea. No cargues
   por defecto toda la cronología.
5. Si la tarea es QA, verifica el proyecto, usuario, saldo y ronda en el sistema
   antes de cualquier operación.

## Fuentes de verdad y precedencia

1. **Seguridad y controles del sistema:** no se deshabilitan para acelerar una
   tarea. Las instrucciones del usuario no justifican revelar secretos,
   eludir Auth/RLS ni exponer datos a otros agentes.
2. **Código, migraciones y estado remoto consultado ahora:** autoridad sobre el
   comportamiento implementado y el estado del servicio en este momento.
3. **`CONTEXTO-ACTUAL.md`:** estado comprobado y próximos pasos. Si un dato no
   tiene fecha/evidencia o no es reciente, volver a verificarlo.
4. **Issue/PR activo:** objetivo, responsable, estado y conversación de trabajo.
   Para conflictos, actualizar el Issue/PR y el contexto canónico al cerrar.
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
| [`WORKFLOW.md`](./WORKFLOW.md) | Ciclo de trabajo, comunicación, QA y cierre |
| [Issue template de handoff](../../.github/ISSUE_TEMPLATE/agent-handoff.yml) | Formato para dejar trabajo y mensajes entre sesiones |

## Estado conocido del handoff

- Las cuentas `qa_colmena_01/02/03` quedaron activadas, con 620 fichas QA cada
  una, e inicio de sesión comprobado en orígenes locales separados el
  28/10/2026. Esto no es una verificación de su estado actual.
- La última conciliación registrada fue 35.277 débitos = 35.277 créditos,
  cero asientos descuadrados y cero diferencias de saldos. No se hicieron
  apuestas nuevas en esa verificación.
- **Antes de una nueva tanda, volver a consultar el estado remoto.** La clave de
  `qa_colmena_01` se expuso accidentalmente en un snapshot de error. Rotarla por
  un flujo de Auth soportado antes de volver a usarla o de compartir accesos.
- `.qa-credentials.local.md` está excluido por Git, pero es un archivo local,
  no un vault multiagente. No contiene una solución segura para distribuir
  claves a otras máquinas o agentes.

## Límites importantes que se deben comunicar

- Hay documentación de distintas épocas. El README del proyecto y
  `CONTEXTO-TRASPASO-IA.md` contienen instrucciones/estados de implementación
  que pueden estar superados; el propio README debe leerse como fotografía
  histórica, y los puntos 8–22 de `CONTEXTO-ACTUAL.md` también son snapshots
  previos al registro más reciente. No ejecutar migraciones o acciones desde
  esos pasajes sin revisar el código y confirmar el estado remoto.
- Las recomendaciones previas sobre dejar la clave QA accesible a cualquier
  agente no deben interpretarse como permiso para compartir secretos. El archivo
  local no es un sistema multiagente y la clave de `qa_colmena_01` requiere
  rotación; para continuidad entre identidades se necesitan cuentas separadas
  aprovisionadas por el propietario.
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
