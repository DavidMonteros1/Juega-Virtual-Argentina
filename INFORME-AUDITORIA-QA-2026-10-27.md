# Informe de auditoría QA — 27 de octubre de 2026

## Alcance y límites

Revisión de trazabilidad y pruebas de interfaz en el entorno de QA de Juega
Virtual Argentina, usando la sesión autenticada `ai_audiror` y el rol
administrativo de la aplicación. La consulta de Supabase fue de solo lectura;
las apuestas se hicieron desde las páginas del juego y las operaciones
administrativas por la aplicación.

Esto no es una certificación exhaustiva de todas las combinaciones o de todos
los usuarios. No se iniciaron sesiones como las seis cuentas preexistentes ni
se apostó en su nombre. La tanda multiusuario se limitó a tres cuentas QA
nuevas con sesiones separadas. El rol `admin` de la aplicación no equivale a
root de PostgreSQL, `service_role` ni autorización para eludir RLS.

## Resultado ejecutivo

- Conciliación remota inicial: **25.906 débitos = 25.906 créditos**,
  **0 asientos descuadrados** y **0 saldos distintos del libro**.
- Tras la tanda QA adicional, la conciliación más reciente fue
  **27.438 débitos = 27.438 créditos**, **0 asientos descuadrados** y
  **0 diferencias de saldo**.
- Panel actualizado tras el retest Crash: 324 asientos, 231 apuestas y 7 cartones.
- Caja física: 12.069 fichas; ganancias acumuladas de la casa: 1.190;
  total de billeteras: 14.264.
- Loterías #1 y #2 liquidadas: siete cartones, todos sin premio; reservas
  liberadas.
- Jackpot #2 liquidado: entrada de 10, premio 7 al único participante y 3 a la
  casa. No hay sorteo de Jackpot abierto.
- Los retests mínimos de Dados, Tragamonedas, Ruleta, Minas y Crash terminaron
  sin rondas QA pendientes.
- Las tres cuentas QA adicionales terminaron con saldos conciliados y sus
  apuestas quedaron trazables en el ledger.
- Se corrigió el error visual de Crash y se desplegó en Production. El HTML
  público sirve el bundle actualizado. Falta repetir una ronda ganadora
  autenticada para validar el resultado final visual de extremo a extremo. Se
  comprobó por separado el renderizador de cobro mediante RPC simulada.
- Un retest real mínimo de Crash cayó en 1,00×: apuesta 4 perdida, saldo
  4.896→4.892; el pozo subió 245→248 y la casa 1.189→1.190. La pantalla mostró
  la pérdida y el ledger siguió conciliado. No se repitió la apuesta buscando
  un resultado ganador.
- Se inspeccionaron las pantallas de Dados, Tragamonedas, Ruleta, Minas, Crash,
  Jackpot y Lotería sin apostar. Jackpot y Lotería no tenían sorteos abiertos;
  sus botones de compra estaban deshabilitados. Lotería presentaba ese estado
  esperado como error de consola (`P0001`), y Tragamonedas formateaba el saldo
  sin separador de miles, a diferencia de las otras pantallas.
- Se corrigió localmente el estado vacío esperado de Lotería para no registrarlo
  como error, manteniendo el manejo de errores no esperados; también se unificó
  el formato de saldo de Tragamonedas. `c925fc2` publicó las correcciones y
  actualizó la documentación. Vercel Production quedó Ready; el HTML público
  referencia los bundles nuevos de Lotería y Tragamonedas, ambos HTTP 200. Se
  comprobó que incluyen el manejo del `P0001` esperado y el formateador `es-AR`.
  No se realizó una nueva sesión autenticada para validar la consola del
  navegador.
- `npm run build`, `git diff --check` y el build remoto de Vercel pasaron.
- El arreglo quedó en el commit `0bbf6e9` de `main`. Vercel Production está
  Ready y el sitio sirve el bundle `arcade--_Jkl1Mt.js`; se verificó el build
  remoto y la respuesta HTTP 200.

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

