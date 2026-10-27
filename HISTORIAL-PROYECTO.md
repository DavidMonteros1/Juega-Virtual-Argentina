# Historial de implementación de Juega Virtual Argentina

Este archivo resume hitos desde Git y los cambios de producto importantes. No es
un registro de despliegues de Supabase ni sustituye al historial Git. Para el
estado operativo actual, consultar [CONTEXTO-ACTUAL.md](./CONTEXTO-ACTUAL.md).
Las migraciones se deben reconciliar con Supabase; un commit no prueba que SQL se
haya aplicado.

## Línea de tiempo resumida

### 16 de mayo de 2025 — legado inicial

El historial Git contiene la web anterior de mesas, chat, saldos y tragamonedas.
Ese código explica parte de la experiencia histórica, pero no es autoridad para
la nueva contabilidad: algunas operaciones legacy modificaban tablas de usuario y
movimientos desde el cliente, en varias llamadas separadas.

### Octubre de 2026 — reconstrucción con Supabase y economía transaccional

- `730dd7d` y cambios cercanos preparan Vite, proyecto Supabase y despliegues.
- `4981f0e`, `71c2280`: se rediseña la tragamonedas y se diferencia premio posible
  de fondo disponible.
- `cb62fe6`: se prepara el aviso de registro por WhatsApp.
- `e1ebbf0`: se añade archivo seguro de cuentas.
- `8f988e0`: rediseño inicial del lobby.
- `b5f4082`: se incorporan juegos arcade y administración de sus ajustes.
- `ed8a44a`, `d611f7b`: correcciones de configuración arcade y logs técnicos.
- `7e377a3`: transferencias auditadas desde ganancias de casa a fondos de juegos.
- `3de8295`: recuperación de rondas activas.
- `f540189`, `a1e5e90`: correcciones del flujo de entrada/estado de Jackpot.
- `b89f32e`: panel y RPC de auditoría del ledger.
- `b94b946`: animaciones y sonidos arcade, escenas visuales y cartones.
- `7a64c3c`: rediseño visual animado de lobby y toggle de sonido.
- `ac839bd`: artwork de Brix incorporado tras permiso afirmado por el usuario.
- `e7754e6`: fotos acreditadas de casino y sonido para lobby/juegos; arte y
  créditos documentados, sin reutilizar su sistema de saldo.

## Decisiones de arquitectura que no se deben perder

- GitHub es el repositorio de código; Vercel compila la web; Supabase es autoridad
  para identidad, datos, resultados, saldos y contabilidad.
- La app usa Vite multipágina y módulos ES, no se transpone a una SPA distinta sin
  razón. Los assets locales se referencian con `new URL(..., import.meta.url)`
  cuando JS requiere empaquetarlos.
- Las apuestas/premios se deciden con RPC y se registran en transacciones
  contables. CSS/JS del cliente puede animar, no decidir resultados.
- Los saldos son fichas ficticias enteras. Depósitos deben reflejar fichas físicas
  entregadas; no sembrar balances o caja para “hacer cuadrar” pruebas.
- Fondos de premios están separados por juego; una transferencia administrativa
  desde ganancias de la casa no debe tomar fichas físicas ni fondos de otros
  juegos.
- Juegos nuevos nacen pausados/ocultos. Visibilidad en lobby no equivale a que el
  backend esté listo o que exista reserva suficiente.
- Lotería actual 15/25 es un juego propio; no es Quiniela argentina ni Quini 6.
- Las mesas/chat legacy no se habilitan como si estuvieran migradas.
- Sin secretos o `service_role` en browser, empaquetado desktop, GitHub o contexto.

## Estado de pruebas/deploy conocido

- `npm run build` pasó en el workspace al revisar el contexto y también durante la
  preparación del panel de auditoría IA.
- En una verificación posterior al commit `e7754e6`, el deployment Vercel sirvió
  HTTP 200 para lobby, bundle y las nuevas imágenes. Esto no probó login, RPC,
  RLS ni finanzas.
- El README registra como aplicadas varias migraciones iniciales y arcade; otras
  se señalan como pendientes. No se inspeccionó remotamente la base en esta sesión.
