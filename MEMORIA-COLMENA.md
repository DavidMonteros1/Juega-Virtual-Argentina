# Memoria colmena de agentes — Juega Virtual Argentina

**Actualizada:** 28 de octubre de 2026
**Repositorio:** `DavidMonteros1/Juega-Virtual-Argentina`
**Propósito:** conservar conocimiento operativo verificado y evitar que cada
agente repita diagnósticos ya resueltos.

## Lectura obligatoria al comenzar

1. Revisar `git status --short` y la rama antes de editar o ejecutar pruebas.
2. Leer [CONTEXTO-ACTUAL.md](./CONTEXTO-ACTUAL.md) para el estado y prioridades.
3. Leer este archivo para protocolos y problemas ya resueltos.
4. Leer el informe que corresponda a la tanda de trabajo. La prueba del
   28/10 está en
   [INFORME-AUDITORIA-MULTIJUGADOR-2026-10-28.md](./INFORME-AUDITORIA-MULTIJUGADOR-2026-10-28.md).
5. Leer [HISTORIAL-PROYECTO.md](./HISTORIAL-PROYECTO.md) para hitos y decisiones.
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
local, completar activación y saldo por Caja de Administración y verificar
login. Las cuentas fueron registradas pero al cierre de esta memoria su
activación, financiación y login aún necesitan validación. Las notas históricas
que recomendaban no iniciar sesión en cuentas QA quedan supersedidas por el
pedido directo de continuar las pruebas con estas cuentas.

Creación de `qa_colmena_01/02/03` verificada el 28/10 por redirección al login
con aviso “Cuenta creada” y por aparición de los tres usuarios en Admin con
saldo 0 y “Pendiente de activación”. Las credenciales están protegidas en el
archivo local, pero no se verificó un inicio de sesión exitoso. Al intentar
activar la primera cuenta, Playwright encontró el botón `data-action="activate"`
pero agotó el tiempo esperando que fuera visible/estable; por lo tanto ninguna
cuenta debe considerarse activada. Próximo agente: desplazar la tarjeta al área
visible, activar por el botón normal de Administración, confirmar el estado y
hacer el depósito QA. No repetir registro ni inferir activación.

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

## Memoria de comunicaciones entre agentes

Este bloque es un **foro/bitácora persistente versionada**, no un sistema de
mensajería en vivo. Añadir entradas al final; no borrar ni reescribir decisiones
anteriores. Para coordinación realmente asíncrona y notificaciones se requiere
un servicio con identidad/autorización y almacenamiento compartido; un Markdown
por sí solo no avisa a agentes activos.

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
  archivo local ignorado. Siguiente paso: activar, acreditar QA por Caja,
  comprobar tres logins y ejecutar la siguiente ronda según el plan, conciliando
  por cuenta antes de abrir nuevas rondas.
- Continuidad/documentación compartida publicada en `eb398fd`. Las nuevas cuentas
  se comprobaron en Admin pero siguen en estado pendiente de activación y saldo;
  el primer intento Playwright de activar quedó en timeout de visibilidad.

## Protocolo para mantener esta memoria

- Registrar solo hechos demostrados, indicando fecha, entorno, fuente y qué
  queda pendiente. Distinguir “hecho en sesión” de “estado vivo confirmado”.
- Cada solución nueva requiere reproducibilidad o evidencia; describir
  mecanismo y verificación, no solo el síntoma.
- Al inicio/final de una tanda, actualizar `CONTEXTO-ACTUAL.md`; mantener
  informes de resultados separados y append-only en `HISTORIAL-PROYECTO.md`.
- Nunca guardar claves en reportes, issues, prompts de agentes, GitHub, memoria
  colmena o commits. No imprimir el archivo de credenciales en terminal.
- Mantener una tarea por agente, evitar dos agentes que operen las mismas
  cuentas/sorteos simultáneamente y registrar la titularidad/responsable en la
  bitácora antes de acciones con estado.
