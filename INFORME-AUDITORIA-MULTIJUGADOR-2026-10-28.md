# Informe de prueba multijugador — 28 de octubre de 2026

## Alcance

Prueba QA en el proyecto descartable de Juega Virtual Argentina, usando los
flujos web de compra de Lotería y Jackpot y los controles administrativos
autorizados para abrir/liquidar sorteos. Se utilizaron sesiones de Auth
independientes para `qa_multi_01`, `qa_multi_02` y `qa_multi_03`; cada cuenta
comenzó con 620 fichas QA acreditadas por Caja física. No se usaron claves
privilegiadas, no se inició sesión como cuentas humanas y no se conservaron
contraseñas.

Se mantuvieron las reglas y pagos configurados por la aplicación: costo fijo de
10 fichas por cartón/entrada; ningún ajuste de probabilidades ni de premios.
Los resultados son una prueba funcional/contable de 93 unidades por juego, no
una muestra suficiente para inferir RTP o validar estadísticamente la
probabilidad teórica.

## Resultado por sorteo

Las cinco rondas lógicas completaron las cantidades por participante 1, 2, 4,
8 y 16 en ambos juegos. La segunda compra de Lotería por cuenta no quedó
registrada en el sorteo #4 porque el segundo clic se intentó mientras el control
seguía ocupado. La emisión real se verificó en el ledger; el cartón faltante de
cada usuario se compró como recuperación en el sorteo #5. Por eso #5 contiene
cinco cartones por cuenta: uno completa la ronda lógica de dos y cuatro
corresponden a la ronda lógica de cuatro.

| Ronda lógica | Sorteo Lotería | Cartones por cuenta | Sorteo Jackpot | Entradas por cuenta | Premio Lotería | Premio Jackpot |
|---|---:|---:|---:|---:|---:|---:|
| 1 | #3 | 1 | #3 | 1 | 0 | 21 a `qa_multi_03` |
| 2 | #4 y recuperación en #5 | 2 en total | #4 | 2 | 8 a `qa_multi_01` | 42 a `qa_multi_03` |
| 3 | #5 | 4 (además de 1 recuperación) | #5 | 4 | 10 total | 84 a `qa_multi_03` |
| 4 | #6 | 8 | #6 | 8 | 0 | 168 a `qa_multi_01` |
| 5 | #7 | 16 | #7 | 16 | 26 total | 336 a `qa_multi_01` |
| **Total** | **#3–#7** | **31** | **#3–#7** | **31** | **44** | **651** |

El resumen de premios de Lotería, verificado en cada historial y cobrado desde
la cuenta correspondiente:

| Cuenta | Cartones premiados | Cobros | Total |
|---|---|---:|---:|
| `qa_multi_01` | #11: 8; #55: 14; #65: 4; #67: 4 | 4 | 30 |
| `qa_multi_02` | #20: 4; #22: 2; #78: 4 | 3 | 10 |
| `qa_multi_03` | #25: 4 | 1 | 4 |
| **Total** | **8 cartones premiados** | **8** | **44** |

Jackpot pagó íntegramente el pozo a una cuenta ganadora en cada sorteo: los
sorteos #3, #4 y #5 a `qa_multi_03`, y #6 y #7 a `qa_multi_01`. `qa_multi_02`
no obtuvo premio de Jackpot. Los pozos pagados fueron 21, 42, 84, 168 y 336
fichas.

## Trazabilidad de balances

| Cuenta | Saldo inicial QA | Coste Lotería | Coste Jackpot | Premios Lotería | Premios Jackpot | Saldo final |
|---|---:|---:|---:|---:|---:|---:|
| `qa_multi_01` | 620 | −310 | −310 | +30 | +504 | **534** |
| `qa_multi_02` | 620 | −310 | −310 | +10 | 0 | **10** |
| `qa_multi_03` | 620 | −310 | −310 | +4 | +147 | **151** |
| **Total** | **1.860** | **−930** | **−930** | **+44** | **+651** | **695** |

La igualdad por cuenta coincide con los saldos recargados, descontando compras y
acreditando premios. Los cartones premiados quedaron inicialmente como
`claimable` y luego se cobraron desde la sesión propietaria; tras cada cobro se
volvió a consultar el saldo. No quedaron reservas pendientes al finalizar.

## Conciliación global observada

| Métrica | Antes de esta tanda | Después de esta tanda |
|---|---:|---:|
| Caja física | 13.929 | 13.929 |
| Ganancias acumuladas de la casa | 1.496 | 2.054 |
| Total de billeteras | 15.632 | 14.467 |
| Fondo Lotería | 49 | 656 |
| Fondo Jackpot | 0 | 0 |

Flujo agregado de la tanda:

- 93 cartones + 93 entradas = 186 operaciones de 10 fichas, **1.860** fichas
  apostadas.
- A casa: **558** fichas (incremento de 1.496 a 2.054).
- A fondos de juegos: **1.302** fichas en contribuciones, 651 por juego.
- Premios cobrados: **695** fichas (44 Lotería + 651 Jackpot).
- Billeteras: 15.632 − 1.860 + 695 = **14.467**.
- Fondo Lotería: 49 + 651 − 44 = **656**. Fondo Jackpot: 0 + 651 − 651 = **0**.

Tras refrescar la auditoría administrativa, el libro reportó **33.417 débitos =
33.417 créditos**, **0 asientos descuadrados** y **0 saldos distintos del
libro**. El panel indicó **564 asientos**, **350 apuestas** y **100 cartones**.
Las reservas QA de Lotería y Jackpot terminaron en cero. No quedó sorteo abierto
de ninguno de los dos juegos. Los conteos de asientos/apuestas/cartones son
contadores totales de la instalación, no solo de esta tanda.

## Observaciones y continuidad

- Los tickets se emitieron mediante la interfaz de la web. Para repetir compras
  de Lotería, esperar a que el botón vuelva a habilitarse y verificar que se
  agregó un elemento nuevo en “Mis cartones” antes de continuar; el clic durante
  una emisión en curso no equivale a una venta adicional.
- Los resultados fueron aleatorios y no se manipularon.
- No realizar de nuevo estas cinco rondas: las operaciones y asientos están
  registrados en Supabase. Si se retoma la auditoría, empezar por consultar el
  estado remoto actual y documentar nuevas rondas por separado.
- No hay cambios de código ni despliegue relacionados con esta prueba; el
  trabajo fue operativo y documental.