- El propietario informó que otro agente obtuvo buenos resultados con pruebas,
  pero no se dispone de su matriz, logs o evidencia para reproducirlas.
- La nueva migración de auditoría de plataforma `20261026200000` se creó después
  de esos registros; no se debe asumir aplicada.

## Sesión actual — panel IA de auditoría controlada

Objetivo: hacer más accesible una auditoría amplia sin dar root ni permitir SQL
arbitrario en una web.

Se prepara una página no enlazada desde el lobby que:

1. exige sesión y rol verificado por una RPC del servidor;
2. permite `super_admin`, `admin` o el rol acotado `ai_auditor` consultar un
   informe de catálogos y conciliación;
3. muestra metadata de esquema, RLS/policies, índices, constraints, funciones,
   privilegios, triggers, extensiones y saldos conciliados;
4. refresca periódicamente, ofrece descarga JSON y conserva logs de interfaz por
   pestaña;
5. no admite SQL libre ni escrituras.

El rol dedicado no debe asignarse a una cuenta humana que ya posea `admin` o
`super_admin`, pues los roles son acumulativos. Para pruebas que cambian apuestas
o saldos se requiere Supabase de staging independiente y cuenta QA separada.
Eliminar un usuario después no revierte ledger ni transacciones.

### Actualización posterior — panel de auditoría read-only

- La migración `20261026200000_jva_readonly_platform_audit.sql` se aplicó al
  proyecto Supabase Production en esta sesión con autorización del propietario.
- Consultas de catálogo verificaron que la RPC existe, tiene las propiedades
  `STABLE SECURITY DEFINER`, el rol `authenticated` puede ejecutarla y `anon` no;
  la restricción `ai_auditor` también quedó confirmada.
- El commit `5600a10` se publicó en `main` y Vercel completó Production; la ruta
  `auditoria-ia.html` sirvió el contenido esperado.
- No se consultó el informe con un usuario auditor ni se realizaron apuestas.
  Sigue pendiente validar el informe con una cuenta QA separada.

### 27 de octubre de 2026 — auditoría y prueba QA autorizada

- Con autorización explícita del propietario se usó el proyecto Supabase
  `frbnaypbmwahbytxqzwl` asociado a
  `https://juega-virtual-argentina.vercel.app`, sin tocar otra aplicación.
- Antes de las jugadas, `ai_audiror` tenía saldo 0, únicamente `ai_auditor`,
  ninguna ronda activa; no existía `qa_test_issuance`. Se agregó temporalmente
  `admin` y se creó la cuenta fuente `qa_test_issuance` (`asset`, normal side
  `debit`). El asiento idempotente `qa_synthetic_credit` acreditó 5.000 fichas
  sintéticas al wallet; su descripción aclara que no representa efectivo.
- Pruebas ejecutadas por la interfaz real:
  - Tragamonedas: 10, pérdida.
  - Dados: 4, Bajo, pérdida confirmada. La pantalla arrojó
    `Cannot read properties of undefined (reading 'length')` al mostrar el
    resultado después de la escritura.
  - Ruleta: 4, segmento 10, multiplicador 1,60×, premio 6.
  - Minas: 4, una casilla revelada, mina encontrada, ronda `lost`.
  - Crash: 4, cayó en 1,12× antes de procesar el cobro, ronda `crashed`.
  - Lotería 15/25: ticket #5 comprado por 10 para el sorteo #1, que sigue abierto.
  - Jackpot: no apostado porque no existía sorteo abierto; no se creó ninguno.
- Tras las pruebas iniciales: wallet 4.970; roles solo `ai_auditor`; 0 rondas activas;
  ticket #5 pendiente; 0 entradas Jackpot; 0 diferencias de balances contra
  ledger y 0 asientos desbalanceados. La cuenta fuente QA conserva 5.000 y los
  movimientos permanecen para mantener trazabilidad.
- Se revocó el `admin` temporal en SQL Editor después de comprobar que no hubiera
  rondas activas. No se eliminó la cuenta ni se alteró el ledger para borrar el
  rastro; una eliminación del proyecto no está incluida en esta tarea.
