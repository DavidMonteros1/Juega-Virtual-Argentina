# Juega Virtual Argentina — contexto operativo actual

**Revisado:** 26 de octubre de 2026
**Workspace:** `Juega Virtual Argentina multijugador`
**Repositorio:** `DavidMonteros1/Juega-Virtual-Argentina`
**Rama/commit base observado antes del trabajo de auditoría IA:** `main` / `e7754e6`
**Idioma de trabajo con el propietario:** español.

> Este documento describe el estado comprobado en el workspace. No equivale a
> una consulta en vivo a Supabase o Vercel. El README registra algunos estados
> remotos que fueron confirmados durante sesiones anteriores; cada agente debe
> separar esos registros documentales de una verificación remota hecha ahora.
> Nunca incluir aquí contraseñas, tokens, claves secretas, `service_role` ni el
> contenido de `.env.local`.

## 1. Instrucciones inmediatas para continuar

1. Trabajar en este workspace y revisar `git status` antes de editar. No tocar
   otros clones, el sitio Vercel del otro proyecto ni la aplicación Python que
   pudiera estar en otra carpeta.
2. No usar la contraseña de la cuenta humana `davidmonteros` compartida en una
   conversación. Tratarla como expuesta: el propietario debe cambiarla y cerrar
   sesiones activas. No guardarla en el repo ni reutilizarla para agentes.
3. La pestaña de auditoría IA añadida localmente es **solo lectura**. No contiene
   editor SQL, endpoint SQL genérico, clave privilegiada ni operaciones para
   modificar Supabase.
4. Antes de probar jugadas que cambien saldos, crear/confirmar un proyecto
   Supabase de staging aislado. No usar producción, saldo de `davidmonteros` ni
   borrar una cuenta para intentar deshacer apuestas: el ledger y los registros
   relacionados permanecen.
5. El propietario autorizó explícitamente aplicar la migración de auditoría
   read-only en producción y publicar el panel. La migración ya se aplicó y sus
   permisos básicos se verificaron; la página aún no está desplegada. No aplicar
   otras migraciones ni probar apuestas en producción.
6. La frase del usuario “todos los resultados salieron bien” se refiere a pruebas
   que dijo haber hecho otro agente. No se compartieron aquí sus consultas,
   capturas ni reportes; por tanto, no es evidencia reproducible ni validación
   independiente.

## 2. Estado actual del trabajo de auditoría IA

En esta sesión se preparó un primer panel de inspección controlada:

- `auditoria-ia.html`: página multipágina Vite, no enlazada desde el lobby.
- `js/ia-auditoria.js`: valida sesión, consulta el rol, llama una sola RPC fija,
  muestra el JSON de auditoría, permite refresco cada 15 segundos, descarga JSON
  y conserva logs de interfaz en `sessionStorage` de esa pestaña.
- `supabase/migrations/20261026200000_jva_readonly_platform_audit.sql`: migración
  para registrar el rol `ai_auditor` y agregar `jva_get_platform_audit()`.
- `administracion.html` / `js/administracion.js`: enlace a la página y vista
  reducida para un usuario que tenga únicamente rol `ai_auditor`.
- `vite.config.js`: entrada para la nueva página.
- `css/style.css`: estilos del panel.
- `README.md`: resumen operativo y límites.

La migración se aplicó al proyecto Supabase de producción tras verificar que el
sitio publicado apunta a ese proyecto y que la restricción esperada de
`jva_user_roles` existe. Consultas de catálogo confirmaron que
`jva_get_platform_audit()` existe, es `STABLE SECURITY DEFINER`, que el rol
`authenticated` puede ejecutarla y que `anon` no. Son comprobaciones de
instalación/permisos, no validan todavía el contenido del informe. No se consultó
el ledger con la RPC ni se modificaron datos financieros.

La página no se ha publicado todavía. El siguiente paso es desplegar los cambios
autorizados y crear una cuenta separada desde el registro público; hasta que el
propietario termine el alta y asigne `ai_auditor`, no se debe probar la RPC con
una identidad humana existente.

### Alcance de la RPC

La función `jva_get_platform_audit()` no recibe argumentos de SQL ni nombres de
tablas suministrados por quien llama. Su consulta estática construye un informe
de:

- relaciones del esquema `public` (tablas, tablas particionadas, vistas y tablas
  foráneas), columnas, tipos, nulabilidad, restricciones, índices y propietarios;
