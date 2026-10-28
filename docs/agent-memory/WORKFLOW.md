# Protocolo de sesión secuencial del agente

## Continuidad del mismo agente lógico

El sistema presupone que solo hay un agente ejecutando tareas a la vez. Una
nueva sesión debe retomar el hilo existente, no crear una línea de trabajo
independiente:

1. Leer en este orden: `AGENTS.md` → prompt raíz/índice →
   `SESSION-STATE.md` → sección actual relevante → playbook aplicable →
   informe/historial solo si se necesita. El prompt implementa este flujo.
2. Mantener el bootstrap pequeño: no leer reportes completos salvo necesidad;
   no repetir datos que ya están en el estado canónico; priorizar hechos con
   fecha, fuente y estado de verificación.
3. El estado actual se consulta al sistema para trabajos remotos; el snapshot
   local sirve para continuidad, no reemplaza a Supabase/Vercel.
4. Si el Brain ya tiene bootstrap/lease implementados, reclamar el lease
   exclusivo, mantener heartbeat y liberarlo en el handoff. Si no existen,
   registrar el handoff local y no afirmar locking remoto.
5. Antes de una acción remota o financiera, comprobar precondiciones y registrar
   intención, alcance y entorno. Tras ejecutarla, guardar el resultado observado
   y evidencia no secreta.
6. Al detenerse, guardar un handoff claro: objetivo, qué se hizo, pruebas,
   riesgos/bloqueos y siguiente operación concreta.
7. Issues/PRs son auxiliares para revisión de código o aprobación humana; no
   sustituyen la secuencia ni se consideran el cerebro operativo.

Las tablas/RPC del Brain están aplicadas en el Supabase QA actual y sus
operaciones principales pasaron pruebas transaccionales con rollback. Para usar
el flujo normal, abrir `cerebro-agentes.html` con sesión Auth real y rol
`ai_auditor` cuando la interfaz esté disponible desde una Preview autorizada.
Como la interfaz aún no está desplegada ni probada con Auth real, el handoff
documental local sigue siendo el fallback práctico. No afirmar notificaciones
Realtime: no están implementadas.

### Parámetros de lectura

- **L0 — siempre:** `AGENTS.md`, rama/estado Git y resumen del último handoff.
- **L0.5 — siempre:** `SESSION-STATE.md`, un snapshot compacto que apunta al
  trabajo anterior y define el siguiente paso único.
- **L1 — por tarea:** sección relevante de `CONTEXTO-ACTUAL.md`, playbook
  aplicable y rutas de código afectadas.
- **L2 — bajo demanda:** informe fechado, historial largo, archivos legacy o
  migraciones completas; abrir solo para una pregunta concreta.
- Al iniciar, capturar como máximo misión, estado del workspace, último hecho
  verificado, bloqueos y próximo paso. Evitar reconstruir toda la conversación.
- No tratar hechos sin fecha, antiguos o marcados como hipótesis como vigentes.
  No leer archivos de secretos como parte del bootstrap.

### Parámetros de escritura

- Escribir inmediatamente después de una acción remota con efecto, una decisión
  que cambie el rumbo o un hallazgo reproducible que evite repetir un fallo.
- `SESSION-STATE.md`: actualizarlo al cierre de cada sesión con el estado
  resumido y el siguiente paso único; mantenerlo compacto y sin duplicar la
  cronología.
- `CONTEXTO-ACTUAL.md`: estado operativo duradero; actualizar o marcar como
  supersedido lo antiguo, no duplicar el snapshot entero.
- `MEMORIA-COLMENA.md`: solo método reusable, causa/evidencia y nivel de
  confianza. Hipótesis y acciones no resueltas se etiquetan como tales.
- `HISTORIAL-PROYECTO.md`: hitos fechados, append-only, sin borrar evidencia.
- Informe de pruebas: una tanda por archivo, con matriz, IDs no sensibles,
  entradas/salidas, cálculo de conciliación y limitaciones.
- Cada handoff termina con un **único siguiente paso**; no una lista vaga de
  alternativas.
- Nunca escribir secretos, dumps, cookies, claves, datos personales o
  contraseñas en ningún nivel de memoria.

## Credenciales y acceso

- Los datos de continuidad no incluyen secretos. No se guardan contraseñas,
  claves de servicio o root en memoria, issues, PRs, archivos tracked,
  capturas, logs o salidas de herramientas.
- El archivo `.qa-credentials.local.md` está ignorado por Git y puede ser usado
  en esta máquina solo para un login QA expresamente requerido. No copiarlo ni
  replicarlo para otros agentes.
- La contraseña de `qa_colmena_01` se expuso en un snapshot de error. Antes de
  otro login, rotarla con un flujo Auth soportado; confirmar la rotación sin
  imprimir el valor. Si el agente no dispone de ese flujo, detener ese acceso
  y pedir al propietario que aprovisione credenciales separadas.
- No pedir ni usar credenciales humanas. No extraer contraseñas de hashes ni
  cambiar `auth.users` manualmente.
- El cerebro no recibe ni devuelve `service_role`/root. Para las acciones
  administrativas necesarias, diseñar una capa de operaciones estrechas,
  allowlisted y auditadas, ejecutadas bajo autorización del propietario; el
  secreto privilegiado permanece en el servidor/cofre, nunca en el contexto del
  modelo. No automatizar una consola SQL arbitraria.

## Pruebas financieras y análisis estadístico

- Confirmar proyecto y entorno; usar solo las cuentas de prueba y las vías
  soportadas del producto. Fichas QA no equivalen a dinero real.
- Para pruebas automatizadas amplias (por ejemplo, 10 cuentas × 100 apuestas),
  usar primero simulación local determinista o un bucket aislado. Registrar
  versión de reglas, parámetros, semilla, número de pruebas, límites y
  resultados. No ejecutar lotes contra Production.
- Mantener cuotas, probabilidades y premios fijos por versión y visibles al
  jugador. No variar resultados por el saldo, gasto, pérdidas o historial de
  una persona ni diseñar variabilidad para inducir sesiones prolongadas.
- Calcular por cuenta y juego: saldo inicial/final, depósitos, importe apostado,
  premios brutos, resultado neto, saldo del fondo, reservas, asientos y
  discrepancias. Publicar también distribución de ganancia/pérdida, RTP
  observado frente al teórico, desviación/intervalos y casos extremos. No
  interpretar muestras pequeñas como garantía de resultados futuros.
- En QA remoto, anotar la matriz antes de iniciar. Después de cada tanda,
  verificar ledger (débitos = créditos), reservas, balance individual y estado
  del sorteo. Si algo no concilia, detener pruebas y reportar; no compensar con
  escrituras manuales.
- Los cambios de reglas/pagos requieren diseño transparente, revisión,
  aprobación del propietario y pruebas separadas antes de cualquier despliegue.

## Formato de cierre

Al cerrar una tarea, dejar:

```text
Objetivo:
Entorno/alcance:
Cambios:
Validación y evidencia:
Riesgos/bloqueos:
Siguiente paso y responsable:
```

Decir explícitamente qué no se probó. No incluir secretos ni afirmaciones de
estado remoto que no se hayan consultado durante la tarea.