- Se diagnosticó el error de Dados: el selector global `.arcade-wheel` encuentra
  la ruleta oculta incluida en el HTML compartido y el código intenta leer
  `settings.multipliers.length` en un juego que no tiene esa configuración. Se
  corrigió en `juegos/arcade/arcade.js`, limitando la selección al juego `wheel`.
  `npm run build` y `git diff --check` pasaron. Con autorización, el commit
  `4af2e79` se publicó en `main` y Vercel sirvió el bundle nuevo
  `arcade-B30OdaRm.js`. El retest de Dados apostó 4, obtuvo 42 y recibió 5 fichas
  (1,40×); la pantalla actualizó el saldo sin errores de consola. La conciliación
  posterior confirmó wallet 4.971, solo rol `ai_auditor`, 0 rondas activas,
  0 discrepancias y 0 asientos desbalanceados.

### 27 de octubre de 2026 — autorización continua del bucket de pruebas

- El propietario aclaró que este proyecto web y su Supabase son descartables y
  que, una vez terminadas las pruebas, planea borrar Supabase y limpiar el código
  para publicar desde cero. No borrar el proyecto/base ni los datos sin una orden
  concreta de eliminación.
- El propietario autorizó explícitamente a agentes futuros a usar el usuario
  `ai_audiror` con rol `admin`, el panel administrativo y los flujos económicos
  reales de la app para pruebas de acreditación, apuestas, retiros y canjes, con
  movimientos persistidos en el ledger. Esta instrucción reemplaza la limitación
  previa de solicitar nueva autorización para cada elevación temporal o prueba
  económica dentro de este bucket.
- Se reasignó `admin` a `ai_audiror`, manteniendo `ai_auditor`. Verificación
  remota posterior: roles `admin` y `ai_auditor`, wallet 4.971 fichas. Se abrió
  la página publicada de administración con la sesión de QA y confirmó acceso
  con ambos roles.
- En esta actualización no se hicieron acreditaciones ni canjes adicionales
  sobre otras cuentas: el usuario todavía no especificó usernames ni cantidades.
  Los depósitos físicos deben reflejar efectivo realmente recibido; si se trata
  de fondos de QA, no etiquetarlos como efectivo ni usar `physical_deposit` sin
  esa condición. Confirmar montos y cuentas antes de ejecutar movimientos.

### 27 de octubre de 2026 — depósitos y canjes simulados desde administración

- El propietario precisó que las fichas de juguete deben probar el flujo normal
  de Caja física: usar las cuentas y operaciones existentes (`physical_tokens`,
  `physical_deposit`, `physical_redemption`) aunque los fondos no representen
  dinero real. Cada asiento debe decir explícitamente que es dinero de juguete
  para QA; no describirlo como efectivo realmente recibido o pagado.
- Usando la sesión administrativa de `ai_audiror`, sin iniciar sesión como las
  cuentas destino, se acreditaron 500 fichas y luego se canjearon 100 en cada
  cuenta: `nuevonuevo`, `lodelchino` y `davidmonteros`. Los seis movimientos se
  hicieron desde el formulario del panel administrativo, no mediante SQL directo.
- Saldos posteriores: `nuevonuevo` 490, `lodelchino` 1.619 y `davidmonteros`
  1.256. Caja física pasó de 6.369 a 7.569; saldo agregado de billeteras pasó de
  9.139 a 10.339. Resumen financiero posterior: 289 asientos, 214 apuestas y
  5 cartones.
- Conciliación del ledger en la web: débitos 21.641 = créditos 21.641,
  0 asientos desbalanceados y 0 diferencias de saldos. Los motivos y las líneas
  muestran `physical_deposit`/`physical_redemption` y “Caja física”, con
  descripción explícita de dinero de juguete para QA.
- No se hicieron apuestas nuevas desde esas tres cuentas ni se usaron sus
  credenciales. Lotería #1 quedó abierta y no se liquidó para no afectar sus
  cartones preexistentes.
