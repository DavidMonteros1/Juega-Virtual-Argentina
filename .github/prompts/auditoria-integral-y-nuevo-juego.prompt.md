---
name: "Auditoría integral, trazabilidad y nuevo juego"
description: "Auditar los juegos y las finanzas del entorno QA, implementar un juego original de vuelo con obstáculos y entregar comparativas antes/después"
argument-hint: "Opcional: límites de rondas/pruebas ya acordados para esta ejecución"
agent: "agent"
---

Continúa como la siguiente sesión del mismo agente lógico. Ejecuta este trabajo
por fases, con handoffs persistidos. No lances subagentes ni operes en paralelo.
Objetivo final: entregar un informe reproducible de trazabilidad y estado
financiero de los juegos existentes, añadir un juego original arcade de vuelo y
obstáculos, repetir el plan de pruebas después de integrarlo y comparar los
resultados. No afirmes que una fase ocurrió si no hay evidencia.

## 0. Bootstrap y condiciones de entrada

1. Ejecuta `/iniciar-sesion-cerebro` y continúa leyendo
   `docs/agent-memory/SESSION-STATE.md`.
2. Revisa `git status --short`, rama y cambios existentes. No descartar ni
   sobrescribir cambios previos.
3. Lee `CONTEXTO-ACTUAL.md`, la parte relevante de `MEMORIA-COLMENA.md` y
   `docs/agent-memory/CENTRAL-BRAIN.md`. Lee informes/historial solo para datos
   necesarios. No abras archivos de secretos durante el bootstrap.
4. Consulta ahora el estado del entorno remoto antes de cualquier operación:
   identifica URL/proyecto, entorno, configuración, juegos activos, sorteos,
   rondas y ledger. Los números históricos no son estado actual.
5. Si el destino no está inequívocamente identificado como QA aislado, hay
   usuarios reales, o una operación puede afectar saldo real, detén solo las
   operaciones con efectos y solicita confirmación/aislamiento. No ejecutar
   lotes de apuestas contra Production.
6. La memoria central de Supabase solo es diseño por ahora. No supongas que hay
   bootstrap, lease o API instalados. Usa el fallback de `SESSION-STATE.md`.

## Fase A — línea base y matriz

Antes de cambiar código:

- Inventariar juegos registrados en `lobby.html`, rutas, bundle/build y
  configuración en base de datos. Incluir Lotería, Jackpot, Tragamonedas,
  Dados, Minas, Crash, Ruleta y los módulos que realmente aparezcan en código.
- Para cada juego, registrar los flujos principales, reglas/pagos versionados,
  RPC, estado de UI, accesibilidad, errores de consola/red, permisos, límites,
  reservas/fondos y controles de idempotencia/concurrencia.
- Tomar snapshot de finanzas y conteos: caja QA, billeteras, fondos/reservas
  por juego, entradas/apuestas/cartones/sorteos, conciliación de débitos y
  créditos, balances vs ledger, rondas activas. Guardar hora y fuente.
- Preparar una matriz acotada con escenarios normales, borde, saldo insuficiente,
  error de red/reintento, juego pausado y controles visuales. Definir límites de
  fichas QA/rondas antes de ejecutar. Evitar doble clics no verificados.
- Para un análisis estadístico amplio, ejecutar por defecto un **simulador local
  determinista** de 10 participantes virtuales × 100 apuestas por juego, con
  semilla registrada y 3 bandas de stake legales (mínimo, 2× mínimo, 5× mínimo
  sujetas al límite configurado). No crear 10 Auth users ni enviar estas 1.000
  apuestas por juego al servicio remoto. Si las reglas solo existen en RPC, el
  modelo local debe etiquetarse como aproximación y no como resultado real;
  comparar con tests de integración pequeños en QA.
- En Supabase QA, limitar la integración real a las cuentas de prueba ya
  autorizadas y a una matriz breve de validación UI/ledger; no asumir que es
  seguro repetir 100 apuestas por cada cuenta. Si no puede confirmarse el
  entorno QA, ejecutar solo simulación local y pruebas sin escritura.
- No modificar reglas para producir ganancia/pérdida deseada. Cuotas y premios
  permanecen fijos durante cada comparación.

Guardar el plan y snapshot en el informe de esta ejecución antes de probar.
Completar un escenario y conciliarlo antes de comenzar el siguiente. Si una
operación queda incierta, inspeccionar su referencia/ledger antes de reintentar.

## Fase B — auditoría y correcciones de juegos existentes

- Ejecutar la matriz aprobada solo en QA, por UI/RPC legítimas y con fichas de
  prueba identificadas. No usar SQL manual para apuestas, pagos, sorteos o
  cambios de saldo.
- Comprobar para cada apuesta: usuario QA, ID de solicitud/transacción, stake,
  snapshot de reglas, resultado, premio, saldo anterior/posterior, efecto en
  fondo/reserva y asiento contable relacionado.
- Revisar estado visual, textos de victoria/derrota, animación y resultado
  autoritativo. UI y servidor deben coincidir. Revisar teclado, foco, móvil,
  movimiento reducido y estados de carga/error cuando correspondan.
- Ante un fallo, registrar pasos exactos y evidencia sin secretos; corregir la
  causa raíz con cambios acotados, añadir regresión y repetir el mismo caso.
- Detener la tanda si aparecen asientos descuadrados, saldo distinto del ledger,
  reserva huérfana, ronda inesperada, error de autorización o divergencia UI /
  resultado servidor. No “arreglar” balances manualmente.
