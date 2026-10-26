# Juega Virtual Argentina

Aplicacion web multipagina en migracion a Supabase Auth y a una economia
transaccional con fondos de premios separados por juego.

## Estado actual

- Las migraciones locales son `supabase/migrations/20261025170000_jva_schema.sql`
  y `supabase/migrations/20261025171000_jva_economy_rpcs.sql`.
- El usuario confirmo que las tres migraciones iniciales ya fueron ejecutadas
  manualmente en Supabase sin errores. No volver a ejecutarlas.
- La migracion `supabase/migrations/20261025210000_jva_slot_pool_preview.sql`
  agrega el pozo disponible a la vista previa de tragamonedas. Debe ejecutarse
  manualmente en Supabase SQL Editor para mostrar el pozo acumulado; la interfaz
  identifica claramente que ese dato aun no esta disponible mientras falte la
  migracion.
- Fueron revisadas estaticamente con `pglast`, que solo confirma el parseo de las
  instrucciones SQL externas. No valida la ejecucion de PL/pgSQL, permisos,
  comportamiento de Supabase Auth, RLS ni transacciones en una base real.
- Se publico un deployment Production para la prueba del equipo en
  `https://juega-virtual-argentina.vercel.app`, en un proyecto Vercel separado
  del proyecto de la otra web. El nombre anterior incluia `-prueba`; el proyecto
  ahora se llama `juega-virtual-argentina`. El proyecto ya esta conectado con el
  repositorio `DavidMonteros1/Juega-Virtual-Argentina`; al subir cambios a `main`
  Vercel genera un nuevo deployment Production y las otras ramas generan Preview.
- Se actualizo el sistema visual compartido en `css/style.css` con una identidad
  de casino clasica en verde y dorado, componentes comunes y ajustes responsive
  para acceso, lobby, administracion, loteria, tragamonedas y mesa. Este rediseño
  ya esta publicado en el deployment de prueba.
- Las variables publicas de Supabase estan configuradas en Vercel Production.
  Los Preview Deployments todavia no tienen variables configuradas.
- La tragamonedas y la loteria usan RPC para decidir las jugadas, cobrar y pagar.
  Ambos juegos comienzan pausados; las mesas y el chat siguen sin migrar. El
  lobby no muestra esos modulos antiguos.
- Hay un panel inicial en `administracion.html` para buscar/activar cuentas,
  registrar caja, revisar saldos y configurar juegos/modulos. No puede crear
  cuentas Auth en nombre de un usuario: eso requiere un backend seguro que aun no
  existe; los participantes se registran desde la web.
- El sistema y la caja comienzan en cero. Cada acreditación en el panel debe
  corresponder a fichas físicas que el jugador entrega en ese momento: la RPC
  `jva_deposit_tokens` registra en un asiento balanceado el aumento de fichas
  físicas y del saldo del jugador. No hace falta una carga de apertura ni un
  capital ficticio. Los juegos permanecen apagados hasta que sus fondos de premio
  tengan cobertura.
- El panel ahora permite bloquear/desbloquear cuentas no administrativas. El
  bloqueo se valida en las RPC financieras y en el Auth Hook; si el Hook aun no
  se habilito, los bloqueos siguen impidiendo el uso de billetera/juegos desde
  el servidor, aunque el inicio de sesion pueda completarse.
- Durante la prueba, el registro sigue abierto y las cuentas nuevas conservan
  el comportamiento de hasta cinco inicios antes de pedir verificacion. Una URL
  discreta no restringe el acceso; revisa y bloquea cuentas desconocidas en el
  panel tan pronto las detectes.
- No hay aun integracion de la terminal local Python/impresora con este esquema.

## Desarrollo local

Requiere Node.js 20.19+ o 22.12+.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Completa `.env.local` con la URL del proyecto Supabase y su clave publica
(`publishable` o `anon`). No uses una clave `service_role`/`secret` en el navegador.
La clave publica no sustituye RLS ni autorizacion del servidor.

Para compilar:

```powershell
npm run build
```

## Reglas de seguridad y Supabase

La interfaz solicita nombre de usuario, contrasena y WhatsApp de contacto. Supabase
Auth usa internamente un email sintetico `nombredeusuario@accounts.jva.invalid`;
no se muestra ni se envia correo. Habilita el proveedor Email y desactiva la
confirmacion de email. No es necesario habilitar el proveedor Phone ni configurar
SMS. El conteo de inicios necesita habilitar manualmente el hook
`jva_password_verification_attempt` en Authentication > Hooks > Password
Verification Attempt. Sin ese hook remoto, el limite de cinco inicios no esta
activo. Las migraciones de esquema y username ya fueron aplicadas y la cuenta
administradora ya fue creada.

Despues de crear la cuenta organizadora, asigna su rol `super_admin` y activacion
desde SQL Editor. Sustituye el nombre por el username exacto:

```sql
insert into public.jva_user_roles (user_id, role)
select user_id, 'super_admin'
from public.jva_profiles
where lower(username) = lower('<nombre_de_usuario>');

update public.jva_account_security
set manually_verified_at = now(), verification_required = false
where user_id = (
    select user_id from public.jva_profiles
    where lower(username) = lower('<nombre_de_usuario>')
);
```

Ejecuta este SQL solo despues de crear la cuenta y reemplazar el marcador por su
username real. No compartas contrasenas, tokens CLI, claves secretas ni claves
`service_role`.

El usuario confirmo que las dos migraciones iniciales y la migración de username
terminaron sin errores en Supabase, y que su cuenta administradora entra al panel.
Esto no valida todas las RPC, RLS ni los flujos financieros. Para la prueba:

1. Crear las cuentas del equipo y activarlas en Administración.
2. Acreditar 100 fichas a cada integrante solo cuando se reciban las fichas físicas
   correspondientes. Cada movimiento queda balanceado y auditado; la caja inicia
   en cero y no se registra saldo inicial ficticio.
3. Mantener los juegos apagados hasta definir/aportar fondos de premio y comprobar
   las reservas.

No vuelvas a ejecutar las tres migraciones ya aplicadas ni ejecutes
`supabase db push` sin sincronizar primero el historial, ya que se aplicaron
manualmente desde SQL Editor.

## Despliegues Vercel

El sitio esta publicado en
`https://juega-virtual-argentina.vercel.app` y el repositorio GitHub esta
conectado al proyecto Vercel independiente de JVA. Un push a `main` publica
Production; los pushes a otras ramas generan Preview Deployments. Vercel usa el
directorio raiz, `npm run build` y el directorio de salida `dist`. Las variables
de Supabase estan configuradas para Production; configura tambien
`VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en Preview antes de probar
otras ramas. Las migraciones actuales ya fueron aplicadas manualmente; no las
vuelvas a ejecutar.

Para habilitar despliegues automaticos, sube primero el codigo validado a GitHub y
conecta la rama elegida al proyecto Vercel independiente de JVA. No reutilices el
proyecto Vercel de la otra web.