- Para completar la prueba de Jackpot se abrió el sorteo #2, `ai_audiror` compró
  una entrada de 10 fichas y administración lo liquidó. Fue el único
  participante y recibió el pozo de 7; 3 fichas se contabilizaron como ganancias
  de la casa. El pozo quedó en 0, sin sorteo abierto; el saldo de `ai_audiror`
  quedó en 4.968.
- Estado financiero final: Caja física 7.569, ganancias de la casa 914, total
  billeteras 10.336, 291 asientos, 215 apuestas y 5 cartones. Conciliación:
  21.658 débitos = 21.658 créditos, 0 asientos desbalanceados y 0 diferencias
  de saldos. La ronda arcade activa de `Vanesaflores` no se tocó.
- Durante la corrección contable se probó una etiqueta alternativa del ledger y
  se revirtió a pedido del propietario. Estado final remoto verificado:
  `jva_get_admin_ledger` contiene 0 rótulos “Fondo sintético de QA” y conserva
  las dos etiquetas “Caja física”. No quedan migraciones o cambios de UI de ese
  intento. El build local pasó, sin modificaciones funcionales pendientes.

### 27 de octubre de 2026 — acreditación de QA en todas las cuentas

- El propietario reiteró que las fichas de juguete deben usar el flujo normal
  de Caja física como si fueran operaciones reales, pues el proyecto completo
  es un entorno descartable de pruebas. Se entendió la instrucción y se aplicó
  desde el panel administrativo, sin cambiar cuentas contables ni esquemas.
- Se acreditaron 500 fichas a cada una de las seis cuentas de la plataforma:
  `ai_audiror`, `davidmonteros`, `lodelchino`, `nuevonuevo`, `Vanesaf` y
  `Vanesaflores`. Cada asiento `physical_deposit` registra el motivo
  “Simulación de dinero de juguete para QA; acreditación por Caja física”.
  `Vanesaf` estaba pendiente de activación; se activó desde el panel para que
  pudiera recibir la acreditación por el flujo normal.
- No se iniciaron sesiones de las cuentas destino ni se emplearon credenciales
  humanas. En esta tanda no se hicieron apuestas ni canjes nuevos.
- Saldos después de acreditar: `ai_audiror` 5.468; `davidmonteros` 1.756;
  `lodelchino` 2.119; `nuevonuevo` 990; `Vanesaf` 500; `Vanesaflores` 2.503.
  Caja física 10.569 y saldo total de billeteras 13.336. Se verificaron los
  seis asientos de 500 en el ledger.
- Fotografía histórica previa a la liquidación de las loterías: conciliación
  SQL de solo lectura con 24.658 débitos = 24.658 créditos, 0 asientos
  desbalanceados y 0 diferencias de saldo. En ese momento Lotería #1 seguía
  abierta, Jackpot no tenía sorteo abierto y se observaba una ronda activa de
  `Vanesaflores`, sin intervención sobre esos procesos.

### 27 de octubre de 2026 — liquidación de loterías y retests visuales QA

- Se verificaron en Supabase los cartones de los sorteos #1 y #2 después de su
  liquidación. Los cinco cartones del sorteo #1 registraron 8, 10, 7, 10 y 9
  aciertos; los cartones #6 y #7 del sorteo #2, 10 y 6. Todos tuvieron premio
  cero y reserva cero/liberada. En total, 7 cartones; no existe sorteo de
  Lotería abierto.
- El Jackpot #2 ya había sido liquidado con una entrada única de 10 fichas:
  pago de 7 al participante y 3 a ganancias de la casa. No hay sorteo abierto.
- Se investigó la jugada de Dados de 300 fichas: `jva_game_bets` guarda máximo
  331 y pago 331; el asiento debitó 331 del fondo y acreditó 331 a la billetera.
  El asiento de apuesta aportó 210 al fondo y 90 a ganancias de la casa. Por
  tanto, no hay sobrepago contable. La diferencia con la previsión histórica de
  210 no se reprodujo ni tiene causa confirmada; el código actual suma al fondo
  disponible la contribución de la propia apuesta y en la página, con pozo 0 y
  apuesta 10, la previsión fue 7. No aumentar apuestas hasta reproducir la
  discrepancia con estado controlado.
