# Instrucciones para agentes del proyecto

Antes de iniciar cualquier tarea:

1. Revisa `git status --short` y la rama activa; no descartes cambios del usuario.
2. Lee [CONTEXTO-ACTUAL.md](./CONTEXTO-ACTUAL.md) y
   [MEMORIA-COLMENA.md](./MEMORIA-COLMENA.md). Después consulta el informe de
   auditoría aplicable y [HISTORIAL-PROYECTO.md](./HISTORIAL-PROYECTO.md).
3. Las órdenes operativas actuales en `CONTEXTO-ACTUAL.md` prevalecen sobre
   recomendaciones antiguas que las contradigan. Preserva los informes
   históricos como evidencia; no los presentes como instrucciones vigentes.
4. Para la prueba QA autorizada, usa las cuentas QA dedicadas. Si existe
   `.qa-credentials.local.md`, puede leerse localmente solo para iniciar sesión;
   nunca copies contraseñas a conversaciones, código, reportes, issues, logs,
   capturas ni commits. Si no existe, detén solo el acceso de esas cuentas y
   comunica que las claves faltan; no intentes recuperar hashes ni cambiar
   `auth.users` manualmente.
5. Antes de depósitos, sorteos o apuestas, confirma el proyecto/entorno, estado
   de cuenta, saldo, ronda activa y propósito QA. Ejecuta las operaciones por
   las pantallas/RPC normales y verifica en el ledger; no simules resultado ni
   alteres probabilidades.
6. Usa sesiones de navegador en orígenes diferentes para cuentas simultáneas.
   Después de cada compra espera confirmación verificable de una nueva unidad;
   un clic durante una acción pendiente puede no registrar otra compra.
7. Al terminar, concilia débitos/créditos, asientos y saldos; actualiza el
   informe de la tanda y `CONTEXTO-ACTUAL.md`, y agrega una nota fechada a
   `MEMORIA-COLMENA.md` con causa, solución reproducible y evidencia.
8. Comprueba que `.qa-credentials.local.md` siga excluido mediante
   `git check-ignore -v .qa-credentials.local.md`; nunca lo fuerces al índice.

La memoria colmena es documentación compartida versionada, no un chat
asíncrono ni un proceso que notifica a agentes activos. Evita operaciones
paralelas sobre los mismos sorteos/cuentas; registra responsable y estado antes
de actuar.