- estado RLS/force-RLS y políticas, comandos, roles y expresiones `USING` /
  `WITH CHECK`;
- funciones/procedimientos públicos: firma, retorno, propietario, `SECURITY
  DEFINER`, volatilidad y ACL de ejecución, sin retornar cuerpos de funciones;
- triggers públicos y sus definiciones, extensiones instaladas;
- privilegios catalogados de tablas y vistas;
- cuentas contables, saldo actual vs saldo calculado desde el ledger, totales
  débito/crédito, asientos no balanceados, reservas por juego y fondo/reserva/
  disponibilidad por juego.

La propia RPC autoriza únicamente a usuarios autenticados con rol
`super_admin`, `admin` o `ai_auditor`. La comprobación de interfaz no sustituye
esta autorización del servidor. La migración amplía el `CHECK` de roles para
admitir `ai_auditor`, pero el rol no entrega permisos root ni grants de escritura.
Una cuenta con solo `ai_auditor` no debe tener otros roles administrativos.
El panel no modifica permisos ni crea identidades de agente automáticamente.
Después de aplicar y validar la migración en el entorno acordado, crear una
identidad dedicada desde el formulario normal de registro de la web. El trigger
de `auth.users` exige metadata `username` y `whatsapp` para crear correctamente
el perfil, la seguridad de cuenta y el wallet inicial; crearla manualmente desde
Auth Dashboard puede omitir esa metadata. Usar un username único de 3–24
caracteres alfanuméricos/guion bajo y un WhatsApp internacional que el operador
controle. No depositar fichas ni usar una cuenta humana existente.

Luego, un operador autorizado debe asignarle únicamente `ai_auditor` desde el
SQL Editor del proyecto correcto. Reemplazar el marcador por el username de la
cuenta dedicada:

```sql
insert into public.jva_user_roles (user_id, role)
select user_id, 'ai_auditor'
from public.jva_profiles
where lower(username) = lower('<USERNAME_QA_DEDICADO>')
on conflict (user_id, role) do nothing;

select profile.username, roles.role
from public.jva_profiles profile
join public.jva_user_roles roles using (user_id)
where lower(profile.username) = lower('<USERNAME_QA_DEDICADO>');
```

La respuesta debe mostrar únicamente `ai_auditor`. Si aparecen otros roles,
detenerse y resolverlo con el propietario antes de iniciar sesión. Aunque esa
cuenta use la pantalla técnica de solo lectura, el rol `ai_auditor` por sí solo no
convierte todas las RPC de juego en consultas de lectura: como cualquier usuario
activo podría participar en un juego habilitado si tiene saldo. Por eso las
apuestas de QA van exclusivamente contra staging.

### Límites del panel

- La nueva RPC es una propuesta de informe aprobado, no una consola SQL.
- Los logs de la página son locales a la pestaña y no son un registro durable del
  servidor. Guardan tipo, tiempo, mensajes y resumen/errores; no son logs de cada
  query interna de PostgreSQL.
- El refresco de 15 segundos es periódico; no es una suscripción realtime ni
  garantiza capturar cada evento transitorio.
- El informe cubre objetos de `public` y auditoría económica seleccionada. No
  inspecciona el contenido de esquemas internos `auth`/`storage`, secretos,
  contraseñas, tokens, texto completo de funciones, logs internos del proveedor,
  planes de ejecución ni estado de Vercel.
- Todavía no incluye un orquestador que lance apuestas de prueba. Para ello se
  requiere staging, identidad de QA separada, datos sintéticos y una matriz de
  pruebas que use las RPC de juego ya existentes.
- La migración se parseó con `pglast`, se aplicó en producción y se verificaron
  por consultas de catálogo la función, la restricción y los grants básicos.
  El frontend pasó `npm run build`, `node --check` y `git diff --check`.
- Aún no se autenticó una cuenta `ai_auditor`, no se invocó la RPC para obtener
  el informe real ni se revisó el contenido/payload resultante. No afirmar que
  la auditoría de datos está completa hasta hacer esa validación y revisar el
  informe por posibles discrepancias.

## 3. Fuentes de verdad y discrepancias documentales

Orden recomendado para confirmar afirmaciones:

1. Código actual del workspace y `git status`.
2. Historial Git remoto y estado del deployment en Vercel, consultados en la
   sesión actual.
3. Historial de migraciones y estado de Supabase, comprobados en Dashboard/CLI
   en la instancia correcta.
