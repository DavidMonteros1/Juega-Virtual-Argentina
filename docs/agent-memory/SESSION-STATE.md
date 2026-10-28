# Estado de sesión — handoff canónico

> **Lectura de arranque:** este archivo es el snapshot compacto de la sesión.
> Actualizarlo al cambiar objetivo, estado o siguiente acción. No guardar aquí
> secretos ni copiar todo el historial.

**Actualizado:** 2026-10-28 16:32 -03:00
**Estado:** Brain aplicado en QA; RPC verificadas; Preview publicada y protegida por SSO, login Auth de la app pendiente.
**Fuente de continuidad:** workspace compartido y tablas/RPC del Brain en Supabase QA `frbnaypbmwahbytxqzwl`.

## Misión activa

Completar el uso del Brain central por sesiones reales de agentes. Las tablas y
RPC están aplicadas en el Supabase QA actual; falta acceder a la Preview y
probar la interfaz con Auth real. El Dashboard identifica
`frbnaypbmwahbytxqzwl`, rama `main`, como `Production`, aunque el propietario
confirmó que es QA descartable.

Dejar al próximo agente preparado para auditar juegos y finanzas, crear un juego
arcade original de vuelo con obstáculos y repetir las pruebas, entregando un
informe pre/post reproducible.

## Confirmado

- El propietario aclaró que los agentes de este entorno comparten workspace y
  trabajan secuencialmente. Git no es el canal de comunicación entre estas
  sesiones; no se necesita push para que los documentos locales se conserven en
  este mismo entorno.
- El diseño portable del cerebro está en
  [`CENTRAL-BRAIN.md`](./CENTRAL-BRAIN.md). Describe snapshot, eventos,
  versiones, tarea única, lease, heartbeat, recovery y criterios de aceptación.
- El prompt de inicialización ya existe:
  [`iniciar-sesion-cerebro.prompt.md`](../../.github/prompts/iniciar-sesion-cerebro.prompt.md).
- El prompt de tarea listo para ejecutar es
  [`auditoria-integral-y-nuevo-juego.prompt.md`](../../.github/prompts/auditoria-integral-y-nuevo-juego.prompt.md).
- La simulación amplia predeterminada es local y determinista (10 participantes
  virtuales × 100 apuestas por juego, tres bandas de stake legales); no dispara
  1.000 transacciones por juego en Supabase. La integración remota QA es pequeña
  y requiere verificar el entorno.
- El snapshot que debe leer primero una sesión nueva es este archivo; al cierre
  de cada sesión se actualiza con un único siguiente paso.
- El fallback documental se mantiene en `CONTEXTO-ACTUAL.md` y
  `MEMORIA-COLMENA.md`; el detalle histórico permanece en informes y
  `HISTORIAL-PROYECTO.md`.
- El archivo de credenciales local se excluye por Git. No inspeccionarlo como
  parte del bootstrap ni copiar sus valores. La contraseña QA expuesta requiere
  rotación antes del próximo login, según el contexto vigente.
- El Dashboard identifica `frbnaypbmwahbytxqzwl`, rama `main`, como
  `Production`. El propietario confirmó expresamente que es un entorno QA
  descartable y autorizó aplicar la migración y probarlo; no usarlo como
  producción real ni extender la autorización a otros proyectos.
- El usuario eligió mantener el Brain en el Supabase actual, en lugar de crear
  otro proyecto. La migración depende del rol `ai_auditor` y del esquema de la
  aplicación; no permite todavía reutilizarlo desde otros proyectos Supabase.
- El preflight de esta sesión pasó `npm run build`; `package.json` no define
  `test`/suite automatizada. GET de la lotería local, Admin publicado y Lotería
  Preview devolvió HTTP 200. El recorrido de arranque documental se validó
  siguiendo prompt raíz → README → snapshot → playbook y ampliando contexto por
  necesidad. Ese preflight por sí solo no probaba el Brain remoto; las pruebas
  SQL posteriores de esta sesión sí validaron las RPC en transacciones revertidas.
- Se probaron con una sesión `qa_colmena_01`: Crash apuesta 4, pérdida a 2,36×;
  Tragamonedas apuesta 4, sin premio; Ruleta apuesta 4, premio 5 (neto +1);
  Minas dos partidas de 4, ambas mina/pérdida. Saldo 620→605. Se ejercitaron
  caminos de pérdida y premio, pero no cashout de Crash/Minas.
- En otra sesión QA `qa_multi_01`, Lotería vendió un único cartón #101 por 10
  fichas en el sorteo #8; la ronda se liquidó sin premio. Jackpot #8 tuvo una
  sola entrada de 10 y pagó 7; saldo 534→521. Ambos sorteos quedaron cerrados;
  no hubo premio reclamable en Lotería.
- Resultado final Admin (2026-10-28 15:55): débitos 35.329 = créditos 35.329,
  0 asientos descuadrados, 0 diferencias de saldos; caja 15.789, ganancias de
  casa 2.065, billeteras 16.299, 576 asientos, 356 apuestas y 101 cartones.
  Fondos disponibles: Crash 251, Dados 0, Jackpot 0, Lotería 663, Minas 213
  (50 reservadas), Tragamonedas 684, Mesas 0 y Ruleta 564. No quedaron sorteos
  abiertos ni rondas activas.
