# Memoria colmena de agentes — Juega Virtual Argentina

**Actualizada:** 28 de octubre de 2026
**Repositorio:** `DavidMonteros1/Juega-Virtual-Argentina`
**Propósito:** conservar conocimiento operativo verificado y evitar que cada
agente repita diagnósticos ya resueltos.

## Lectura obligatoria al comenzar

1. Revisar `git status --short` y la rama antes de editar o ejecutar pruebas.
2. Seguir el índice conciso
   [`docs/agent-memory/README.md`](./docs/agent-memory/README.md) y el Issue/PR
   activo; consultar `CONTEXTO-ACTUAL.md` para estado relevante.
3. Buscar en este archivo solo el procedimiento o problema relacionado con la
   tarea. No releer todos los informes en cada sesión.
4. Leer el informe que corresponda a la tanda de trabajo. La prueba del
   28/10 está en
   [INFORME-AUDITORIA-MULTIJUGADOR-2026-10-28.md](./INFORME-AUDITORIA-MULTIJUGADOR-2026-10-28.md).
5. Consultar [HISTORIAL-PROYECTO.md](./HISTORIAL-PROYECTO.md) solo para hitos y
   decisiones históricas relevantes.
6. Las credenciales QA nunca se escriben en Git ni en documentos versionados.
   Las nuevas cuentas `qa_colmena_01/02/03` tienen sus claves de acceso solo en
   el archivo local `.qa-credentials.local.md`; leerlo únicamente en esta
   máquina y no incluir su contenido en mensajes, commits, salidas de consola,
   capturas ni informes. Las claves de `qa_multi_01/02/03` no se conservaron y
   no se pueden recuperar desde Supabase.

## Mapa de autoridad y entornos

- GitHub contiene código/documentación; Vercel aloja la web; Supabase es la
  autoridad de Auth, sorteos, apuestas, resultados, billeteras y ledger.
- El proyecto QA `frbnaypbmwahbytxqzwl` y la web asociada se confirmaron durante
  la prueba autorizada. Verificar los destinos antes de cada operación; no
  confundirlos con otros proyectos o clones.
- Las fichas son de juguete. Los depósitos QA deben usar el flujo normal de
  Caja física con descripción de simulación. No afirmar que se movió efectivo.
- El rol `admin` de aplicación no es `service_role`, root SQL ni autorización
  para eludir RLS. Las apuestas y operaciones financieras se hacen con UI/RPC
  legítimas, nunca con escrituras SQL manuales.
- No cambiar probabilidades ni pagos según saldo individual, historial de
  pérdidas o gastos; no perseguir resultados ganadores. Reglas y cuotas deben
  permanecer fijas, explícitas y auditables.
- La cuenta humana `davidmonteros` fue expuesta en una conversación histórica:
  no usarla ni almacenar su clave; el propietario debe rotarla.
- El proyecto puede descartarse más adelante, pero no borrar datos ni el
  proyecto sin instrucción explícita en esa tarea.

## Estado QA más reciente

La ejecución multiusuario del 28/10 completó cinco sorteos de cada juego:
Lotería y Jackpot #3–#7; 93 cartones y 93 entradas totales. No queda sorteo
abierto ni reserva de esos juegos por esta tanda. Conciliación más reciente:
33.417 débitos = 33.417 créditos, 0 asientos desbalanceados y 0 balances
distintos del ledger. Saldos verificados de `qa_multi_01/02/03`: 534, 10 y 151.
El informe detallado tiene el desglose por cartón, sorteo, premio y balance.

Las claves de `qa_multi_01/02/03` no se conservaron. Supabase no puede mostrar
la contraseña original; la recuperación por correo no sirve porque el alta
usa direcciones sintéticas `@accounts.jva.invalid`. Por orden vigente del
propietario, continuar con `qa_colmena_01/02/03` usando las claves del archivo
local. Las notas históricas que recomendaban no iniciar sesión en cuentas QA
quedan supersedidas por el pedido directo de continuar las pruebas con estas
cuentas.