4. README y este contexto: resúmenes; útiles, pero pueden quedar desactualizados.
5. `contexto-proyecto.md`, `codigo-total.md` y el cuerpo antiguo de
   `CONTEXTO-TRASPASO-IA.md`: referencias históricas, no estado autoritativo.

El `CONTEXTO-TRASPASO-IA.md` original mezcla requisitos y registros de distintas
fases: afirma que no existía despliegue/GitHub, aunque el estado posterior del
README y el historial Git ya muestran integración y commits. Tiene además una
sección que llama “vigentes” a las primeras migraciones y otras secciones con
arquitecturas previas descartadas. Consultar este archivo junto a
`HISTORIAL-PROYECTO.md`; no aplicar al presente cada instrucción histórica sin
verificación.

## 4. Producto y arquitectura

JVA es un frontend web multipágina construido con Vite y JavaScript ES modules.
Supabase es el backend de Auth, Postgres, RLS, RPC y datos. Vercel hospeda el
frontend. El código de la web vive en el repo existente; no es una app nueva
separada.

Regla estructural esencial: **el navegador presenta y anima; Supabase decide
resultados, valida operaciones financieras y escribe saldos/ledger de forma
transaccional**. Una animación jamás debe convertirse en la fuente de verdad de
un resultado.

### Carpetas y superficies principales

- `index.html`, `login.html`, `register.html`, `lobby.html`,
  `administracion.html`, `auditoria-ia.html`: rutas de aplicación web.
- `js/supabase.js`: crea el cliente con `VITE_SUPABASE_URL` y
  `VITE_SUPABASE_PUBLISHABLE_KEY`; falla explícitamente si faltan. Nunca colocar
  `service_role`/secret en frontend.
- `js/auth.js`, `js/session.js`: autenticación, perfil y sesión.
- `js/lobby.js`: catálogo de juegos visible según configuración pública y estado
  habilitado.
- `js/administracion.js`: operaciones de administración, caja, configuración,
  transferencias, sorteos, logs y auditoría contable.
- `juegos/loteria/`: juego web de cartones 15/25, vista previa, venta, historial
  y cobro.
- `juegos/tragamonedas/`: tragamonedas web, vista previa de premio y apuesta.
- `juegos/arcade/arcade.js`: interfaz común por `data-game-key` para Dados,
  Minas, Crash, Ruleta y Jackpot.
- `js/mesas.js`, `js/mesa.js`, `js/chatGlobal.js`: legado relacionado con mesas y
  chat. No es equivalente a los flujos nuevos seguros y no debe reactivarse como
  sistema financiero sin revisión/migración.
- `css/style.css`: sistema visual compartido, responsive, animaciones y soporte
  de movimiento reducido.
- `assets/img/games/`, `assets/sounds/`: arte y audio empaquetados por Vite.
- `supabase/migrations/`: esquema, funciones RPC y cambios incrementales.
- `main.py`: utilidad antigua que genera `codigo-total.md`; no es la terminal de
  caja Python/CustomTkinter.

`vite.config.js` enumera las páginas de compilación y usa `base: './'` para rutas
relativas en hosting estático. Node.js mínimo documentado: 20.19+ o 22.12+.

## 5. Estado de módulos de producto

### Identidad

- Login: nombre de usuario + contraseña. El usuario se traduce a un email
  sintético `lower(username)@accounts.jva.invalid` para Supabase Auth; no se
  envía correo.
- Registro: username, contraseña y WhatsApp internacional de contacto.
- El formulario prepara enlace de aviso al WhatsApp del organizador; el usuario
  debe confirmar/envíar el mensaje manualmente.
- Perfil y saldo se consultan mediante RPC.
- Esquema/Auth contempla límite de inicios y verificación manual; la activación
  del Auth Hook en Dashboard debe comprobarse remotamente.

### Economía

- Unidades en fichas enteras, no pesos.
- Un depósito físico debe corresponder a fichas físicas efectivamente recibidas;
  caja/tesorería no se debe inventar ni precargar.
- Ledger usa asientos de doble partida y cuentas para fichas físicas, wallets,
  ganancias de casa y fondos de premio separados por juego.
- Las funciones financieras deben comprobar sesión/rol, idempotencia, saldo,
  reserva, concurrencia y ledger en el servidor.
- La idea de casa 30% es el default técnico inicial descrito por el README; se
  ha pedido considerar 50% para modalidad inspirada en quiniela. No tratar esto
  como regla final universal ni como porcentaje oficial hasta definir modalidades
  y confirmar configuración real.