Se corrigió `juegos/arcade/arcade.js`: al cobrar se presenta el valor
`multiplier` y el texto del premio incluye ese multiplicador; al perder se
mantiene `crash_multiplier`. `npm run build`, `git diff --check` y el build
remoto pasaron; Production sirve el bundle actualizado. La verificación visual
de una ronda ganadora posterior al despliegue queda pendiente. No se concluye
que el multiplicador exacto de la ronda probada fuera 1,00×: eso requiere
consultar el resultado de la acción o el snapshot persistido.

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
| `ai_audiror` | 4.892 |
| `davidmonteros` | 1.756 |
| `lodelchino` | 2.119 |
| `nuevonuevo` | 990 |
| `Vanesaf` | 500 |
| `Vanesaflores` | 2.503 |
| `qa_audit_01` | 502 |
| `qa_audit_02` | 502 |
| `qa_audit_03` | 500 |

| Fondo | Saldo | Reservado | Disponible |
|---|---:|---:|---:|
| Crash | 248 | 0 | 248 |
| Dados | 0 | 0 | 0 |
| Jackpot | 0 | 0 | 0 |
| Lotería | 49 | 0 | 49 |
| Minas | 257 | 50 | 207 |
| Tragamonedas | 495 | 0 | 495 |
| Ruleta | 566 | 0 | 566 |
| Mesas | 0 | 0 | 0 |

La auditoría anterior había observado una ronda de `Vanesaflores` activa. No se
consultó ni modificó en esta continuación; comprobar su estado antes de operar
partidas de otros usuarios.

## Análisis estadístico de las reglas

### Alcance y método

Se calcularon valores esperados analíticos a partir de las reglas por defecto
de las migraciones. El panel de auditoría consultado expone el porcentaje de
comisión y los fondos, pero no los parámetros avanzados de pagos; por eso los
valores de multiplicadores, probabilidades de slots y configuración de Minas
son **defaults del repositorio, no parámetros productivos confirmados**. La
comisión de casa de 30% sí se observó en la configuración remota de los juegos.
No se ejecutó una batería adicional de apuestas o una simulación de resultados
en producción para esta sección.

Para una apuesta de importe \(s\) con pagos brutos \(x_i s\) y probabilidades
\(p_i\), el retorno teórico bruto es:

\[
\operatorname{RTP} = \sum_i p_i x_i,\qquad
\operatorname{ventaja\ teórica} = 1-\operatorname{RTP}.
\]

Se supone que el multiplicador incluye la apuesta, como lo indica el default
`payout_includes_stake = true`. Los límites de fondos/reservas pueden recortar
el pago efectivo y reducir todavía más el RTP; no aumentan el pago teórico.

### Juegos con probabilidades calculables desde los defaults

| Juego | Regla por defecto usada | RTP bruto teórico | Observación de equidad |
|---|---|---:|---|
| Dados | 50% de acierto, pago total 1,40× | 70% | Coincide con una contribución de 70% al fondo si no hay topes. |
| Ruleta | 10 segmentos: 0××5, 1,10××2, 1,40××2, 1,60××1 | 66% | Ventaja teórica 34%; contribuye 70% al fondo, por lo que éste retendría en promedio 4% de cada apuesta antes de límites. |
| Crash | Umbral calculado con 30% de comisión; retiros hasta el multiplicador máximo | Aproximadamente 70% para un cobro fijo sin topes | El redondeo, el crecimiento temporal y los topes de liquidez pueden modificar el resultado efectivo. Una prueba observada de 4 fichas perdió cuando la ronda cayó en 1,00×; no se interpreta como estimación de RTP. |
| Minas | 10 minas en 25 casillas; pago máximo 5×; cobro tras \(k\) casillas seguras | Depende de \(k\) | El cap de 5× reduce el RTP teórico cuando se eligen 4 o más casillas seguras. |
| Tragamonedas | Jackpot 5% a 3×; pareja 15% a 1,5×; resto 0× | 37,5% | **Solo con los defaults de migración:** ventaja teórica 62,5%. Frente a una contribución del 70% al fondo, el fondo retendría en promedio 32,5% de cada apuesta antes de topes. Revisar la configuración productiva y divulgar RTP/pagos; no cambiarla automáticamente por usuario. |
| Jackpot | 30% de comisión; el resto de las entradas va al fondo común | Aproximadamente 70% de las nuevas entradas | Asume entradas de igual precio, una selección uniforme por entrada y ausencia de saldo acumulado previo en el fondo. El sorteo QA de una entrada por 10 pagó 7. |

Para Minas, la probabilidad de sobrevivir \(k\) revelaciones sin reemplazo es
\(P_k=\binom{15}{k}/\binom{25}{k}\). Con el default de 30% de comisión, el
multiplicador es \(\min(0,70/P_k,5)\):

