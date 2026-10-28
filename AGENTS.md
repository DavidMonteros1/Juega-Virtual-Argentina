# Instrucciones para agentes

Este archivo es la entrada obligatoria para cualquier agente que trabaje en el
repositorio. El índice operativo está en
[`docs/agent-memory/README.md`](./docs/agent-memory/README.md).

## Inicio

1. Ejecuta `git status --short` y comprueba la rama. No sobrescribas cambios que
   ya estaban en el árbol de trabajo.
2. Lee el índice anterior y únicamente las secciones de contexto necesarias
   para la tarea. No cargues informes históricos completos por defecto.
3. Para tareas en curso, busca o crea un GitHub Issue de handoff y comenta
   alcance, responsable, estado y próximo paso. No asumas que una memoria
   Markdown notifica a agentes activos.
4. Verifica el entorno actual antes de cualquier operación remota. La evidencia
   guardada en contexto no sustituye una consulta actual a Supabase/Vercel.

## Seguridad, QA y límites operativos

- Usa cuentas QA dedicadas solo cuando la tarea requiera una prueba autorizada.
  Las credenciales locales no son memoria compartida y nunca se copian a Git,
  issues, prompts, mensajes, capturas ni logs. `.qa-credentials.local.md` puede
  consultarse localmente solo para un login QA justificado; no lo reveles ni lo
  publiques. La contraseña de `qa_colmena_01` debe rotarse por la exposición
  accidental documentada antes de volver a usarla o compartir accesos.
- No pedir ni usar contraseñas humanas. No crear un almacén compartido de
  contraseñas ni copiar credenciales entre agentes. Si otro agente/máquina
  necesita acceso, el propietario debe aprovisionar una identidad QA separada
  mediante un flujo soportado.
- `admin` es un rol de la aplicación, no root, `service_role` ni permiso para
  eludir Auth/RLS. No añadir endpoints SQL genéricos, exponer claves
  privilegiadas, desactivar controles ni alterar manualmente el ledger.
- Para QA usa únicamente el entorno confirmado y los flujos oficiales de UI/RPC.
  No afirmes que fichas de prueba representan dinero real. No borrar datos,
  cambiar permisos o modificar sorteos sin verificar alcance y autorización.
- Reglas, probabilidades y pagos deben ser explícitos, fijos por versión y
  auditables. No adaptar resultados a saldo, gasto o historial de un jugador ni
  perseguir secuencias ganadoras. Simulaciones estadísticas deben ejecutarse
  fuera de Production, con parámetros y semilla reproducibles.

## Cierre

1. Ejecuta la validación más pequeña que cubra el cambio y reporta límites.
2. Actualiza `CONTEXTO-ACTUAL.md` solo cuando cambie el estado comprobado;
   registra procedimientos reutilizables en `MEMORIA-COLMENA.md` y conserva
   hitos históricos en `HISTORIAL-PROYECTO.md`.
3. Resume en el Issue/PR qué cambió, evidencia, pruebas, riesgos y próximo paso.
   No incluyas secretos ni afirmes verificaciones que no realizaste.
4. Antes de commit, verifica `git diff --check` y que
   `git check-ignore -v .qa-credentials.local.md` lo excluya. Nunca fuerces
   credenciales al índice.