- Después de cada tanda, conciliar: débitos=créditos, asientos desbalanceados=0,
  diferencias de balances=0, reservas explicadas y rondas cerradas salvo las
  existentes que no eran de la prueba.

## Fase C — agregar un juego arcade original

Implementa un juego nuevo de habilidad inspirado solo en la categoría general
“vuelo vertical con obstáculos” (no copies nombre, personajes, arte, sonidos,
textos, niveles ni código de Flappy Bird). Usa identidad y assets originales.

Alcance inicial seguro:

- Juego arcade **sin apuestas ni premios monetarios**: puntaje/record local o
  persistencia de score no financiero. No crear una economía, payout ni ruta de
  saldo nueva en esta tarea.
- Control accesible por teclado y pointer/touch, pausa/reinicio, instrucciones,
  estados ready/running/game-over y soporte `prefers-reduced-motion`.
- Colisiones y generación aleatoria comprobables con dependencia de RNG
  inyectable o semilla de test; dificultad fija y documentada, sin telemetría
  invasiva.
- Arte, texto y audio originales o recursos con licencia documentada. No
  descargar ni reutilizar assets de terceros sin verificar permiso.
- Integración completa con el catálogo/navegación, rutas Vite, estilo, mobile,
  accesibilidad y tests. No dejar una tarjeta que lleve a una página vacía.
- No habilitar ni desplegar el juego en Production sin autorización y validación
  del build/preview. Si el propietario requiere convertirlo en juego con fichas,
  detenerse en el diseño económico y pedir especificación/aprobación por
  separado; no inferir cuotas ni crear apuestas financieras.

## Fase D — retest y comparación

Después de implementar:

1. Ejecuta tests unitarios/integración disponibles, chequeo de tipos/lint y
   `npm run build`; corrige defectos causados por el cambio.
2. Repite la misma matriz de la Fase A en el mismo entorno permitido, con las
   mismas reglas, límites y parámetros. No compares escenarios distintos como
   si fueran equivalentes.
3. Verifica los juegos existentes no afectados y el juego nuevo con casos
   deterministas (colisión, paso de obstáculo/puntaje, pausa/reinicio y
   game-over), navegación, estados visuales y consola/red.
4. Repite la conciliación financiera. El juego nuevo score-only debe producir
   **cero** asientos, apuestas, débitos, créditos y cambios de fondos; verificarlo
   expresamente. Los resultados del nuevo juego no alteran balances.
5. No diseñar ni cambiar pagos para maximizar pérdidas, recuperación de la casa
   mediante resultados variables o tiempo de juego del usuario. El informe
   estadístico es descriptivo, no una recomendación para inducir apuestas.

## Informe obligatorio

Crear un archivo nuevo:
`INFORME-AUDITORIA-INTEGRAL-<YYYY-MM-DD>.md`.

Debe incluir:

1. Fecha, entorno y versión/commit; alcance y exclusiones.
2. Matriz inicial de parámetros exactos, límites y semilla/determinismo si aplica.
3. Snapshot financiero **antes** y **después** (con fuente y timestamp).
4. Resultados por juego y por ronda/cuenta QA con IDs no sensibles:
   stake, resultado, premio, saldo inicial/final, delta de fondo/reserva,
   asiento y veredicto visual/técnico.
5. Conciliación global y por cuenta; toda diferencia debe quedar explicada o
   marcada como bloqueo, nunca ocultada.
6. Bugs encontrados, pasos de reproducción, causa confirmada/hipótesis, fix,
   test de regresión y evidencia.
7. El nuevo juego: decisiones, controles, casos probados, resultado financiero
   cero y limitaciones.
8. Comparativa pre/post con mismos parámetros; RTP observado solo si aplica y
   junto con el valor teórico, tamaño de muestra e incertidumbre. No extrapolar
   muestras pequeñas.
9. Qué no se probó, errores de entorno, decisiones pendientes y siguiente paso.
10. Referencias a commits/rutas, sin contraseñas, tokens, cookies, claves,
    capturas sensibles ni datos personales.

## Aprendizaje y handoff

- Buscar la solución en `MEMORIA-COLMENA.md` antes de experimentar. Tras
  confirmar una solución, añadir playbook con síntoma, versión/entorno, causa,
  pasos reproducibles, resultado, evidencia, confianza y última verificación.
- Actualizar `SESSION-STATE.md` al final de cada fase y al terminar, con un
  siguiente paso único. Actualizar `CONTEXTO-ACTUAL.md` solo para el estado
  duradero; `HISTORIAL-PROYECTO.md` queda append-only.
- Si el trabajo excede una sesión, guardar fase, matriz, operaciones ya
  completadas y precondición exacta de reanudación. La sesión siguiente retoma,
  no repite.
- Nunca incluir secretos. No leer ni mostrar el archivo de credenciales local
  salvo que una acción de login QA sea indispensable y autorizada; no extraer
  secretos root ni ponerlos en contexto. Respeta Auth/RLS y privilegios mínimos.
- No hacer commit, push ni deploy salvo petición expresa del propietario.

## Criterio final de éxito

La tarea solo queda completa si: el informe pre/post está guardado; todos los
juegos existentes incluidos en alcance tienen resultado y evidencia o un
bloqueo explícito; el juego original está integrado, accesible y probado; sus
efectos financieros son cero; conciliación sin diferencias; validaciones pasan;
y el handoff permite a la siguiente sesión continuar sin pedir de nuevo los
antecedentes.