### Lotería

- La modalidad implementada es “Lotería 15 de 25”: 15 números diferentes del
  rango 1–25, no una implementación oficial de Quiniela o Quini 6.
- La web usa RPC para vista previa, emisión idempotente, historial y reclamo.
- Sorteo y liquidación se administran manualmente.
- No se ha integrado una terminal de caja/impresora Python a este esquema.
- El usuario pidió investigar Quiniela, Quini 6 y otras modalidades por separado;
  la investigación reglamentaria y la decisión de reglas aprobadas quedan por
  documentar antes de construirlas.

### Tragamonedas y arcade

- Tragamonedas: `jva_preview_slot_bet` y `jva_play_slots`.
- Arcade: Dados, Minas, Crash, Ruleta y Jackpot tienen páginas específicas y
  llaman a RPC de Supabase. Partidas activas y acciones de Mines/Crash son
  recuperables/idempotentes según el código/migraciones.
- Las animaciones muestran resultados ya confirmados por servidor.
- Juegos nuevos empiezan apagados/ocultos. Confirmar fondos y prueba en staging
  antes de habilitar uno.
- Jackpot abre y liquida sorteos mediante acciones administrativas; no hay
  scheduler automático pese a que exista `draw_interval_hours`.

### Administración

- Gestión de cuentas: buscar, activar, bloquear/desbloquear y archivar cuentas;
  la cuenta Auth no se crea desde el panel por falta de un backend seguro.
- Depósitos/canjes y summary financiero.
- Configuración de juegos y visibilidad de módulos; no es un editor visual tipo
  Jimdo/constructor de código.
- Transferencias de ganancias de casa al fondo de juego, no desde caja física.
- Auditoría del ledger con filtros, paginación y polling cada 5 segundos.
- Logs técnicos locales y descarga JSON.

## 6. Migraciones: estado documental y precaución

Archivos observados en el repo:

| Migración | Alcance | Estado anotado en README/documentación local |
|---|---|---|
| `20261025170000_jva_schema.sql` | esquema base, roles, RLS, Auth hook, ledger | Usuario confirmó aplicación en sesión previa; no consultado en vivo ahora |
| `20261025171000_jva_economy_rpcs.sql` | finanzas, juegos base, lotería, configuración | Usuario confirmó aplicación en sesión previa; no consultado en vivo ahora |
| `20261025180000_jva_username_auth.sql` | Auth por username | README/contexto registra aplicación previa; no consultado ahora |
| `20261025210000_jva_slot_pool_preview.sql` | pozo/apuesta mínima en preview slots | README dice que debe aplicarse; estado remoto pendiente de confirmar |
| `20261026120000_jva_account_archive.sql` | archivo/retiro de cuentas | README dice que se requiere para usarlo; confirmar remoto |
| `20261026150000_jva_original_arcade_games.sql` | fondos, RPC de arcade, rondas, jackpot | README registra que el usuario confirmó aplicación |
| `20261026160000_jva_arcade_config_jsonb_key_count.sql` | fix configuración arcade JSONB | README pide aplicar; confirmar remoto |
| `20261026170000_jva_game_fund_transfers.sql` | transferencias casa→fondo de juego | README pide aplicar; confirmar remoto |
| `20261026180000_jva_admin_ledger_audit.sql` | RPC de auditoría contable | README pide aplicar; confirmar remoto |
| `20261026200000_jva_readonly_platform_audit.sql` | role `ai_auditor` e informe de metadatos/conciliación | Aplicada en producción en esta sesión; RPC/grants verificados, informe aún no consultado con identidad autorizada |

El estado remoto solo se resuelve revisando el proyecto/ref correcto y la tabla
de versiones aplicada. No volver a ejecutar SQL manualmente solo porque aparezca
en este listado. La aplicación manual anterior de migraciones hace especialmente
importante reconciliar historial de versiones antes de usar `supabase db push`.

## 7. Seguridad y límites operativos

- Una página no es segura por no estar enlazada o por tener una URL difícil de
  adivinar. La autorización se hace en servidor/RPC con sesión y rol.
- `ai_auditor` debe ser cuenta de prueba propia y recibir solo ese rol. No
  añadirle roles `admin`/`super_admin`; esos roles permiten mutaciones.
- Nada en el panel IA ejecutará código SQL que venga del cliente. Cambios de
  esquema se preparan como migraciones versionadas, se revisan y se prueban en
  staging antes de aprobación para producción.
