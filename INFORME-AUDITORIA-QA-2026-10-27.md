# Informe de auditoría QA — 27 de octubre de 2026

## Alcance y límites

Revisión de trazabilidad y pruebas de interfaz en el entorno de QA de Juega
Virtual Argentina, usando la sesión autenticada `ai_audiror` y el rol
administrativo de la aplicación. La consulta de Supabase fue de solo lectura;
las apuestas se hicieron desde las páginas del juego y las operaciones
administrativas por la aplicación.

Esto no es una certificación exhaustiva de todas las combinaciones o de todos
los usuarios. No se iniciaron sesiones como las otras cuentas ni se hicieron
apuestas en su nombre. Para cobertura multiusuario se necesitan cuentas QA
dedicadas con sesiones de Auth separadas. El rol `admin` de la aplicación no
equivale a root de PostgreSQL, `service_role` ni autorización para eludir RLS.

## Resultado ejecutivo

- Conciliación remota al cierre: **25.906 débitos = 25.906 créditos**,
  **0 asientos descuadrados** y **0 saldos distintos del libro**.
- Panel: 314 asientos, 227 apuestas y 7 cartones.
- Caja física: 10.569 fichas; ganancias acumuladas de la casa: 1.186;
  total de billeteras: 12.764.
- Loterías #1 y #2 liquidadas: siete cartones, todos sin premio; reservas
  liberadas.
- Jackpot #2 liquidado: entrada de 10, premio 7 al único participante y 3 a la
  casa. No hay sorteo de Jackpot abierto.
- Los retests mínimos de Dados, Tragamonedas, Ruleta, Minas y Crash terminaron
  sin rondas QA pendientes.
- Las tres cuentas QA adicionales terminaron con saldos conciliados y sus
  apuestas quedaron trazables en el ledger.
- Se corrigió localmente un error visual de Crash: al cobrar, la UI mostraba el
  punto de caída como si fuera el multiplicador cobrado. El sitio remoto no se
  ha actualizado con ese cambio.
- `npm run build` y `git diff --check` pasaron; aún falta la prueba visual
  después del despliegue.

## Lotería 15/25

El recálculo de aciertos se hizo comparando `jva_lottery_tickets.numbers` con
`jva_lottery_draws.drawn_numbers`; las filas de premios y reservas se contrastaron
con las tablas correspondientes.

| Sorteo | Cartón | Usuario | Aciertos | Precio | Premio | Reserva al cierre |
|---|---:|---|---:|---:|---:|---|
| #1 | 1 | `nuevonuevo` | 8 | 10 | 0 | 0, liberada |
| #1 | 2 | `lodelchino` | 10 | 10 | 0 | 0, liberada |
| #1 | 3 | `lodelchino` | 7 | 10 | 0 | 0, liberada |
| #1 | 4 | `davidmonteros` | 10 | 10 | 0 | 0, liberada |
| #1 | 5 | `ai_audiror` | 9 | 10 | 0 | 0, liberada |
| #2 | 6 | `ai_audiror` | 10 | 10 | 0 | 0, liberada |
| #2 | 7 | `ai_audiror` | 6 | 10 | 0 | 0, liberada |

No existe sorteo abierto. La página muestra los cartones liquidados como
“Este cartón no obtuvo premio” y el aviso “No hay un sorteo abierto”. La respuesta
RPC `P0001: No hay un sorteo abierto` durante la carga es la respuesta esperada
para ese estado, no un fallo de liquidación.

## Jackpot

El sorteo #2 tuvo una única entrada de `ai_audiror` por 10 fichas. El asiento de
entrada distribuyó 3 a ganancias de la casa y 7 al fondo de Jackpot; al liquidar,
7 salieron del fondo y fueron acreditadas a la billetera del ganador. Resultado
neto de la billetera: −3. El sorteo quedó liquidado y el fondo de Jackpot está
en cero, sin ronda abierta. La pantalla deshabilita la compra e informa que el
organizador todavía no abrió el próximo sorteo.

## Retests visuales recientes y seguimiento del saldo

El saldo de `ai_audiror` fue 4.909 fichas antes de esta tanda; terminó en 4.896.
Cada interacción se completó antes de pasar a la siguiente.

| Juego | Operación | Resultado en pantalla | Movimiento de billetera | Flujo hacia/desde fondos |
|---|---|---|---:|---|
| Dados | Apostar 4 a Bajo | Salió 36; “¡Ganaste 3 fichas (1.40×)!” | 4.909 → 4.908 (−1 neto) | 1 a casa; 3 al fondo y 3 pagadas desde el fondo |
| Tragamonedas | Girar con 4 | “No hubo premio”; rodillos con estado visual `lose` | 4.908 → 4.904 (−4) | 1 a casa; 3 al fondo |
| Ruleta | Girar con 4 | Segmento 2, sin premio; ruleta mostró `0.00×` | 4.904 → 4.900 (−4) | 1 a casa; 3 al fondo |
| Minas | Apostar 4, revelar casilla 1, cobrar | Casilla segura; “Premio acreditado: 4 fichas.” | 4.900 → 4.900 (neto 0) | 1 a casa; 3 al fondo; pago 4 desde el fondo (variación neta del fondo −1) |
| Crash | Apostar 4 e iniciar ronda | Cayó en 1,00×; pérdida confirmada | 4.900 → 4.896 (−4) | 1 a casa; 3 al fondo |

Totales de esta tanda: apuestas 20, premios 7, variación neta del jugador −13,
ganancias de la casa +5 y variación agregada de los fondos de juego +8. Esos
movimientos se compensan (`−13 + 5 + 8 = 0`). La reserva de Minas al cierre
incluye 50 fichas de otras jugadas; no se atribuye a este retest.

