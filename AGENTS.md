# Instrucciones para agentes

Este archivo es la entrada obligatoria para cualquier agente que trabaje en el
repositorio. El índice operativo está en
[`docs/agent-memory/README.md`](./docs/agent-memory/README.md).
Para iniciar una sesión nueva, usa
[`iniciar-sesion-cerebro.prompt.md`](./.github/prompts/iniciar-sesion-cerebro.prompt.md).
El snapshot compacto y el siguiente paso viven en
[`SESSION-STATE.md`](./docs/agent-memory/SESSION-STATE.md).
La tarea grande de auditoría/juego está definida en
[`auditoria-integral-y-nuevo-juego.prompt.md`](./.github/prompts/auditoria-integral-y-nuevo-juego.prompt.md).
El inventario de archivos históricos y limpieza segura está en
[`ARCHIVE-INDEX.md`](./docs/agent-memory/ARCHIVE-INDEX.md).

## Inicio

1. Ejecuta `git status --short` y comprueba la rama. No sobrescribas cambios que
   ya estaban en el árbol de trabajo.
2. Sigue el prompt de inicialización del cerebro y lee únicamente las
   secciones necesarias. No cargues informes históricos completos por defecto.
3. La continuidad del trabajo pertenece al mismo agente lógico, aunque cambie
   la sesión. Lee `SESSION-STATE.md`; si el backend Brain está implementado,
   reclama su lease antes de operar. Hasta entonces usa el handoff local y no
   afirmes que hay bloqueo remoto. No iniciar agentes de trabajo paralelos.
4. GitHub Issues/PRs son respaldo para revisión de código, no la memoria
   operativa principal ni el mecanismo de continuidad entre sesiones.
5. Verifica el entorno actual antes de cualquier operación remota. La evidencia
   guardada en contexto no sustituye una consulta actual a Supabase/Vercel.

## Seguridad, QA y límites operativos

- Usa cuentas QA dedicadas solo cuando la tarea requiera una prueba autorizada.
  Las credenciales locales no son memoria compartida y nunca se copian a Git,
  issues, prompts, mensajes, capturas ni logs. `.qa-credentials.local.md` puede
  consultarse localmente solo para un login QA justificado; no lo reveles ni lo
  publiques. La contraseña de `qa_colmena_01` debe rotarse por la exposición
  accidental documentada antes de volver a usarla o compartir accesos.
- El cerebro central conserva contexto y procedimientos, no secretos root. No
  incorporar contraseñas, `service_role` o credenciales de base de datos a
  memoria, prompts o handoffs. Si una operación requiere un permiso superior,
  usar un flujo administrativo mediado, explícito y auditado; el secreto no se
  entrega al modelo.
- `admin` es un rol de la aplicación, no root, `service_role` ni permiso para
  eludir Auth/RLS. No añadir endpoints SQL genéricos, exponer claves
  privilegiadas, desactivar controles ni alterar manualmente el ledger.
- Para QA usa únicamente el entorno confirmado y los flujos oficiales de UI/RPC.
  No afirmes que fichas de prueba representan dinero real. No borrar datos,
  cambiar permisos o modificar sorteos sin verificar alcance y autorización.
- Reglas, probabilidades y pagos deben ser explícitos, fijos por versión y
  auditables. No adaptar resultados a saldo, gasto o historial de un jugador ni
  perseguir secuencias ganadoras. Simulaciones estadísticas deben ejecutarse
  fuera de Production, con parámetros y semilla reproducibles.

## Cierre

1. Ejecuta la validación más pequeña que cubra el cambio y reporta límites.
2. Actualiza `CONTEXTO-ACTUAL.md` solo cuando cambie el estado comprobado;
   registra procedimientos reutilizables en `MEMORIA-COLMENA.md` y conserva
   hitos históricos en `HISTORIAL-PROYECTO.md`.
3. Guarda el handoff en el cerebro central con resultado, evidencia, bloqueos y
   próxima acción. Issues/PRs pueden reflejar cambios que requieran revisión.
   No incluyas secretos ni afirmes verificaciones que no realizaste.
4. Antes de commit, verifica `git diff --check` y que
   `git check-ignore -v .qa-credentials.local.md` lo excluya. Nunca fuerces
   credenciales al índice.