El estado inicial de creación (cuentas sin activar y saldo cero) quedó
subsanado: las tres cuentas se activaron en Administración, se acreditaron con
620 fichas QA por Caja y se comprobó el login de cada una en un origen aislado.
Cada lobby mostró la identidad correcta, saldo 620 y siete juegos. Los
orígenes comprobados fueron `127.0.0.1:4176` (`qa_colmena_01`),
`localhost:4177` (`qa_colmena_02`) y `127.0.0.1:4178` (`qa_colmena_03`).
No se hicieron apuestas nuevas ni se abrieron sorteos en esta verificación.
Estado remoto posterior: caja física 15.789, ganancias de casa 2.054, saldo de
billeteras 16.327; 567 asientos, 350 apuestas y 100 cartones. Libro: 35.277
débitos = 35.277 créditos, cero asientos desbalanceados y cero saldos distintos
del libro. No hay sorteos abiertos de Lotería o Jackpot por las tandas
anteriores. El próximo paso no es volver a activar/depositar/iniciar sesión:
consultar el estado remoto y continuar con la matriz de pruebas previamente
acordada, conciliando cada tanda.

Precaución: la contraseña de `qa_colmena_01` apareció en un snapshot de error
de una automatización de login anterior. No se repite en esta memoria. Antes
de compartir el archivo de credenciales fuera de esta máquina, rotarla con un
flujo Auth soportado y actualizar `.qa-credentials.local.md` sin imprimir el
valor. Los logins de las tres cuentas sí quedaron comprobados antes de cerrar
esta sesión.

## Procedimientos probados

### Alta de cuenta de QA

1. Crear la identidad con el formulario normal [`register.html`](./register.html)
   para que se ejecuten los metadatos/trigger de perfil y wallet.
2. Usar un `username` nuevo de 3–24 caracteres alfanuméricos o `_`, una clave
   aleatoria de al menos 8 caracteres y un teléfono de prueba internacional
   realmente único dentro del proyecto.
3. Si aparece “Database error saving new user”, comprobar primero el conflicto
   de unicidad `phone_e164`; reintentar solo con número de prueba nuevo. No
   repetir a ciegas el envío porque la primera cuenta puede haberse creado.
4. El flujo de registro abre una ventana para WhatsApp. Si la UI parece quedar
   esperando, no hacer clic repetidamente: comprobar estado/error y si Auth ya
   contiene el usuario; en la automatización usada se resolvió enviando
   `form.requestSubmit()` y esperando el resultado.
5. Usar para el alta un origen de navegador separado de las sesiones existentes.
   El registro cierra su sesión local si se creó automáticamente. No hacer el
   alta en el origen que contiene la sesión administrativa.
6. Comprobar usuario en Admin/Auth, activarlo por el panel si figura pendiente,
   depositar el saldo de prueba por Caja con descripción inequívoca y verificar
   el wallet/ledger antes de abrir apuestas.
7. Credenciales nuevas solo en `.qa-credentials.local.md`, ya excluido por
   `.gitignore`. Confirmar con `git check-ignore -v .qa-credentials.local.md`
   y comprobar que el archivo no aparece en `git status` antes de commit/push.

### Sesiones simultáneas y compras

- `localStorage` de Auth es por origen, no por pestaña: abrir otro tab con el
  mismo host/puerto reutiliza la sesión. Para sesiones distintas usar orígenes
  distintos previamente comprobados (por ejemplo `localhost` frente a
  `127.0.0.1`, otro puerto Vite disponible, o un deployment de Preview que no
  redirija a SSO). No usar un alias Vercel que pida SSO.
- Después de comprar Lotería, esperar a que `#buy-ticket` deje de estar
  deshabilitado y comprobar que “Mis cartones” aumentó exactamente en uno antes
  de otro intento. Un doble clic mientras se procesa puede no emitir otro
  cartón. Ante timeout, leer el estado remoto/historial antes de reintentar.
- Para Jackpot, observar el contador de entradas de la cuenta actual y esperar
  a que aumente en uno; no inferir éxito por el mensaje de confirmación antiguo.
- Una RPC `P0001: No hay un sorteo abierto` en preview Lotería representa el
  estado vacío esperado. El frontend actual lo muestra como aviso normal; no
  tratarlo como fallo ni esconder otros errores.

### Sorteo, premio y conciliación

1. Confirmar no existe un sorteo abierto; abrir ambos tipos solo por controles
   admin. No duplicar clicks mientras se espera la respuesta.
2. Antes de liquidar, verificar que el número de cartones/entradas concuerda
   con la matriz de esa ronda.
3. Liquidar Lotería y Jackpot por sus botones administrativos. Comprobar número
   de sorteo, resultado y fondos.
4. Los premios de Lotería quedan reservados/cobrables: iniciar sesión en la
   cuenta propietaria, reclamar cada ticket pendiente, esperar a que el botón
   se retire y confirmar saldo actualizado. No declararlos pagados por el solo
   hecho de que el sorteo esté liquidado.