## Pruebas con cuentas QA dedicadas

Se crearon `qa_audit_01`, `qa_audit_02` y `qa_audit_03` mediante el flujo
autorizado de registro. Cada una recibió 500 fichas de juguete QA mediante Caja
física. El panel permitió conciliar cada saldo individual con su ledger:

| Cuenta | Prueba | Ledger de apuesta | Ledger de premio | Saldo inicial→final |
|---|---|---|---|---:|
| `qa_audit_01` | Tragamonedas | 4 débito; 1 casa; 3 fondo | 6 del fondo a la billetera | 500→502 |
| `qa_audit_02` | Ruleta | 4 débito; 1 casa; 3 fondo | 6 del fondo a la billetera | 500→502 |
| `qa_audit_03` | Crash | 4 débito; 1 casa; 3 fondo | 4 del fondo a la billetera | 500→500 |

El saldo según el libro coincidió con el saldo de cada billetera. Tras estas
operaciones, el panel global informó 27.434 débitos = 27.434 créditos,
0 asientos descuadrados y 0 saldos distintos del libro. Las tres contraseñas
no se conservaron.

## Hallazgo visual en Crash

En la ronda de `qa_audit_03`, el resultado visible al final fue “Premio
acreditado: 4 fichas” mientras el indicador mostraba 1,65×. El ledger confirmó
una apuesta de 4 y pago de 4, pero no almacena ni expone el multiplicador exacto
de cobro. Al inspeccionar el contrato SQL, se comprobó que la RPC devuelve
`multiplier` para el multiplicador de cobro y `crash_multiplier` para el punto
de caída de la ronda. `applyRoundState` mostraba `crash_multiplier` para todo
estado terminal, incluido `cashed_out`, por lo que presentaba el punto de caída
como si fuera el multiplicador cobrado.

Se corrigió localmente `juegos/arcade/arcade.js`: al cobrar se presenta el valor
`multiplier` y el texto del premio incluye ese multiplicador; al perder se
mantiene `crash_multiplier`. `npm run build` y `git diff --check` pasaron. El
cambio no está desplegado y su validación visual posterior queda pendiente. No
se concluye que el multiplicador exacto de la ronda probada fuera 1,00×: eso
requiere consultar el resultado de la acción o el snapshot persistido.

## Discrepancia histórica de Dados

En una apuesta anterior de 300 fichas, la pantalla habría mostrado un máximo
estimado de 210; `jva_game_bets` registra máximo 331, resultado `win` y pago 331.
El ledger registra:

- Apuesta: débito de 300 a la billetera; créditos de 90 a la casa y 210 al fondo
  `game:dice`.
- Premio: débito de 331 a `game:dice` y crédito de 331 a la billetera.
- Snapshot del servidor: elección Bajo, resultado 14, multiplicador 1,40 y
  máximo 331.

El fondo tenía 121 disponibles antes de sumar la contribución de 210; por eso el
máximo servidor de 331 y el pago están cubiertos y no constituyen un sobrepago
contable. El desacuerdo observado es exclusivamente con la previsión anterior
de la UI. El código de vista previa actual suma al fondo disponible la
contribución de la apuesta, y el retest actual mostró 7 para una apuesta de 10
con fondo 0. No se determinó por qué la pantalla anterior mostró 210: podría
haber usado un valor de fondo obsoleto o una lectura concurrente, pero eso no se
ha probado. No aumentar la apuesta hasta poder reproducirlo en una sesión QA
controlada.

## Estado remoto y saldos verificados

| Cuenta | Saldo al cierre |
|---|---:|
| `ai_audiror` | 4.896 |
| `davidmonteros` | 1.756 |
| `lodelchino` | 2.119 |
| `nuevonuevo` | 990 |
| `Vanesaf` | 500 |
| `Vanesaflores` | 2.503 |

| Fondo | Saldo | Reservado | Disponible |
|---|---:|---:|---:|
| Crash | 246 | 0 | 246 |
| Dados | 0 | 0 | 0 |
| Jackpot | 0 | 0 | 0 |
| Lotería | 49 | 0 | 49 |
| Minas | 257 | 50 | 207 |
| Tragamonedas | 498 | 0 | 498 |
| Ruleta | 569 | 0 | 569 |
| Mesas | 0 | 0 | 0 |

La auditoría anterior había observado una ronda de `Vanesaflores` activa. No se
consultó ni modificó en esta continuación; comprobar su estado antes de operar
partidas de otros usuarios.

## Siguientes pasos

1. Mantener el cierre contable como referencia y no repetir operaciones ya
   registradas.
2. Reproducir la diferencia histórica de la previsión de Dados con una cuenta QA
   dedicada y un fondo inicial conocido, revisando los valores devueltos por
   `jva_get_arcade_status` y la previsión del navegador antes de confirmar.
3. Para pruebas multiusuario, crear identidades QA mediante el flujo autorizado
   de Auth y usar sesiones independientes; no iniciar sesión como usuarios
   existentes ni usar contraseñas compartidas.
4. Completar la matriz de saldo insuficiente, límites, juegos pausados,
   reintentos, reservas, caducidad y concurrencia, siempre conciliando el ledger
   al terminar.
5. Revalidar visualmente y registrar por juego: estado inicial, animación,
   resultado final, texto accesible, cambio de saldo y error visible. La tanda
   aquí anotada es cobertura parcial, no validación exhaustiva de toda la
   plataforma.
