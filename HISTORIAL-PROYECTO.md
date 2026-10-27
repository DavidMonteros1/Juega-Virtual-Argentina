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

## Registro de cambios futuros

Al añadir hitos, anotar fecha, commit (si existe), archivos/migraciones, qué se
probó y dónde, qué no se probó, estado de aplicación remota y decisiones pendientes.
No registrar contraseñas, credenciales, URLs secretas o datos personales de los
participantes.