5. Refrescar resumen financiero y libro contable. Verificar débitos = créditos,
   asientos desbalanceados = 0, saldos fuera del libro = 0, y reservas/sorteos
   QA cerrados.
6. Conciliar por jugador: saldo final = saldo de inicio + depósitos QA −
   compras/apuestas + premios cobrados − canjes. Revisar el ledger, no deducir
   el saldo desde la interfaz solamente.

## Soluciones verificadas a errores recurrentes

| Síntoma | Causa comprobada/probable | Acción que funcionó | Evitar |
|---|---|---|---|
| Auth informa error al registrar con contacto ya usado | `phone_e164` es único | Confirmar si el usuario se creó; usar un contacto ficticio nuevo | Repetir el envío con el mismo número |
| Registro parece colgado o abre WhatsApp | El flujo abre popup y luego registra | Comprobar Auth/error; `form.requestSubmit()` permitió terminar en la automatización anterior | Clics repetidos que puedan duplicar cuenta |
| Registro redirige al login y hay `POST /auth/v1/logout?scope=local` `ERR_ABORTED` | El redirect puede interrumpir el sign-out local del formulario | El mensaje “Cuenta creada” y el usuario listado en Admin confirmaron que el alta quedó; iniciar login manualmente con la clave local | Repetir registro por el error de red |
| Compra de cartón no refleja otro ticket | La emisión anterior aún está activa/procesándose | Esperar botón habilitado, verificar historial, reintentar una sola vez si el ticket no existe | Clic rápido o asumir éxito por un status stale |
| No hay cartón con permiso para cobrar tras sortear | El premio puede ser cero; los ganadores tienen reserva claimable | Inspeccionar historial de cada participante; cobrar únicamente si aparece premio pendiente | Esperar premio positivo en cada ronda |
| Saldo/pool en tabs difiere temporalmente | Estado UI no refrescado después de acción concurrente | Recargar el estado del juego y comparar con Admin/ledger | Usar capturas desactualizadas como saldo final |
| Jackpot/Lotería dice que no hay sorteo | No hay draw abierto | Abrir solo desde admin, si el plan de prueba lo requiere | Tratar como fallo de RPC y hacer llamadas repetidas |
| Alias Vercel solicita SSO | Alias o deployment restringido | Usar solo URL comprobada que abre directamente la app; verificar antes de apuestas | Probar aliases aleatorios |
| `npm run dev -- --host ... --port ...` pasa argumentos mal en PowerShell | La llamada al script se expandió de forma inesperada en esta sesión | Usar `.\node_modules\.bin\vite.cmd --host 127.0.0.1 --port <puerto> --strictPort` en PowerShell; probar HTTP antes de usarlo | Afirmar que el servidor está activo sin comprobar HTTP |
| Playwright `locator.click()` para activar una cuenta agotó el tiempo esperando estabilidad/visibilidad | El control de Admin no alcanzó una condición estable en el viewport; el estado no debía inferirse por el timeout | El clic del propio botón mediante `button.evaluate(b => b.click())` ejecutó la acción; confirmar inmediatamente el nuevo estado de la tarjeta y el saldo | Repetir clics sin comprobar el resultado, o tratar el timeout como prueba de que no hubo acción |
| Selectores de login no encontraban campos | `login.html` usa `#usuario` y `#contrasena`, no `#username` | Revisar el HTML; con los IDs correctos se validaron los tres logins y cada lobby mostró identidad y 620 fichas | Reintentar credenciales o imprimirlas al depurar selectores |

## Bitácora versionada y fallback actual

Hasta que se implemente el cerebro en Supabase, este bloque y los documentos
canónicos son el **fallback persistente**. El objetivo acordado es una única
línea de trabajo secuencial (mismo agente lógico en sesiones sucesivas), no un
foro para agentes en paralelo. Las entradas son append-only para conservar
evidencia; cuando algo queda superado, anotarlo explícitamente y actualizar el
índice canónico.

Formato de entrada:

```text
### YYYY-MM-DD HH:MM — agente/sesión
- Estado: hallazgo | pregunta | decisión | resuelto
- Evidencia: archivo/commit/consulta no secreta
- Acción o pregunta para el siguiente agente:
```

### 2026-10-28 — agente de auditoría QA