- El lobby no expone Mesas entre los siete juegos; `js/mesas.js` usa escrituras
  directas y no atómicas sobre `usuarios.fichas`/`movimientos_fichas`. No se
  crearon mesas ni se arriesgó una inconsistencia contable.
- Admin muestra que la función de archivo/retiro de cuentas requiere aplicar
  una migración Supabase pendiente. No se debe aplicar sin comprobar la
  migración y el alcance; esta limitación no bloquea la lectura del resumen.

## Verificaciones pendientes

- La migración `20261028160500_jva_agent_brain.sql` se aplicó en SQL Editor
  dentro de una transacción. `pglast` parseó sus 51 sentencias superiores.
- Con claims simulados en SQL Editor para una identidad existente con rol
  `ai_auditor`, pasaron bootstrap y el ciclo claim → heartbeat → save/version →
  append → search → handoff dentro de una transacción revertida.
- También pasaron pruebas revertidas de lease exclusivo, expiración y recovery,
  fencing de una sesión anterior, rechazo de usuario sin `ai_auditor` y
  rechazo de payload sintético con clave `password`. Tras rollback: versión 0,
  cero sesiones/eventos, lease libre, 4 tablas con RLS. Permisos revisados:
  `authenticated` ejecuta bootstrap, `anon` no; no hay lectura directa de
  tablas para `authenticated`/`service_role`.
- La interfaz `cerebro-agentes.html` ofrece bootstrap, claim, heartbeat,
  snapshot, eventos, búsqueda y handoff. El build local pasa y Vercel Preview
  terminó exitosamente, pero Deployment Protection redirige a SSO. No se probó
  la página con sesión Auth real. No hay integración MCP/CLI.
- El esquema `supabase_migrations.schema_migrations` no existe; la aplicación
  manual no quedó registrada por Supabase CLI. No ejecutar `supabase db push`
  hasta reconciliar el historial completo de migraciones.
- Dados no se apostó porque su fondo disponible es cero. Mesas/multijugador no
  se probaron por falta de ruta de acceso en el lobby y por el flujo legacy no
  atómico. No se validaron los caminos de cashout de Crash/Minas ni un premio
  reclamable de Lotería; se probaron premio en Ruleta y pago Jackpot.
- El panel Admin aún avisa que archivar/retirar cuentas requiere una migración
  pendiente; no se aplicó ni se probó esa función.
- No se ha incorporado la interfaz al flujo publicado de los agentes; el backend
  sí está desplegado en la base QA.

## Cambios locales de esta sesión

- Se creó el prompt `/auditoria-integral-y-nuevo-juego` con fases pre/post,
  informe obligatorio, límites de pruebas remotas y juego arcade score-only.
- Se afinó `/iniciar-sesion-cerebro` para leer el snapshot antes de documentos
  profundos, y cargar `WORKFLOW.md`/`CENTRAL-BRAIN.md` solo cuando haga falta.
- Se eliminó `ejemplo.js`, que estaba tracked, vacío (0 bytes) y sin referencias
  encontradas. No se borraron los artefactos legacy ignorados del usuario.
- Se creó `ARCHIVE-INDEX.md` con clasificación y plan seguro de limpieza.
- Se creó `supabase/migrations/20261028160500_jva_agent_brain.sql`; correcciones
  de validación de parámetros y contexto dinámico. `pglast` parseó las 51
  sentencias de nivel superior; se aplicó en QA y sus RPC se ejecutaron con
  transacciones revertidas.
- Se añadió la interfaz local `cerebro-agentes.html` y su cliente para
  bootstrap, claim, heartbeat, snapshot, eventos, búsqueda y handoff; se enlazó
  desde Auditoría y se incluyó en Vite.
- Se actualizó `CENTRAL-BRAIN.md` y este snapshot para dejar claro el estado
  real, las pruebas remotas y el desajuste entre el nombre de rama QA y la
  etiqueta `Production`.
- Validación de esta iteración: `npm run build`, `git diff --check`,
  diagnósticos del editor y parseo PostgreSQL pasaron.
- Se aprendió a preparar `request.jwt.claims` antes de `SET LOCAL ROLE
  authenticated` en pruebas del SQL Editor: hacerlo después oculta
  `jva_user_roles` por RLS y provoca un falso rechazo de `ai_auditor`. Las
  pruebas de escritura deben ir dentro de `BEGIN`/`ROLLBACK`.
- Se ejecutaron solo flujos QA soportados; no se cambió código de juego ni
  configuración financiera.
- Commit `89ea515` publicado en la rama `feature/agent-brain-preview`. Vercel
  reportó Preview exitosa; no se abrió PR ni se tocó `main`. La URL requiere SSO
  de Vercel, así que falta la validación Auth real de la app.

## Próximo paso único

Acceder con Vercel SSO a la Preview de `feature/agent-brain-preview` y probar
`cerebro-agentes.html` con una sesión Auth real `ai_auditor`; no hacer merge a
`main` ni desplegar a Production.