- Retests interactivos de importe mínimo en Production, únicamente con la
  sesión `ai_audiror`: Dados 4, Bajo, resultado 36 y pago 3; Tragamonedas 4,
  pérdida; Ruleta 4, segmento 2 sin premio; Minas 4, casilla 1 segura y cobro
  de 4; Crash 4, caída en 1,00× y pérdida. Mensajes y saldos se actualizaron;
  se comprobaron el resultado animado de Dados y los rodillos en estado de
  pérdida de Tragamonedas. Las cinco operaciones terminaron sin rondas de QA
  activas. Movimiento neto de la billetera durante esta tanda: −13 (4.909 a
  4.896); apuestas 20, premios 7.
- La página de Lotería mostró “No hay un sorteo abierto” y los cartones
  liquidados sin premio. Jackpot mostró que no se abrió otro sorteo. El RPC
  `P0001` de estado vacío de Lotería se manejó con ese mensaje esperado.
- Conciliación remota final: 25.906 débitos = 25.906 créditos, 0 asientos
  descuadrados y 0 saldos distintos del libro. Resumen del panel: 314 asientos,
  227 apuestas, 7 cartones; Caja física 10.569, ganancias de la casa 1.186 y
  billeteras 12.764. Saldos actuales: `ai_audiror` 4.896,
  `davidmonteros` 1.756, `lodelchino` 2.119, `nuevonuevo` 990, `Vanesaf` 500 y
  `Vanesaflores` 2.503.
- No se iniciaron sesiones de las otras cinco cuentas ni se hicieron apuestas
  como ellas. La cobertura multiusuario y la revisión de la ronda previamente
  atribuida a `Vanesaflores` siguen pendientes. El rol `admin` de `ai_audiror`
  es de aplicación, no privilegio root de Supabase; las consultas SQL usadas
  fueron de lectura y las apuestas pasaron por la UI/RPC legítima.
- Informe detallado: [`INFORME-AUDITORIA-QA-2026-10-27.md`](./INFORME-AUDITORIA-QA-2026-10-27.md).

### 27 de octubre de 2026 — conciliación multiusuario QA y ajuste visual de Crash

- Se verificaron en el panel de auditoría los depósitos y movimientos de
  `qa_audit_01`, `qa_audit_02` y `qa_audit_03`: cada cuenta recibió 500 fichas
  QA por Caja física y terminó con saldo 502, 502 y 500, respectivamente.
- Trazabilidad de las apuestas: slots 4→6, ruleta 4→6 y Crash 4→4. En los tres
  casos el ledger refleja débito de la billetera, distribución de 1 ficha a la
  casa y 3 al fondo, y el premio debitado del fondo. La conciliación posterior
  fue 27.434 débitos = 27.434 créditos, sin asientos descuadrados ni saldos
  distintos del libro.
- En Crash, la UI mostró 1,65× al concluir una ronda cobrada con apuesta y pago
  de 4. La función SQL devuelve por separado `multiplier` (multiplicador de
  cobro) y `crash_multiplier` (punto de caída); el frontend estaba mostrando el
  punto de caída también al cobrar. Se ajustó localmente para mostrar el
  multiplicador cobrado en la ronda exitosa y reservar el punto de caída para
  las pérdidas. El ledger no expone el multiplicador exacto de esta ronda.
- `npm run build` y `git diff --check` pasaron. Falta hacer una prueba visual
  después de desplegar el cambio; el sitio remoto todavía puede servir la versión
  previa.
- La ronda de QA se hizo el 27/10/2026 en producción con cuentas creadas
  específicamente para QA y usando las operaciones normales. Las contraseñas
  no se registraron.

## Registro de cambios futuros

Al añadir hitos, anotar fecha, commit (si existe), archivos/migraciones, qué se
probó y dónde, qué no se probó, estado de aplicación remota y decisiones pendientes.
No registrar contraseñas, credenciales, URLs secretas o datos personales de los
participantes.