- Estado: resuelto.
- Evidencia: informe multijugador 28/10; commit `f1578da`; ledger conciliado.
- Acción siguiente: consultar remote state antes de apostar; no repetir sorteos
  #3–#7. Las contraseñas de `qa_multi_01/02/03` no existen en memoria local;
  no están recuperables desde Supabase. Se crearon `qa_colmena_01/02/03`
  mediante el registro legítimo y se guardaron sus claves únicamente en el
  archivo local ignorado. **Estado inicial supersedido por la validación de
  accesos anotada abajo:** en ese momento faltaban activación, depósitos y
  logins; no repetir esos pasos si el estado remoto sigue confirmado.
- Continuidad/documentación compartida publicada en `eb398fd`. Las nuevas cuentas
  inicialmente aparecieron pendientes. El primer intento Playwright de activar
  agotó el tiempo de visibilidad; el seguimiento posterior completó la activación
  y depósitos por Caja, como se anota abajo.

### 2026-10-28 — validación de accesos QA

- Estado: resuelto.
- Evidencia: Administración/Caja y los tres lobbies en orígenes separados;
  conciliación posterior con 35.277 débitos = 35.277 créditos, cero asientos
  descuadrados y cero diferencias de saldos.
- Acción siguiente: no repetir altas, activaciones ni depósitos. Los tres
  usuarios `qa_colmena_*` están activos con 620 fichas y login comprobado;
  consultar estado remoto, planificar la próxima matriz y conciliar después de
  cada tanda. Las credenciales siguen solo en `.qa-credentials.local.md`.
- Precaución: rotar la clave de `qa_colmena_01` mediante flujo Auth soportado
  antes de compartir credenciales fuera de este equipo; no imprimirla ni
  copiarla a la memoria.
- Solución que conviene conservar: los IDs correctos del formulario son
  `#usuario` y `#contrasena`. Los orígenes comprobados para sesiones paralelas
  son `127.0.0.1:4176`, `localhost:4177` y `127.0.0.1:4178`.

### 2026-10-28 — índice y flujo de continuidad multiagente

- Estado: la estructura documental fue publicada en `401a872`; el modelo de
  Issues como coordinación primaria quedó **supersedido** por la corrección del
  propietario descrita abajo.
- Evidencia: `AGENTS.md`, `.github/copilot-instructions.md`,
  `docs/agent-memory/README.md` y `docs/agent-memory/WORKFLOW.md`. Una plantilla
  de Issue se probó en esa iteración pero fue retirada al aclararse que el
  handoff debe permanecer en el mismo workspace y en la memoria central.
- Decisión: Markdown conserva memoria versionada, mientras Issues/PRs sirven
  para conversación asíncrona con acceso al repositorio. Los archivos no
  notifican por sí mismos a agentes activos.
- Guardrails: conservar Auth/RLS y mínimo privilegio; no compartir claves QA ni
  otorgar root/`service_role`; las pruebas estadísticas amplias empiezan en
  simulación aislada con reglas y semillas reproducibles, nunca ajustando
  resultados por historial individual.
- Validación: enlaces relativos verificados, `git diff --check` limpio y
  `.qa-credentials.local.md` confirmado como ignorado. No se pudo ejecutar un
  parser YAML porque no hay uno instalado; el template se revisó visualmente.
- Siguiente paso en ese momento: una implementación de memoria central. Esta
  nota conserva la propuesta inicial como antecedente; seguir la corrección
  secuencial documentada a continuación.

### 2026-10-28 — corrección: continuidad secuencial con cerebro central

- Estado: diseño documentado localmente; aún no implementado en Supabase.
- Objetivo confirmado por el propietario: un solo agente lógico trabajando de
  forma secuencial; cada sesión nueva recupera y continúa el trabajo de la
  sesión anterior. No dividir el proyecto entre agentes paralelos ni tratar
  Issues como cerebro.
- Evidencia del diseño: `docs/agent-memory/CENTRAL-BRAIN.md` propone memoria
  persistente en Supabase, bootstrap compacto, eventos append-only, snapshot,
  lease de escritor único, heartbeat, recovery y handoff. No afirmar que esos
  mecanismos están activos hasta implementarlos y probarlos.
- Decisión: Supabase Brain será la fuente operativa compartida; Git mantiene el
  código y los documentos revisables. Issues/PRs quedan como herramientas
  auxiliares de revisión humana.
- Límite: no guardar ni entregar al modelo credenciales root/`service_role`.
  La arquitectura contempla operaciones administrativas mediadas,
  allowlisted, auditadas y con secreto en un componente servidor separado.
