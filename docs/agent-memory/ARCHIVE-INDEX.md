# Índice de archivo y limpieza pendiente

Este índice evita que una sesión nueva interprete automáticamente cada archivo
raíz como fuente vigente. La clasificación refleja el estado local revisado el
2026-10-28; comprobar de nuevo antes de mover/eliminar archivos.

| Ruta | Estado comprobado | Acción recomendada |
|---|---|---|
| `CONTEXTO-ACTUAL.md` | Tracked; contiene estado operativo más varios snapshots históricos | Mantener por ahora; migrar los hitos antiguos a informes fechados al depurar y dejar arriba solo estado/prioridades vigentes |
| `MEMORIA-COLMENA.md` | Tracked; playbooks, errores y bitácora | Mantener como índice de aprendizaje; separar playbooks grandes en archivos por tema cuando crezcan |
| `HISTORIAL-PROYECTO.md` | Tracked; histórico append-only | Preservar evidencia; no usar como instrucción actual |
| `CONTEXTO-TRASPASO-IA.md` | Tracked; traspaso histórico extenso y potencialmente obsoleto | No borrar; consultar solo ante pregunta histórica concreta. Luego considerar mover a `docs/agent-memory/archive/` y corregir referencias |
| `README.md` | Tracked; contiene resumen técnico junto con estados antiguos | Mantener contenido de producto/instalación; quitar los estados de deployment/migración ya superados en una tarea dedicada y enlazar el contexto actual |
| `ejemplo.js` | Tracked, tamaño 0; sin referencias encontradas en HTML/JS | Eliminado de este workspace porque era un archivo vacío y sin consumidores |
| `contexto-proyecto.md` | Ignorado por Git, local y grande (~89 KB) | No incorporar al cerebro activo. Si hace falta conservar evidencia, archivarlo fuera del arranque; borrar solo tras confirmar que el propietario no necesita la copia local |
| `codigo-total.md` | Ignorado por Git, local y grande (~71 KB) | Copia de código generada/obsoleta según contexto histórico; no usar como fuente de código. Verificar si `main.py` la regenera antes de retirar |
| `main.py` | Ignorado por Git, local (~2.8 KB); contexto lo describe como generador de `codigo-total.md` | Confirmar contenido/uso antes de borrar; no es la app de caja |
| `ejemplo.html` | Ignorado por Git, local (~3.4 KB); sin referencias encontradas en navegación | Mantener fuera del build; puede archivarse si no tiene valor histórico |
| `ejemplo.css` | Ignorado por Git; no apareció en el inventario porque no existe localmente | No requiere acción |
| `.env.local`, `.vercel/`, `node_modules/`, `dist/` | Ignorados/artefactos locales | No versionar; no leer secretos durante limpieza; regenerar solo según flujo de desarrollo |
| `.qa-credentials.local.md` | Ignorado por Git; credenciales locales | No leer, copiar, mover a memoria ni incluir en artefactos. La rotación de una clave expuesta sigue pendiente |

## Regla de archivo

No usar `git clean`, borrados por glob ni “limpieza por nombre”. Para cada
candidato: verificar tracking (`git ls-files`), referencias, generación,
dependencias y valor histórico; describir antes/después en el handoff. Los
archivos ignorados pueden ser datos del propietario, aunque no estén en Git.
