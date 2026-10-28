# Protocolo de trabajo y continuidad

## Coordinación entre sesiones

Los archivos del repositorio se sincronizan con Git, pero no notifican a agentes
que ya están trabajando. Para comunicación asíncrona:

1. Usar un GitHub Issue por objetivo verificable; asignar responsable y
   registrar alcance, entorno permitido, estado, bloqueos y próximo paso.
2. Usar comentarios del Issue para mensajes y handoff; incluir referencias a
   archivos/PRs y evidencia no secreta. No duplicar contraseñas, tokens, datos
   personales ni dumps del navegador.
3. Si dos agentes podrían modificar el mismo recurso remoto, detener las
   operaciones concurrentes y coordinar una sola persona responsable en el
   Issue.
4. Un PR es la propuesta revisable. No se considera completado un cambio solo
   por estar descrito en la memoria.
5. Al cerrar, actualizar el Issue y, si el estado general cambió,
   `CONTEXTO-ACTUAL.md`. Añadir a `MEMORIA-COLMENA.md` solo el aprendizaje
   reproducible; dejar informes de rondas en archivos separados y fechados.

El Issue template de handoff está en
[`../.github/ISSUE_TEMPLATE/agent-handoff.yml`](../../.github/ISSUE_TEMPLATE/agent-handoff.yml).

## Credenciales y acceso

- Las credenciales no son conocimiento compartido. No se guardan en memoria,
  issues, PRs, archivos tracked, capturas, logs o salidas de herramientas.
- El archivo `.qa-credentials.local.md` está ignorado por Git y puede ser usado
  en esta máquina solo para un login QA expresamente requerido. No copiarlo ni
  replicarlo para otros agentes.
- La contraseña de `qa_colmena_01` se expuso en un snapshot de error. Antes de
  otro login, rotarla con un flujo Auth soportado; confirmar la rotación sin
  imprimir el valor. Si el agente no dispone de ese flujo, detener ese acceso
  y pedir al propietario que aprovisione credenciales separadas.
- No pedir ni usar credenciales humanas. No extraer contraseñas de hashes ni
  cambiar `auth.users` manualmente.
- Para agentes/equipos que necesiten acceso continuo, el propietario debe
  configurar identidades QA separadas y un gestor de secretos aprobado. Nunca
  conceder `service_role`/root a agentes para evitar trabajo operativo.

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