- Siguiente paso: diseñar y revisar una migración portátil para el Supabase que
  reemplace al entorno temporal; no copiar usuarios, saldos, claves ni eventos
  financieros del proyecto descartable.

### 2026-10-28 — bootstrap y disciplina de lectura/escritura

- Estado: prompt raíz y parámetros documentales añadidos en el workspace; no
  hay cambios remotos.
- Evidencia: `.github/prompts/iniciar-sesion-cerebro.prompt.md`,
  `AGENTS.md`, `docs/agent-memory/README.md`,
  `docs/agent-memory/WORKFLOW.md` y `docs/agent-memory/CENTRAL-BRAIN.md`.
- Uso: iniciar una sesión nueva con `/iniciar-sesion-cerebro`; proporcionar
  objetivo si existe, o continuar el único siguiente paso del handoff.
- `docs/agent-memory/SESSION-STATE.md` es el snapshot de lectura inicial. No
  abrir toda la cronología para arrancar; expandir solo si la tarea necesita
  evidencia histórica concreta.
- Lectura: L0 instrucciones/estado Git/handoff; L1 sección actual y playbook
  aplicable; L2 informes o historia completa solo cuando resuelvan una pregunta.
- Escritura: actualizar contexto al cambiar el estado, memoria al confirmar
  método reusable e historial para hechos fechados append-only. Separar
  observación reciente, histórico, hipótesis y pendiente. Terminar con un solo
  siguiente paso.
- Límite: los documentos son persistentes en el workspace compartido, pero no
  implementan base de datos central ni locking. El objetivo inicial de 8–12 KB
  es solo el presupuesto de bootstrap futuro, no una medición de tokens ni un
  límite del sistema actual.

### 2026-10-28 — handoff de auditoría pre/post y juego arcade

- Estado: prompt de ejecución preparado; la auditoría y el juego aún no se
  ejecutaron.
- Evidencia: `.github/prompts/auditoria-integral-y-nuevo-juego.prompt.md`.
- Orden de fases: bootstrap → confirmar entorno → baseline financiera/UI →
  matriz QA acotada → fixes/regresión → arcade original de vuelo/obstáculos
  score-only → retest de misma matriz → conciliación e informe detallado.
- Para estadísticas amplias usar 10 participantes virtuales × 100 apuestas por
  juego en simulación determinista local con tres bandas legales de stake.
  Etiquetar modelos locales como aproximación si no reproducen exactamente RPC;
  no confundirlos con pruebas remotas ni crear mil apuestas reales por juego.
- Juego: no copiar assets/identidad de Flappy Bird y no añadir economía/premios
  en esta fase. Registrar determinismo, colisiones, puntuación, controles,
  accesibilidad y resultado financiero cero.
- Informe requerido:
  `INFORME-AUDITORIA-INTEGRAL-<YYYY-MM-DD>.md`, con snapshot inicial/final,
  trazas no sensibles por cuenta/juego, balances, conciliación, fallos/fixes,
  comparativa y limitaciones.
- Próximo paso: abrir nueva sesión con `/auditoria-integral-y-nuevo-juego`;
  si no se verifica QA aislado, continuar solo con simulación local y checks sin
  escritura.

### 2026-10-28 — limpieza conservadora de artefactos legacy

- Hallazgo confirmado: `ejemplo.js` estaba tracked, tenía 0 bytes y no tenía
  referencias en HTML o JavaScript; fue eliminado como stub inerte.
- Se creó `docs/agent-memory/ARCHIVE-INDEX.md` con estado de tracking y
  recomendación para cada archivo legacy.
- Los candidatos ignorados que pueden ser datos locales (`contexto-proyecto.md`,
  `codigo-total.md`, `main.py`, `ejemplo.html`) no se borraron. Confirmar valor
  con el propietario antes de eliminar archivos ignorados. `CONTEXTO-TRASPASO-IA.md`
  permanece tracked como histórico.

### 2026-10-28 — comprobación de continuidad local y smoke QA

- El flujo `/iniciar-sesion-cerebro` se pudo seguir desde las instrucciones raíz
  hasta `SESSION-STATE.md`, el índice y el playbook sin releer toda la cronología.
  Esto verifica handoff documental en el workspace compartido; no verifica el
  Brain remoto, que aún no tiene tablas/RPC/lease.