| Casillas seguras \(k\) | Probabilidad de llegar al cobro | RTP bruto antes del tope del fondo |
|---:|---:|---:|
| 1 | 60,0000% | 70,00% |
| 2 | 35,0000% | 70,00% |
| 3 | 19,7826% | 70,00% |
| 4 | 10,7905% | 53,95% |
| 5 | 5,6522% | 28,26% |
| 6 | 2,8261% | 14,13% |

Para la lotería de 15 números sorteados entre 25 y cartón de 15, el número de
aciertos sigue una distribución hipergeométrica:
\(P(K=k)=\binom{15}{k}\binom{10}{15-k}/\binom{25}{15}\).

| Aciertos | Probabilidad teórica | Aproximación |
|---:|---:|---:|
| 11 | 8,769380% | 1 en 11,4 |
| 12 | 1,670358% | 1 en 59,9 |
| 13 | 0,144550% | 1 en 692 |
| 14 | 0,0045889% | 1 en 21.792 |
| 15 | 0,00003059% | 1 en 3.268.760 |

La probabilidad de obtener 11 o más aciertos es aproximadamente 10,5889%.
Esto no determina por sí solo el RTP de lotería: depende de cantidad/distribución
de cartones, reparto entre ganadores, redondeo y tratamiento de categorías sin
ganador.

### Lectura y acciones seguras

- Un RTP o margen teórico es un promedio de largo plazo, no un resultado
  garantizado para la casa en una sesión corta. La varianza, tamaño de muestra,
  pagos raros y fondos disponibles determinan el riesgo de rachas y de reserva.
- Para comprobar resultados observados, registrar por versión de reglas el
  número de jugadas, apuestas, pagos brutos y categorías; contrastar frecuencias
  con probabilidades teóricas usando pruebas apropiadas (por ejemplo,
  chi-cuadrado cuando los conteos esperados sean suficientes) e intervalos de
  confianza. Los eventos muy raros deben verificarse por enumeración/modelos y
  revisión de RNG, no por una batería pequeña de apuestas.
- Para pagos brutos \(X\) con resultados \(x_i\) y probabilidades \(p_i\),
  usar \(\operatorname{Var}(X)=\sum_i p_i(x_i-\operatorname{RTP})^2\).
  Para una muestra suficientemente grande e independiente, el error estándar
  del RTP observado es aproximadamente \(s/\sqrt{N}\), y un intervalo normal
  aproximado de 95% es \(\bar X \pm 1,96s/\sqrt{N}\). En resultados binarios
  conviene usar un intervalo Wilson para la proporción. Estos diagnósticos
  sirven para detectar desviaciones del azar/configuración publicados, no
  para optimizar retención o ajustar la probabilidad por jugador.
- No modificar odds/premios según gasto, pérdidas previas, saldo o perfil de un
  jugador. La casa y los fondos de premios por juego son cuentas distintas; para
  solvencia, respaldar el máximo con la reserva del juego y, si no alcanza,
  limitar el importe o pausar nuevas rondas **antes** de aceptar la apuesta.
  Mostrar reglas, RTP/probabilidades y pago máximo de forma clara. Las rondas ya
  aceptadas deben conservar la regla capturada en su snapshot.
- El estándar RTS 7 de la Gambling Commission británica exige resultados
  aceptablemente aleatorios y prohíbe comportamiento adaptativo/compensado;
  RTS 3 pide información previa sobre probabilidades, RTP o ventaja de la casa.
  Son referencias técnicas útiles, no un dictamen de cumplimiento para
  Argentina: revisar la regulación local con asesoría competente.

Fuentes consultadas:

- [UK Gambling Commission — RTS 7: Generation of random outcomes](https://www.gamblingcommission.gov.uk/standards/remote-gambling-and-software-technical-standards/rts-7-generation-of-random-outcomes)
- [UK Gambling Commission — RTS 3: Rules, game descriptions and likelihood of winning](https://www.gamblingcommission.gov.uk/standards/remote-gambling-and-software-technical-standards/rts-3-rules-game-descriptions-and-the-likelihood-of-winning)
- Reglas de referencia local: [`20261025170000_jva_schema.sql`](./supabase/migrations/20261025170000_jva_schema.sql), [`20261025171000_jva_economy_rpcs.sql`](./supabase/migrations/20261025171000_jva_economy_rpcs.sql) y [`20261026150000_jva_original_arcade_games.sql`](./supabase/migrations/20261026150000_jva_original_arcade_games.sql).

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