- Los permisos de `SECURITY DEFINER` y RLS son piezas críticas. Las funciones
  deben tener `search_path` seguro, grants estrechos, chequeos de rol y SQL
  estático cuando sea posible.
- Eliminar una cuenta no borra necesariamente apuestas, entradas, líneas de
  ledger ni eventos; no es rollback.
- El navegador necesita solo URL/key pública. Secrets solo backend protegido;
  no incluir credenciales en README, `.md`, SQL, frontend ni commits.
- No leer ni mostrar `.env.local`; el archivo está presente en este workspace y
  está excluido por `.gitignore`.

## 8. Objetivos pendientes, orden recomendado

1. Rotar la contraseña humana que se expuso en conversación y cerrar sesiones.
2. Obtener/confirmar evidencia de los resultados reportados por el otro agente,
   sin copiar credenciales.
3. Confirmar proyecto Supabase correcto, migraciones remotas, Auth Hook,
   variables de Vercel y estado Production/Preview.
4. Revisar la migración 20261026200000 línea por línea; ejecutar parser
   PL/pgSQL, probar en staging y verificar denegación a anon/roles sin permiso,
   permiso para `ai_auditor`, contenido de informe y tamaño.
5. Crear staging aislado. Configurar Vercel Preview para que use el proyecto
   staging, nunca producción. Crear cuenta QA distinta de cualquier operador
   humano, con rol mínimo y saldo sintético en staging.
6. Automatizar matriz de pruebas de cada RPC/juego en staging: apuesta válida,
   saldo insuficiente, fondo insuficiente, reserva, pérdida, premio, retry con
   mismo request_id, request_id diferente, partida activa, concurrencia, estado
   pausado, permisos, reconciliación y errores esperados.
7. Probar auditoría de esquema/ledger y conservar JSON/reportes de QA sin datos
   sensibles. Logs de interfaz local no son evidencia durable; exportar artefactos
   de test de staging con redacción.
8. Definir modalidad y modelo económico; separar la actual lotería 15/25 de
   Quiniela/Quini 6 y verificar reglas con fuentes oficiales antes de programar.
9. Diseñar alta segura de cuentas Auth de invitados y terminal de caja/impresión
   (Python/CustomTkinter, 58 mm) conectadas al mismo ledger y con rol de cajero.
10. Migrar mesas/chat legacy a RPC seguras, o mantenerlas fuera de navegación.
11. Añadir tests automatizados y pipeline CI; no existe suite de tests en npm ni
    `.github` workflow según la inspección actual.
12. Hacer limpieza de legado solo tras inspeccionar referencias/imports y confirmar
    con el usuario. Candidatos a evaluar: `codigo-total.md`,
    `contexto-proyecto.md`, `ejemplo.html`, `ejemplo.js`, `main.py`, módulos
    legacy `js/mesas.js`, `js/mesa.js`, `js/chatGlobal.js`, `js/historial.js`.
    No borrar durante una limpieza “por nombre”: `main.py` aún puede regenerar
    `codigo-total.md` y las rutas legacy pueden depender unas de otras.

## 9. Desarrollo local y validación disponible

Desde PowerShell, en la raíz:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
npm run build
```

`.env.local` ya está presente en esta máquina, pero nunca imprimir ni copiar sus
valores. Validaciones disponibles observadas: Vite build, `node --check` y
`git diff --check`. `pglast` está instalado localmente; su parseo sintáctico no
demuestra semántica/tipos/permisos ni ejecución real en Supabase. No hay suite
de tests declarada en `package.json`.

Deployment documentado: `https://juega-virtual-argentina.vercel.app`, proyecto
Vercel separado y conectado al repo; un push a `main` publica Production y otras
ramas pueden generar Preview. Variables Preview deben configurarse separadamente.
La disponibilidad actual debe comprobarse en Vercel; no asumir que el build local
produce un deployment.

## 10. Cómo retomar

Leer este documento y `HISTORIAL-PROYECTO.md`, comprobar `git status`, leer
`README.md` y revisar las migraciones relevantes. Para seguir el panel IA,
inspeccionar `auditoria-ia.html`, `js/ia-auditoria.js` y
`20261026200000_jva_readonly_platform_audit.sql`; comprobar que la migración no
se ha aplicado remotamente antes de preparar instrucciones. Mantener todo el QA
de apuestas en staging.