- Una tanda acotada con UI oficial y cuentas QA confirmó: Crash y Tragamonedas
  pueden liquidar pérdidas; Ruleta puede acreditar premio; Lotería puede emitir
  y liquidar cartón; Jackpot registra entrada y paga el premio. Al cierre,
  Admin mostró 35.329 débitos = 35.329 créditos, 0 asientos descuadrados y 0
  diferencias de saldos. Evidencia completa/fecha/saldos: punto 32 de
  `CONTEXTO-ACTUAL.md` y snapshot `SESSION-STATE.md`.
- Si Lotería devuelve `P0001: No hay un sorteo abierto`, es el estado esperado
  cuando no hay ronda: no comprar ni repetir la RPC; abrir una ronda únicamente
  desde Admin dentro de QA y verificar después el número de cartones.
- No ejecutar Mesas aún: no está en el lobby actual y
  [`crearMesa`](./js/mesas.js) / [`unirseAMesa`](./js/mesas.js) cambian el saldo
  con escrituras separadas antes de registrar al jugador. Requiere revisión
  transaccional/contable antes de probar apuestas multijugador.
- No repetir giros o rondas para buscar un resultado favorable. Dados se dejó
  sin apostar porque su fondo estaba en cero; cashout de Crash/Minas y un premio
  reclamable de Lotería quedan sin verificar.

## Protocolo para mantener esta memoria

- Registrar solo hechos demostrados, indicando fecha, entorno, fuente y qué
  queda pendiente. Distinguir “hecho en sesión” de “estado vivo confirmado”.
- Cada solución nueva requiere reproducibilidad o evidencia; describir
  mecanismo y verificación, no solo el síntoma.
- Al inicio/final de una tanda, actualizar `CONTEXTO-ACTUAL.md`; mantener
  informes de resultados separados y append-only en `HISTORIAL-PROYECTO.md`.
- Nunca guardar claves en reportes, issues, prompts de agentes, GitHub, memoria
  colmena o commits. No imprimir el archivo de credenciales en terminal.
- Mantener una sola sesión escritora del agente lógico. El lease/heartbeat del
  Brain está implementado en QA; hasta probar la interfaz con Auth real en
  Preview, conservar además un handoff documental explícito.

### 2026-10-28 — aplicación y pruebas transaccionales del Brain central

- En el Supabase QA `frbnaypbmwahbytxqzwl` (rama `main`, Dashboard etiquetado
  `Production`, propietario confirma que es descartable) se aplicó
  `20261028160500_jva_agent_brain.sql` desde SQL Editor dentro de
  `BEGIN`/`COMMIT`.
- Antes de aplicar, comprobar que las cuatro tablas no existían. Después se
  verificaron: versión 0, cero sesiones/eventos persistentes, lease libre, RLS
  habilitado en las cuatro tablas, RPC bootstrap ejecutable por
  `authenticated` pero no por `anon`, tablas no legibles directamente por
  `authenticated`/`service_role` y helper interno no ejecutable por
  `authenticated`.
- El ciclo completo bootstrap/claim/heartbeat/save-state/append/search/handoff
  pasó dentro de transacción terminada en `ROLLBACK`. También pasaron
  exclusión de segundo escritor, recuperación tras expiración, fencing del
  escritor viejo, rechazo de usuario sin `ai_auditor` y rechazo de payload
  sintético con clave `password`. Esto valida funciones bajo claims simulados
  en SQL Editor; falta validar el cliente con sesión Auth real.
- Para simular identidad en el SQL Editor: primero `set_config('request.jwt.claims', ...)`
  como rol propietario, luego `SET LOCAL ROLE authenticated`. Poner el cambio
  de rol antes oculta `jva_user_roles` por RLS y provoca un falso rechazo.
  Finalizar toda prueba que reclame/escriba con `ROLLBACK`.
- El proyecto no tiene `supabase_migrations.schema_migrations`; aplicar desde
  SQL Editor no registra la versión para CLI. No correr `supabase db push` ni
  crear una fila aislada: reconciliar el historial completo antes de adoptar
  CLI, porque hay migraciones antiguas manuales y al menos una anotada como
  pendiente.
- Existe una UI `cerebro-agentes.html`; `npm run build` pasó. El commit
  `89ea515` se publicó en `feature/agent-brain-preview` y Vercel reportó
  deployment exitoso. La Preview exige SSO de Vercel; falta acceder y probar
  login Auth real con rol `ai_auditor`. No se abrió PR ni se tocó `main`.
