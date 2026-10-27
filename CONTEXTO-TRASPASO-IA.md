# Contexto de traspaso de Juega Virtual Argentina

> Documento de continuidad para que otro asistente de IA pueda retomar el trabajo
> sin depender de la transcripcion de este chat. El contenido original fue escrito
> durante fases anteriores y puede contener estados obsoletos.
>
> **Estado operativo vigente:** consultar primero
> [`CONTEXTO-ACTUAL.md`](./CONTEXTO-ACTUAL.md) y el historial de hitos
> [`HISTORIAL-PROYECTO.md`](./HISTORIAL-PROYECTO.md). Este archivo se conserva
> como registro historico de requisitos y decisiones, no como fuente vigente para
> deployment, commits, estado de Supabase, credenciales o tareas ya completadas.
> No ejecutar sus instrucciones historicas sin contrastarlas con el repositorio y
> con el estado remoto actual.
>
> **Advertencia operativa:** el usuario confirmo que las tres migraciones se
> ejecutaron manualmente en el Supabase `frbnaypbmwahbytxqzwl` y finalizaron sin
> errores. Esto no certifica Auth, RLS ni los flujos financieros/juego. No volver
> a ejecutar estas migraciones. No pedir, escribir ni exponer claves
> `service_role`/`secret`.
>
> **Alcance del historial:** este archivo NO es una transcripcion literal de todo el
> chat. Resume las decisiones, requisitos, estado y riesgos tecnicos considerados
> importantes para continuar. No contiene cada mensaje del usuario, cada respuesta
> ni todas las capturas/eventos de la conversacion. Si un detalle no aparece aqui,
> el siguiente asistente debe confirmarlo con el usuario en vez de asumirlo.

## Estado vigente tras aplicar esquema y corregir el login

- Las migraciones vigentes son `supabase/migrations/20261025170000_jva_schema.sql`
  (esquema y RLS) y `supabase/migrations/20261025171000_jva_economy_rpcs.sql`
  (RPCs de autenticacion, contabilidad, loteria, tragamonedas y modulos). El SQL
  anterior `20261024220000_jva_platform.sql` ya no existe en el repo; las notas de
  las secciones historicas que lo describen no aplican al esquema actual.
- La migracion crea billeteras individuales, cuentas de fichas fisicas, ganancias
  de la casa y fondos de premios separados por juego. Los fondos comienzan en 0,
  la comision inicial es 30% y cada juego inicia deshabilitado. No existe pozo
  general ni aporte inicial de 5.000 fichas.
- Se corrigio el `CHECK` de numeros unicos de cartones para no usar una subconsulta
  invalida. Las RPC controlan saldos en transacciones balanceadas, reservas,
  pagos, snapshots de premios, activacion manual, configuracion y auditoria.
- `js/auth.js` consulta el perfil/billetera mediante `jva_get_my_profile`.
  `js/lobby.js` solo muestra modulos habilitados y migrados. La tragamonedas usa
  `jva_preview_slot_bet`/`jva_play_slots`; se elimino su sorteo financiero local.
  Se agrego `juegos/loteria/` para previsualizar premios, emitir cartones, ver
  historiales y reclamar premios.
- Se agrego un panel inicial `administracion.html` para buscar/activar usuarios,
  acreditar/canjear, consultar resumen financiero, ajustar juegos/modulos y
  abrir/liquidar sorteos. No crea usuarios Auth; eso requiere un backend seguro
  aun pendiente.
- El canje de fichas por fichas fisicas ahora exige rol de caja/administracion
  en la RPC, incluso si un jugador intenta invocarla directamente sin usar la GUI.
- Se agrego bloqueo/desbloqueo administrativo de cuentas no administrativas,
  motivo obligatorio y auditoria. El bloqueo se comprueba en
  `jva_require_active_user` y en Auth Hook; el panel informa la cuenta bloqueada.
  El canje administrativo permite retirar fichas de una cuenta bloqueada, pero
  no permite que esta use su billetera ni juegue. Aun asi, el registro esta
  abierto y el flujo de cinco inicios previo a la verificacion se conserva.
- El requisito confirmado es login con nombre de usuario y contrasena; WhatsApp
  es solamente un dato de contacto para que el equipo contacte al usuario. La
  implementacion anterior de autenticacion con telefono fue un error y esta
  siendo reemplazada localmente. La GUI ahora pide username y password, y el
  registro captura WhatsApp como contacto. Supabase Auth recibe internamente
  `lower(username)@accounts.jva.invalid`; no se muestra ni se envia correo.
- Las dos migraciones iniciales y `20261025180000_jva_username_auth.sql` ya se
  ejecutaron manualmente por el usuario. Antes, confirmo que Authentication no
  contenia cuentas.
- Para el Auth nuevo: proveedor Email esta habilitado, registro permitido y
  confirmacion de correo desactivada (confirmado visualmente por captura). No
  hace falta habilitar Phone ni SMS.
- La cuenta del usuario ya se registro desde el entorno local; despues ejecuto en
  SQL Editor un bloque para asignar `super_admin` y activacion, y confirmo que
  entro al panel y lo vio correctamente. Falta probar sus operaciones.
- `.env.local` ya existe en la maquina con URL y clave publishable; no revelar sus
  valores. El servidor Vite local esta activo en `http://localhost:5173` y se
  verifico HTTP 200 para `/register.html`.
- El usuario solicito poner el sistema online para que el equipo se registre y
  pruebe. Se creo un proyecto Vercel separado llamado
  `juega-virtual-argentina-prueba`, sin reutilizar el Vercel existente
  `superfacil-david`. Se configuro Supabase URL y clave publicable solo en el
  entorno Production de Vercel (variables Preview aun pendientes) y se publico
  `https://juega-virtual-argentina-prueba.vercel.app`. Vercel CLI informa target
  `production`, estado `Ready` y alias asignado. Se verificaron HTTP 200 para `/`,
  `/register.html`, `/login.html`, `/administracion.html` y
  `/juegos/loteria/index.html`.
- El deployment se envio directamente desde el workspace local con Vercel CLI;
  los cambios NO se han cometido ni empujado a GitHub, y el repo no se ha
  conectado con Git a este proyecto Vercel. Es una publicacion manual persistente,
  pero los cambios futuros no se desplegaran automaticamente. El `.env.local`
  permanece ignorado por Git; Vercel creo `.vercel/.env.production.local`, tambien
  ignorado. No mostrar ninguno de esos valores.
- Advertencia para el equipo: registro abierto y URL de Vercel accesible
  publicamente. Cualquiera que descubra el enlace puede intentar crear cuenta;
  no es un entorno privado ni un lanzamiento validado. Los juegos permanecen
  apagados. El usuario quiere detectar y bloquear cuentas ajenas manualmente.
- Se había interpretado erróneamente el conteo de 1.000 como inventario inicial
  que debía precargarse. El usuario aclaró que economía/caja empiezan en cero y
  que el equipo recibirá 100 fichas por jugador desde caja como en una fiesta.
  Revisado el ledger: `jva_deposit_tokens` debita físicamente la cuenta `physical_tokens`
  (lado normal debit, suma activos) y acredita el pasivo de billetera del jugador
  en el mismo asiento. Por tanto, cada entrega física real incrementa ambos
  balances, no se necesita inicialización ni capital ficticio. Se retiraron el
  formulario y la migración de apertura que se habían preparado por error; NO
  ejecutar ningún SQL nuevo por este tema.
- El Auth Hook para limitar los inicios necesita configuracion manual en
  Supabase Dashboard; no se ha activado remotamente. Los juegos siguen pausados
  por defecto.
- Validacion local final: `npm run build` paso despues de retirar la pantalla
  erronea de inventario; `git diff --check` paso. Build remoto de Vercel tambien
  paso, deployment Ready; rutas publicas devuelven HTTP 200. Esto no prueba
  RPCs financieras, RLS, Auth Hook ni concurrencia.
- No se instalo `psql`, PostgreSQL, Docker o Supabase CLI; no hubo commit/push a
  GitHub. Se vinculo workspace y se desplego por CLI a un proyecto Vercel nuevo,
  sin Git integration. La compilacion local y la remota pasan. El
  usuario prefiere lanzar para una prueba interna usando el enlace y bloqueo
  manual desde el panel; explicarle que el enlace discreto no es control de acceso.
- Siguen pendientes: subir el codigo a GitHub en una rama segura, conectar
  automatizaciones GitHub-Vercel sin modificar la pagina existente; configurar
  Preview vars; probar una acreditación de 100 fichas por integrante solo cuando
  esas fichas físicas se entreguen; pruebas reales de RPC/seguridad/concurrencia,
  alta segura de
  cuentas Auth desde el panel, editor de plantillas, mesas y chat server-side,
  impresion/descarga de cartones, integracion de la app Python local y validacion
  del hook. El lobby omite
  deliberadamente las mesas/chat legacy y solo habilita tragamonedas/loteria
  cuando las RPC de configuracion indiquen que pueden usarse.

### Historial de avance del 25 de octubre de 2026 (previo al esquema vigente)

- El usuario solicito implementar el proyecto completo, preparar un SQL seguro para
  Supabase con historial de implementaciones y dejar Vercel preparado para ver
  previews. No se autorizo que se aplique una migracion sin revisarla ni que se
  despliegue a produccion.
- Se agrego Vite y scripts `dev/build/preview`, soporte para todas las paginas HTML
  actuales, `@supabase/supabase-js`, `.env.example` y exclusion de secretos/artefactos
  locales en `.gitignore`. `js/supabase.js` ya no contiene endpoint/clave antiguos:
  exige `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Nota histórica obsoleta:** una instrucción anterior equivocadamente describió
  login por teléfono. El requisito correcto y vigente es username + contraseña;
  WhatsApp es dato de contacto. La configuración phone/password fue reemplazada
  localmente por username/password con email sintético no entregable.
- Se corrigieron rutas absolutas de GitHub Pages en `juegos/mesa.html` a rutas
  relativas; el build nuevo las habia detectado como imports no resolubles.
- `npm install` y `npm run build` finalizaron correctamente tras el cambio Auth.
  Mesas, tragamonedas, historial y chat siguen conectados a tablas/logica legacy;
  la aplicacion aun no es funcional contra el esquema nuevo. No hay deploy Vercel ni
  conexion Supabase real.
- El chat y las listas del lobby/mesa ahora renderizan los campos dinamicos como
  texto en vez de insertarlos con `innerHTML`; errores al cargar mesas se propagan al
  UI, no se convierten silenciosamente en una lista vacia.
- Se creo `README.md` con pasos locales, variables publicas, estrategia Vercel y
  recordatorio de no ejecutar la migracion actual. Para mantener historial SQL se
  recomienda CLI/migraciones versionadas, no pegar SQL en el Dashboard.
- `npx supabase@latest init` inicializo `supabase/config.toml`; proyecto local
  nombrado `jva-platform`, semilla desactivada y redirects locales de Vite. No se
  ejecuto `supabase link`, `db push`, SQL Editor ni ninguna conexion remota.
- Pendiente antes de aplicar remoto: confirmar que el Supabase seleccionado es el
  proyecto nuevo correcto y si esta vacio o tiene datos; conseguir su referencia
  mediante Dashboard (sin compartir secretos en el chat); terminar/redisenar y
  probar migraciones. El repo tiene los cambios locales sin commit/push.
- Confirmacion del usuario/captura del 25-10: esta cuenta/proyecto Supabase es nueva,
  reemplaza la cuenta vieja de este proyecto y Table Editor en `public` muestra "No
  tables or views". La captura anterior del overview tambien mostraba "No migrations".
  Tomar como instancia nueva/vacia en public para continuar el esquema; antes de un
  futuro `db push`, verificar por CLI el historial remoto y el project ref seleccionado.

## 1. Instrucciones de continuidad para el siguiente asistente

1. Continua en el repo local descrito abajo. No cambies el espacio de trabajo ni
   toques clones, respaldos u otros proyectos.
2. Trabaja con cambios pequenos y verificables. Informa avances concretos en el
   chat cuando completes una fase; no digas que trabajaras en segundo plano entre
   mensajes. No dejes al usuario esperando por un trabajo que no sigue ejecutandose.
3. El usuario necesita instrucciones muy claras y secuenciales, en espanol, y se
   confundio razonablemente sobre la diferencia entre:
   - ejecutar SQL en Supabase para crear el esquema;
   - conectar el sitio al proyecto con la URL y la clave publica;
   - desplegar el sitio desde GitHub a Vercel.
   Explicar cada paso sin implicar que tener Supabase abierto en el navegador da
   acceso al asistente. El usuario realiza las acciones del Dashboard y confirma
   el resultado.
4. No volver a afirmar que la migracion es segura para ejecutar basandose solo en
   que un parser acepte su sintaxis. Antes de recomendar ejecutar SQL, revisar el
   contenido completo, permisos, semantica, flujo de Auth y compatibilidad con el
   estado real de la base. Confirmar con el usuario que se encuentra en el proyecto
   nuevo correcto y si ya tiene datos; no presumir que esta vacio.
5. Nunca inventar URL/keys. Cuando sea el momento de configurar la web, usar solo
   Project URL y una clave publica `publishable`/`anon`; preferir que el usuario
   las guarde localmente o en variables de entorno y Vercel, no pegarlas en el chat.
   Nunca poner una clave privilegiada en JavaScript del navegador.
6. No hacer push, ejecutar migraciones, crear/configurar un proyecto Vercel ni
   publicar un deploy sin instruccion y confirmacion del usuario para esa accion.
7. Si una herramienta de otro modelo no puede leer este archivo, pedirle al usuario
   que lo abra o comparta en el chat. Los archivos `contexto-proyecto.md` y
   `codigo-total.md` existentes son referencias antiguas y estan excluidos por
   `.gitignore`; no asumir que representan el sistema nuevo.

## 2. Objetivo final y alcance acordado

Relanzar **Juega Virtual Argentina (JVA)** desde su repositorio GitHub existente,
integrando un proyecto Supabase nuevo y, tras validar el funcionamiento, desplegar
la web en un proyecto Vercel nuevo. Se quiere conservar GitHub Pages como version
de respaldo hasta verificar Vercel y no interferir con otros proyectos web del
usuario.

La plataforma debe recuperar los juegos y funciones existentes, modernizar
autenticacion y operaciones economicas, integrar una loteria de cartones de 15
numeros unicos entre 1 y 25, y admitir un panel maestro configurable.

El pedido original incluyo una aplicacion de escritorio para caja/loteria:

- Python con CustomTkinter y SDK de Supabase.
- Venta de cartones y acceso a pozo/pronostico de premios.
- Precio configurable y logotipo en blanco y negro.
- Impresion termica de 58 mm con ID unico, 15 numeros y escala de premios
  calculada al emitir; opciones mencionadas: `win32print` o `python-escpos`.
- Consulta de historial, impresion/copia del carton para compartir manualmente.

La aplicacion de escritorio existente referida en el historial estaria en otra
carpeta (`C:\Users\HP ZBook\Documents\david\programacion\loteria`), **fuera del
workspace actual**. El checkpoint anterior informa que ahi se habian creado
`loteria.py`, `supabase_setup.sql`, `requirements.txt` y `README.md`, con pruebas
locales de logica, GUI y ensamblado ESC/POS simulado. Esas pruebas no verifican
la conexion con el Supabase nuevo. No editar esa carpeta ni asumir que esa app ya
esta integrada sin inspeccion/autorizacion.

## 3. Conversaciones y decisiones importantes

### Repositorio y alcance

- El usuario decidio trabajar sobre el JVA existente, no crear un producto/repositorio
  nuevo.
- Quiere poder ver los cambios en VS Code y pidio explicitamente conservar este
  workspace; no moverlo.
- Repo remoto: `DavidMonteros1/Juega-Virtual-Argentina`.
- Clon activo:
  `C:\Users\HP ZBook\Documents\david\juega virtual argentina proyecto\pagina en git\Juega Virtual Argentina multijugador`
- Rama observada: `main`; remoto `origin` apunta al repo indicado.
- Hay otros proyectos/clones y respaldos locales. No confundirlos con este repo y
  no modificarlos.

### Hosting y despliegue

- El usuario ya despliega otros sitios en Vercel desde repos GitHub y quiere hacer
  lo mismo con JVA.
- Decision: mantener el repo existente en GitHub, crear/vincular un proyecto Vercel
  para este repo, y mantener GitHub Pages hasta validar Vercel. No crear un repo
  nuevo salvo que el usuario cambie expresamente de idea.
- Una vinculacion GitHub no es requisito para que una web use Supabase.
- Aun no hay configuracion local de Vercel ni despliegue de este trabajo.
- La ruta `juegos/mesa.html` usa una ruta absoluta especifica de GitHub Pages
  (`/Juega-Virtual-Argentina/`); corregirla o centralizar rutas antes de publicar
  en Vercel, respetando el comportamiento actual hasta probar ambos hosts.

### Supabase

- El usuario creo un proyecto Supabase nuevo. Capturas anteriores lo mostraban
  como saludable, llamado `juega-virtual-argentina`/Juega Virtual Argentina, en
  **East US (Ohio), `us-east-2`**. No se confirmo via conexion directa.
- El usuario pregunto por cambiar/seleccionar region; la region reportada del
  proyecto creado es Ohio, no Sao Paulo. La eleccion no impide conectar el sitio.
- No se conecto a GitHub y no hace falta hacerlo para la integracion web.
- El navegador abierto del usuario no da al asistente acceso remoto al Dashboard.
- No se recibieron URL ni clave nuevas. El usuario no debe enviarlas ahora. Las
  credenciales viejas del frontend no sirven para el proyecto nuevo.

### Registro, verificacion y fichas

- Sin email ni verificacion por email.
- Registro deseado: telefono de WhatsApp + contrasena + nombre publico de usuario.
  Se propuso Supabase Auth con telefono/contrasena. Sin proveedor SMS/OTP, el numero
  no queda automaticamente verificado por Supabase.
- El usuario quiere saldo inicial de **0 fichas**. El bono de bienvenida debe ser
  configurable; el borrador SQL lo inicia en 0.
- La sesion que inicia tras registrarse no cuenta contra el limite. Luego se acordo
  un maximo inicial configurable de **5 inicios posteriores** antes de requerir
  verificacion manual presencial.
- Despues del limite, la app debe explicar el bloqueo y permitir abrir WhatsApp al
  organizador con texto prellenado; la persona aun debe pulsar Enviar. No se acordaron
  mensajes automaticos ni WhatsApp Business API.
- El organizador confirma la identidad presencialmente y puede emitir/comunicar un
  codigo de verificacion. No tratar el codigo como sustituto de la revision presencial.
- Roles previstos: `super_admin`, `admin`, `cashier`; el primero debe habilitarse
  explicitamente para una cuenta organizadora despues de registrar esa cuenta.
- Fichas de juguete fisicas y digitales: conversion 1:1. Cartones y juegos usan la
  misma unidad digital entera. Las fichas no representan pesos en el modelo actual.
- La venta por caja se asocia a una cuenta y la app imprime el carton. El usuario
  quiere historial e impresion/copia para envio manual por WhatsApp.
- El numero organizador se habia propuesto en SQL como `5491157054802`, partiendo
  del `1157054802` indicado en un checkpoint anterior. **Pendiente confirmar que
  sea el numero y formato correctos** antes de usarlo.

### Loteria y administracion

- Carton: 15 numeros distintos del 1 al 25.
- Categorias de premios: 15, 14, 13, 12 y 11 aciertos.
- Venta digital: debitar el precio en fichas de la cuenta, asociar y guardar el
  carton, snapshot del pozo/premios al emitir y permitir descargar/ver el carton.
- Venta fisica por caja: asociarla a una cuenta, registrar operador, metodo fisico,
  guardar carton y actualizar el pozo.
- Precio, porcentaje del precio que contribuye al pozo y reparto de premios deben
  poder previsualizarse y configurarse en un panel maestro.
- Se desean editores visuales configurables para el carton web y el termico. El
  borrador de SQL almacena definiciones JSON, pero **no existe editor visual
  implementado** y JSON almacenado no equivale a un editor seguro.
- El panel debe permitir modificar reglas de negocio permitidas, orden/visibilidad
  de modulos y plantillas validadas. No debe poder cambiar roles, claves, secretos,
  politicas o invariantes de seguridad. No habilitar un juego que aun no este
  implementado.

### Aclaraciones nuevas del usuario (25 de octubre de 2026)

Estas aclaraciones son requisitos de producto expresados directamente por el usuario
y complementan las decisiones anteriores. No significan que las funciones ya esten
implementadas.

#### Registro, WhatsApp y activacion

- Formulario de registro: nombre de usuario, contrasena y numero de WhatsApp.
- Tras registrarse, el usuario quiere iniciar una solicitud de WhatsApp al organizador
  `1157054802` con texto similar a: "Me registre en Juega Virtual Argentina" e
  identificacion por nombre de usuario. El usuario debe poder completar el registro
  y entrar aunque no envie ese mensaje.
- Si la cuenta no fue activada y ya consumio sus cinco inicios permitidos, en el
  siguiente intento se debe bloquear el acceso y mostrar una ventana con el texto
  "Debes confirmar tu cuenta por WhatsApp para seguir jugando" y boton
  "Verificar mi cuenta por WhatsApp". El boton abre WhatsApp con un mensaje
  prellenado que el usuario envia manualmente.
- Administrador, desde un panel web de administracion, debe buscar una cuenta y
  activarla permanentemente. La activacion manual no debe volver a expirar ni volver
  a aplicar el limite de inicios.
- El usuario tambien quiere que administradores creen y editen cuentas desde el
  panel para participantes que no se registraron solos, y asignen saldo digital.
  Esto necesita operaciones privilegiadas del lado servidor; no dar `service_role`
  al navegador ni guardar contrasenas en perfiles/tablas propias.
- Detalle pendiente: confirmar si, al registrarse, el sitio debe abrir enseguida
  WhatsApp en otra pestana/ventana con texto prellenado, o mostrar un boton para
  que la persona decida abrirlo. WhatsApp web/app no debe enviar un mensaje sin
  confirmacion manual del usuario.

#### Editor modular y marketplace de componentes

- El objetivo de administracion es una experiencia tipo constructor visual sencillo
  (referencia del usuario: Jimdo): desde el panel se deben poder colocar, ordenar,
  editar, ocultar/quitar elementos y consultar componentes/juegos disponibles.
- Juegos, widgets y futuras secciones deben ser modulos relativamente independientes,
  agregables a paginas/zonas sin tener que rehacer el CSS o todos los archivos
  existentes. El equipo podra desarrollar un modulo nuevo y registrarlo para que el
  administrador decida si lo incorpora a una pagina.
- El editor no debe permitir inyectar HTML, JavaScript o CSS arbitrario desde el
  panel. Implementar catalogo/allowlist de modulos con esquemas de configuracion,
  bloques visuales permitidos, estilos encapsulados y renderizador controlado.
- Alcance del constructor aun no acordado: no asumir que equivale a editar
  libremente todas las paginas, escribir codigo o crear componentes nuevos desde el
  navegador. Definir limites y UX simple antes de implementarlo.

#### Fichas, premios y contabilidad

- La plataforma se usa en fiestas/eventos de entretenimiento con fichas/monedas de
  juguete; no se pretende manejar dinero real ni pagos monetarios.
- Participantes encuentran monedas fisicas en una actividad de busqueda del tesoro
  y las llevan a caja. El administrador identifica la cuenta y acredita la cantidad
  correspondiente de fichas digitales.
- Toda la plataforma web y la terminal local Python deben usar un unico saldo
  digital por cuenta y una unica fuente de verdad en Supabase.
- Caja puede crear cuentas para invitados que no tengan usuario, asignar/cargar
  fichas digitales y venderles cartones desde la terminal Python; las operaciones
  deben quedar asociadas al participante y al cajero.
- Al terminar el evento, el usuario puede ir a caja para canjear las fichas digitales
  que correspondan por fichas fisicas de juguete, para otras actividades del evento.
- Se requiere registro trazable de cada emision, carga, apuesta, cobro, devolucion,
  transferencia, premio, venta de carton, canje y ajuste de caja. Debe poder
  investigarse una discrepancia o abuso; libro de movimientos no editable por clientes.
- La reserva fisica disponible limita premios: antes de acreditar un premio, el
  servidor debe verificar saldo/reserva suficiente en caja. No emitir premios que
  la organizacion no tenga respaldados.
- Administracion necesita un panel para monitorear fichas emitidas/canjeadas,
  saldos, transacciones, movimientos y resultado economico de la casa, detectar
  diferencias entre respaldo fisico y saldos digitales, y auditar operadores.
- El usuario comparo el rigor deseado con una criptomoneda para evitar fichas
  fantasmas. Es un requisito de robustez/auditoria, no una decision de usar
  blockchain. Considerar primero un ledger contable transaccional e inmutable,
  restricciones de DB, idempotencia, control de concurrencia, balanceo/reconciliacion
  y auditoria. Blockchain no se ha pedido ni aprobado como tecnologia.
- Juegos pueden pertenecer a dos categorias configurables:
  1. juegos de costo/consumo de fichas sin premio;
  2. juegos de apuesta donde se pueden ganar fichas.
  Para juegos con premios, validar en el servidor el respaldo/reserva de la caja
  antes del pago. Los juegos de azar deben tener probabilidades/reglas transparentes
  y resultados definidos por servidor, no ajustados en el navegador.
- El objetivo expresado es que la casa mantenga viabilidad y aumente su saldo neto
  en cada fiesta. Una ventaja estadistica sola no garantiza ese resultado; el usuario
  acepto explorar un modelo de presupuesto/margen, limites de liability y reservas,
  con rechazo/pausa antes de aceptar jugadas no cubiertas. Aun falta formalizar la
  definicion contable y probar el algoritmo; no prometerlo hasta hacerlo.
- Escala: lanzamiento en eventos pequenos, no mas de unos 20 jugadores simultaneos
  esperados. Diseñar para esa carga inicial con concurrencia correcta y camino de
  crecimiento; el usuario tambien menciono un promedio de hasta 100 participantes
  y hasta 50 jugando simultaneamente en eventos futuros. Esos valores no reemplazan
  pruebas de carga ni limites transaccionales.

#### Loteria: aclaracion pendiente por posible incompatibilidad de concepto

- El usuario ahora desea que la experiencia imite "a la perfeccion" la quiniela
  argentina, con diferentes premios segun aciertos y una comision de casa de 50%
  del valor del carton (o el porcentaje usado por la quiniela argentina).
- En una aclaracion posterior, el usuario indico que quiere ofrecer cada modalidad
  como un juego separado y pidio investigar las reglas reales de la Quiniela
  argentina, Quini 6 y otras modalidades, sus categorias de premio y probabilidades.
  No unificar quiniela y Quini 6 como si fueran el mismo producto; verificar con
  fuentes oficiales antes de modelar sus formatos.
- Interpretacion de trabajo pendiente de confirmacion: conservar el carton propio
  15/25 como modalidad independiente y agregar cada modalidad real investigada como
  juego separado. No convertir silenciosamente el carton existente en Quiniela o
  Quini 6. El usuario pidio la investigacion, aun no se le ha presentado el resultado.
- El porcentaje `pool_contribution_percent=50` del borrador y el reparto de premios
  40/25/15/12/8 son valores tecnicos provisionales, no reglas aprobadas por el
  usuario. No describirlos como reglas oficiales argentinas ni como valores definitivos.
- El usuario solicita que el panel admin permita editar por modalidad tipo/formato
  de jugada, cantidad de numeros, categorias de premios, porcentajes o importes,
  probabilidades y parametros de ganancia esperada. Los parametros deben validarse
  contra las reglas autorizadas del juego, limites de riesgo y reservas; no aceptar
  configuraciones matematicamente contradictorias ni modificar resultados en curso.

### Respuestas del usuario a las preguntas de aclaracion (25 de octubre de 2026)

- **Modalidades:** quiere cada modalidad por separado y solicita investigacion de
  Quiniela argentina, Quini 6 y otras modalidades; incluir reglas y categorias reales
  y hacer que las reglas aprobadas se administren por modalidad. Quiere que se
  investiguen los juegos/modos encontrados oficialmente, se separen en el producto
  y se adapten importes/premios a fichas. No ha dado una lista priorizada cerrada.
- **Comision:** investigar porcentajes oficiales/reales antes de fijar la comision;
  el usuario no confirma que 50% sea el porcentaje definitivo.
- **Respaldo fisico:** eligio reserva separada para premios. Como modelo a validar,
  separar al menos: fichas fisicas recibidas que respaldan saldo/canje de jugadores;
  reserva de premios de la casa; ingresos/comision de la casa. Evitar contar una
  misma ficha fisica simultaneamente como saldo canjeable y como reserva de premio.
- **Limite de premios:** quiere comprobar reservas antes de aceptar la apuesta/jugada,
  limitando o pausando la actividad cuando la exposicion posible supere lo disponible.
- **WhatsApp despues del registro:** mostrar un boton opcional desde la pantalla de
  registro exitoso; no abrir/enviar obligatoriamente. Texto prellenado; envio manual.
- **Cuentas admin:** al elegir la opcion "participante registra", el usuario indico
  que el participante define su clave al registrarse y la administracion activa la
  cuenta. Para primera version asumir auto-registro + busqueda/activacion/carga por
  admin; no implementar creacion privilegiada de cuentas desde panel salvo nueva
  instruccion.
- **Constructor visual:** ademas de componer paginas con modulos programados, quiere
  bloques genericos de contenido de texto e imagenes desde el panel. No permitir
  HTML/JS/CSS arbitrario. Definir limites de tamanos, almacenamiento, tipo de imagen,
  permisos y moderacion.
- **Ganancia de la casa:** el usuario quiere que el saldo neto propio de casa aumente
  con la actividad. Acepta retenciones y topes configurables, y pausar/bloquear
  jugadas antes de comprometer premios que el fondo propio del juego no puede cubrir.
  Porcentaje inicial decidido: 30% para casa, editable por juego. Cada apuesta se
  divide entre ganancia de casa y fondo de premio del mismo juego. Premios no
  reclamados no caducan; mantener su obligacion/liability hasta que se paguen. No
  contar wallet o fondos de premio como ganancia de casa.
- **Fondos iniciales (decision corregida):** el fondo de premios de cada juego y la
  caja de ganancias inician en 0; no usar una inversion global inicial de 5.000
  fichas para financiar premios. El saldo digital unificado de cada participante se
  acredita contra fichas fisicas recibidas por caja conforme a la politica de respaldo.
- **Fondos por juego (modelo acordado):** cada juego recibe las apuestas debitadas
  de sus propios jugadores. Inicialmente, 30% se separa como ganancia de casa y el
  70% restante ingresa al fondo exclusivo de premios/liability de ese juego; el
  porcentaje se puede configurar por juego antes de habilitarlo. La casa puede
  retirar ganancias de circulacion mediante operacion auditada o dejarlas acumuladas.
  No mezclar fondos de premio entre juegos. Un 30% retenido no equivale a garantia
  de ganancia neta ante retiros, errores contables o subsidios externos: mantener
  separados, conciliados y auditables todos los flujos.
- El usuario aclaro que las fiestas son recurrentes y puede haber varias en un dia
  o en dias distintos; el sistema economico debe permanecer continuo, sin cerrar o
  liquidar fondos por finalizar una fiesta. Los fondos de cada juego/modalidad se
  conservan entre fiestas. Esta aclaracion mas reciente reemplaza la decision
  anterior de transferir el remanente al terminar una fiesta; no hacer esa
  transferencia automatica.
- **Decision sobre premios:** mantener multiplicadores con tope y bloquear/rechazar
  la jugada antes de aceptarla si el fondo no puede cubrir el maximo anunciado.
  Nunca aceptar la jugada y recortar el premio despues de conocer el resultado.
- **Arranque en cero:** el usuario eligio un tope dinamico. Dentro de una transaccion,
  se debita la apuesta, se separa el porcentaje de casa y se suma su parte al fondo
  propio del juego; con el saldo resultante se calcula el maximo cubierto, se informa
  al jugador antes de confirmar y se reserva la liability. Si una jugada/modo no cabe
  en el fondo tras agregar la apuesta, se bloquea antes de aceptarla. No crear capital
  semilla para hacer arrancar el premio.
- La semantica del premio (importe total acreditado, incluyendo apuesta cuando
  corresponda, o ganancia neta adicional) se configura expresamente por juego antes
  de abrir jugadas. Versionar y congelar reglas/liability para apuestas ya aceptadas.
- **Premios no reclamados:** decision mas reciente: no caducan. No liberar su
  liability ni transferirla a ganancias por antiguedad o fin de fiesta.
- **Carga:** el objetivo inicial de operacion sigue siendo menos de ~20 jugadores
  simultaneos por evento; disenar para esa carga con margen, medir y probar antes de
  afirmar soporte para 50 simultaneos/100 participantes.
- **Modalidades exactas para la primera version:** el usuario quiere que se investigue
  el catalogo oficial y se ofrezcan juegos/modalidades diferentes como juegos
  separados, identificados por su tipo de jugada y premios. No quiere mezclar
  reglas distintas en el mismo carton. La lista completa y prioridad de implementacion
  siguen por definirse despues de presentar el relevamiento oficial.
- **Resultados:** el usuario eligio sorteos ficticios propios para cada evento, con
  reglas y experiencia inspiradas en modalidades reales; no integrar resultados
  oficiales como dependencia del juego.
- **Premios adaptados:** investigar reglas, categorias, cuotas/porcentajes y
  probabilidades oficiales; traducir importes y reparto al ecosistema de fichas
  (no copiar importes en pesos), dejando las reglas de cada modalidad configurables
  en panel maestro con validaciones y limites.
- **Resultado garantizado de la casa:** el usuario acepto usar presupuesto, margen
  y topes de premio, bloqueando/pausando apuestas antes de ponerlos en riesgo. Falta
  acordar la definicion contable exacta de "ganancia" y el algoritmo; no basarse solo
  en ventaja estadistica.
- **Alta de cuentas:** el usuario eligio que cada participante se registre y
  administracion active/acredite. Esto desplaza por ahora el pedido previo de que
  el admin cree cuentas de invitados; si se quiere esa funcion, requiere una decision
  posterior y un flujo de credenciales seguro.
- **Formato 15/25:** confirmar si se conserva como un juego adicional independiente
  junto a las modalidades Quiniela/Quini 6/Poceada u otros juegos elegidos.

#### Investigacion inicial de reglas oficiales (25 de octubre de 2026)

Consulta preliminar de paginas oficiales de Loteria de Santa Fe y Loteria de la
Provincia de Buenos Aires. No constituye todavia un catalogo completo de juegos ni
una auditoria de todos los reglamentos/jurisdicciones. Las paginas pueden cambiar;
volver a validar reglas y fecha de vigencia antes de programar.

- **Quiniela de Santa Fe (reglamento oficial):**
  [Reglamento Quiniela de Santa Fe](https://www.loteriasantafe.gov.ar/quiniela-de-santa-fe/)
  describe apuestas directas a posiciones del extracto, de 1 a 5 cifras y a una o
  varias posiciones (segun las opciones enumeradas), ademas de "redoblonas".
  El Articulo 19 publica pagos de 7x, 70x, 600x, 3.500x y 10.000x para aciertos
  de 1, 2, 3, 4 y 5 cifras, respectivamente, **incluyendo el importe apostado**;
  el mismo reglamento reserva a la autoridad la posibilidad de modificar la escala.
  Por tanto, estas cuotas no son automaticamente una "comision fija del 50%":
  dependen del tipo de apuesta, posiciones y repeticiones del numero en el extracto.
- **Poceada de Santa Fe (incluida en el reglamento anterior):** seleccionar 8 numeros
  distintos de 00 a 99; se comparan con los ultimos dos digitos de 20 posiciones,
  puntuan aciertos 8/7/6 y las categorias no son acumulativas. Articulo 21 deduce
  5% a reserva especial y destina 45% de la recaudacion a premios, distribuido 50/30/20
  entre 8/7/6 aciertos; premios de pozo vacante se acumulan conforme a reglas. El
  articulo citado no identifica por si solo que el remanente del 50% sea ganancia
  neta de casa: verificar otras deducciones y regulacion, no llamarlo comision.
- **Quini 6 (FAQ oficial de Loteria de Santa Fe):**
  [Preguntas frecuentes Quini 6](https://www.loteriasantafe.gov.ar/quini-preguntas-frecuentes/)
  indica elegir 6 numeros del 00 al 45 y describe modalidades Tradicional (Primer
  Sorteo y Segunda), Revancha y Siempre Sale; para Revancha/Siempre Sale se requiere
  haber jugado Tradicional. Premios indicados: Tradicional 6/5/4 aciertos, Revancha
  6, Siempre Sale 6 o 5 o 4 y sucesivamente hasta encontrar ganadores; tambien
  describe Pozo Extra. Los premios mayores pueden repartirse entre multiples
  ganadores. La FAQ consultada no publica una tabla completa/estable de porcentajes
  de recaudacion distribuida entre todas las modalidades; no inventar esos porcentajes.
  Los importes en pesos que aparecen en esa FAQ pueden quedar desactualizados y no
  aplican a fichas de juguete.
- **Quiniela Plus / Super Plus / Chance Plus de Provincia de Buenos Aires:** la
  [pagina oficial de Loteria de la Provincia](https://loteria.gba.gob.ar/) describe
  un producto derivado de Quiniela tradicional con esas tres modalidades, resultados
  basados en posiciones/cifras del extracto nocturno y categorias por aciertos. La
  pagina consultada no basta para fijar un programa de premios porcentual completo;
  conseguir/verificar su reglamento/circulares actuales antes de modelarlo.
- **Conclusion de alcance:** no existe una unica tabla universal de "porcentaje
  oficial de Quiniela Argentina" derivada de estas fuentes; reglas de Quiniela y
  productos poceados varian por organismo y modalidad. La consulta preliminar aporta
  ejemplos oficiales y no autoriza asumir que son todas las modalidades disponibles
  ni copiar importes monetarios actuales. Investigar cada juego y jurisdiccion
  seleccionado usando sus reglamentos oficiales vigentes. Traducir el funcionamiento
  como implementacion propia para la fiesta; no copiar logotipos, textos, graficos ni
  material visual protegido de las loterias.

## 4. Estado real del workspace (ultimo chequeo)

- El repo tiene cambios locales modificados/no rastreados; revisar `git status` antes
  de cualquier otra accion. No se hizo commit ni push.
- Las migraciones actuales son las dos indicadas en el Estado vigente, no la version
  vieja citada en secciones historicas.
- `package.json`, `vite.config.js` y `supabase/config.toml` existen.
- `pglast` parseo 109 y 78 instrucciones de nivel superior en las migraciones
  actuales; esto no parsea ni ejecuta los cuerpos PL/pgSQL. No hay prueba real en
  Postgres/Supabase y no se ha validado RLS/privilegios/Auth Hook.
- Todavia no hubo `supabase link`, `db push`, SQL Editor, conexion remota, setup de
  Vercel o deploy. El usuario no ha autorizado una ejecucion SQL remota.
- Segun captura anterior, el proyecto Supabase nuevo aparecia vacio en `public`;
  confirmar de nuevo el Project Ref y si hay datos antes de cualquier aplicacion.

## 5. Repo y sistema existentes

### Archivos y estructura relevante

- `index.html`: pagina de entrada que consulta `getUsuarioActual()` e inmediatamente
  deriva a lobby o login.
- `login.html`, `register.html`: pantallas de entrada/registro.
- `lobby.html`.
- `js/supabase.js`: cliente compartido usa Supabase JS npm y requiere las variables
  publicas `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en `.env.local` o
  en el entorno del deploy. No incluye claves de servidor.
- `js/auth.js`, `js/session.js`: cliente Auth usa sign-up/sign-in phone/password;
  `getUsuarioActual()` obtiene el perfil/billetera por RPC.
- `js/lobby.js`: solo muestra modulos visibles y habilitados segun la configuracion
  publica; ya no carga las mesas/chat legacy.
- `administracion.html`, `js/administracion.js`: panel inicial protegido por roles
  para cuentas/caja, resumen financiero, configuracion y sorteos.
- `js/mesas.js`, `js/mesa.js`: codigo legacy no conectado al nuevo esquema; no
  habilitarlo hasta migrar las operaciones a RPC seguras.
- `js/chatGlobal.js`, `js/historial.js`, `js/util.js`.
- `juegos/tragamonedas/index.html`, `juegos/tragamonedas/tragamonedas.js`: apuesta,
  resultado y saldo se consultan/actualizan con RPC server-side.
- `juegos/loteria/index.html`, `juegos/loteria/loteria.js`: venta digital, snapshot
  de premios, historial y cobro mediante RPC.
- `juegos/mesa.html`: rutas convertidas a relativas para Vercel/GitHub Pages.
- `main.py` de raiz: generador antiguo de `codigo-total.md`, no es la terminal de
  loteria.
- `css/style.css`, `assets/`.
- `main.py` en la raiz es un generador del archivo `codigo-total.md`; no es la app
  de loteria descrita arriba.
- `.gitignore` excluye `contexto-proyecto.md`, `codigo-total.md`, `main.py`,
  `ejemplo.html` y `ejemplo.css`. Este documento tiene un nombre nuevo y no figura
  en las reglas de ignore observadas.
- `contexto-proyecto.md` y `codigo-total.md` son contexto/copia de codigo antiguos.
  Leerlos como referencia con fecha, no como fuente de verdad del nuevo modelo.

### Riesgos funcionales y tecnicos identificados en el legado

- Se retiro la autenticacion cliente antigua que comparaba contrasenas desde la
  tabla. El nuevo Auth requiere configurar Supabase Phone/password y el Auth Hook del
  limite de cinco inicios; no considerarlo funcional hasta aplicar y probar esquema/
  ajustes en la instancia correcta.
- Las mesas mantienen operaciones legacy de saldos del lado cliente; no se muestran
  desde el lobby nuevo y no deben volver a habilitarse antes de migrarlas.
- El chat sigue conectado a la base heredada y aun necesita definir politicas seguras
  de lectura/escritura; no se muestra en el lobby nuevo. El renderer existente trata
  nombres y mensajes como texto.
- El esquema SQL antiguo fuera del repo (`pagina en git\data juega virtual argentina
  multijugador\base de datos.sql`) guarda contrasenas directamente y no ofrece las
  protecciones necesarias. Sirve solo como referencia funcional; no ejecutar tal cual.
- No inventar la logica de mesas/RPC; inspeccionar implementacion original antes de
  migrar sus estados y reglas.
- `js/mesas.js` debita/actualiza `usuarios.fichas`, escribe `movimientos_fichas`,
  crea mesas/participantes y reparte/devoluciona premios mediante varias llamadas
  cliente separadas. No es una transaccion atomica y sus movimientos pueden fallar
  parcialmente o competir entre usuarios. Rehacer mutaciones como RPC atomicas y
  respaldadas por ledger/tesoreria antes de fiarse del saldo.
- `juegos/tragamonedas/tragamonedas.js` genera tirada, fija premio y escribe estadisticas
  locales en `localStorage` del navegador; luego manda al RPC legado solo el resultado
  y el cambio declarado por el cliente. Esto no es compatible con exigir reserva de
  caja, integridad del saldo ni resultado inalterable. Servidor debe determinar
  resultado, costo/pago y disponibilidad de premio; estadisticas monetarias deben
  venir del ledger, no de localStorage.
- `js/chatGlobal.js` representa username y mensaje con `innerHTML`; tratar los valores
  como texto, no como marcado, y reforzar autorizacion, identidad y limites en
  servidor.
- El esquema nuevo propuesto hasta ahora incluye perfiles/saldo/ledger basico y
  RPC de loteria, pero no tiene un modelo completo de tesoreria/reserva de fichas
  fisicas, inventario de fichas, canje efectivo fisico<->digital, doble partida
  balanceada, costos de caja, cuentas administrativas, utilidad de casa, limites
  por juego ni liquidacion de apuestas de mesas/tragamonedas. No alcanza todavia el
  requisito economico robusto nuevo.
- La migracion actual modela `jva_lottery_state` como pozo compartido, pero el
  usuario corrigio que no debe existir fondo global de premios: caja de ganancias
  y fondos de premios por juego empiezan en 0. Cada juego debe separar por su cuenta
  una parte retenida para casa y otra para su liability; el modelo SQL actual no
  cumple y debe rediseñarse antes de ejecutar.

## 6. Migraciones de Supabase

Migraciones locales vigentes:

- `supabase/migrations/20261025170000_jva_schema.sql`
- `supabase/migrations/20261025171000_jva_economy_rpcs.sql`

Ninguna se ha aplicado remotamente. El archivo anterior
`20261024220000_jva_platform.sql` fue descartado y no debe recrearse ni ejecutarse.

### Resumen vigente

- Cuentas: perfiles, estado de acceso y roles; trigger de Auth crea perfiles y
  billetera.
- Contabilidad de doble partida: billeteras, fichas fisicas, ganancias de la casa
  y fondos de premio independientes por juego. Sin pozo general ni capital inicial.
- RPCs con permisos explicitos: perfil/config publica, actividad, historial,
  deposito/canje, retiro auditado, activacion, configuracion, tragamonedas,
  sorteo/carton/cobro y consultas financieras.
- Las jugadas de tragamonedas se calculan en servidor; los cartones de loteria
  tienen numeros unicos 1-25, snapshots de premios y reservas. Los premios
  reservados no caducan.
- Los juegos empiezan deshabilitados. Existe un panel inicial de administracion,
  pero falta alta segura de cuentas Auth y un editor de plantillas/elementos.
- Solo se verifico el parseo externo con `pglast` (109 y 78 instrucciones).
  Los cuerpos PL/pgSQL, permisos reales, RLS, extension, concurrencia y Auth Hook
  siguen sin probarse en Postgres/Supabase.

### Referencia historica: objetos del borrador anterior descartado

Tablas:

- `jva_app_settings`: bono, limite configurable de inicios, WhatsApp, precio de
  carton, porcentaje de contribucion al pozo y porcentajes de premios.
- `jva_profiles`: perfil por `auth.users`, `username`, telefono E.164 y saldo entero.
- `jva_account_security`: contador de inicios exitosos y estado de verificacion.
- `jva_user_roles`: roles `super_admin`, `admin`, `cashier`.
- `jva_wallet_ledger`: movimientos auditables de fichas.
- `jva_lottery_state`: pozo acumulado.
- `jva_tickets`: ID/numero, comprador, operador, forma de pago, precio, 15 numeros,
  snapshot del pozo/premios y `request_id` unico para idempotencia.
- `jva_ticket_templates`: definiciones JSON de plantillas `web` y `thermal`.
- `jva_site_modules`: orden, visibilidad y ajustes JSON de modulos enumerados.
- `jva_verification_codes`: hash del codigo, caducidad, intentos fallidos, uso y emisor.
- `jva_user_activity`: actividad/ultima pagina.

Funciones/RPC:

- `jva_ticket_numbers_are_unique`: restriccion de numeros distintos.
- `jva_has_role`, `jva_is_platform_access_allowed`: comprobacion de rol/acceso.
- `jva_handle_new_user`: trigger que crea perfil y seguridad al registrar telefono
  y usuario; acredita bono configurable (default 0) si el administrador lo cambia.
- `jva_password_verification_attempt`: hook Auth que cuenta verificaciones correctas
  y, al superar el limite acordado, marca/rechaza la cuenta con texto
  `JVA_VERIFICATION_REQUIRED`.
- `jva_ping_activity`: actividad de usuario.
- `jva_get_public_config`: parametros publicos, pozo, pronostico de premios, modulos
  y plantillas.
- `jva_update_platform_settings`: cambios permitidos por `super_admin`.
- `jva_update_site_modules`: cambios de orden/visibilidad de modulos con allowlist.
- `jva_update_ticket_template`: guardar JSON limitado de plantilla, autorizado a
  `super_admin`.
- `jva_adjust_tokens`: acreditar fichas y escribir ledger; requiere rol; ajustes
  administrativos reservados a admin/super_admin despues de una correccion.
- `jva_issue_ticket`: emision atomica/idempotente, compra digital o venta fisica por
  caja, numeros aleatorios, snapshot de premios y actualizacion del pozo.
- `jva_issue_verification_code`, `jva_confirm_user_verification`: emision de codigo
  y confirmacion, con expiracion y maximo de cinco fallos.
- `jva_public_profiles`: vista publica de `user_id` y `username`.

Tambien habilita RLS, limita grants de tablas/RPC y trata de agregar tablas seleccionadas
a `supabase_realtime` si la publicacion existe.

### Correcciones del borrador anterior (solo historico)

- La lista de usuarios activos se restringio a `super_admin`/`admin`.
- Se impidio a cajeros registrar `admin_adjustment`.
- El replay de una compra con `request_id` ya usado verifica comprador, operador y
  metodo de pago.
- Se agrego un maximo de cinco codigos de verificacion incorrectos. Al quinto se
  invalida el codigo; la funcion devuelve boolean para que el cliente distinga exito
  de error.
- Se incorporo `jva_is_platform_access_allowed` en lecturas de perfiles, ledger y
  tickets propios, y se bloqueo el ping de actividad para cuenta que requiere
  verificacion.

### Riesgos del borrador anterior (no describen el esquema vigente)

1. **Prueba semantica/ejecucion:** no hay `psql`, PostgreSQL, Docker o Supabase CLI
   disponibles. El parser no detecta errores de privilegios, RLS, extensiones,
   ownership ni particularidades Auth/Supabase. Se necesita revision adicional y,
   preferentemente, aplicacion en entorno/proyecto de prueba antes del proyecto real.
2. **El usuario puede haber actuado desde Supabase sin que el asistente lo sepa.**
   Antes de recomendar repetir cualquier SQL, preguntar si ya lo ejecuto y revisar
   el resultado; no duplicar operaciones a ciegas.
3. **RPC `jva_update_ticket_template`:** validar la logica de tipo JSON. La expresion
   comprueba que `elements` sea array y tambien llama `jsonb_array_length`; SQL no
   garantiza siempre el orden de evaluacion de subexpresiones. Evitar que un JSON
   con `elements` no-array cause error no controlado mediante pasos PL/pgSQL
   secuenciales seguros.
4. **Venta fisica/ledger:** `jva_issue_ticket` registra el metodo/precio del ticket,
   pero no parece insertar un movimiento de caja/fichas fisicas en `jva_wallet_ledger`.
   Aclarar modelo de cobro y auditar venta fisica para que caja, pozo e historial
   concilien. No asumir que actualizar el pozo basta para registrar el pago.
5. **Reparto de premios:** los shares suman 100%, pero falta especificar si el
   porcentaje describe pago por carton/categoria, reparto entre ganadores o monto
   total asignado; el SQL solo guarda snapshots, no sorteo ni liquidacion de premios.
6. **Limite de cinco inicios:** la funcion propuesta cuenta verificaciones de
   contrasena correctas, no sesiones activas ni refresh token. Confirmar el
   comportamiento exacto del hook Supabase Password Verification Attempt y probar
   que registro/login inicial, refresh, multiples dispositivos, usuario ya
   verificado, concurrencia y rechazo funcionen conforme al requisito.
7. **Roles iniciales:** al final hay comentarios con SQL manual para insertar
   `super_admin` despues de registrar la cuenta organizadora. Diseñar instrucciones
   seguras y verificables para bootstrap del primer admin sin dejar una ruta de
   escalada publica.
8. **Auth telefono sin confirmacion:** confirmar los ajustes reales de Phone provider
   en Dashboard. Sin SMS/OTP el telefono es identificador declarado, no verificado;
   aplicar controles/rate limit y explicarlo al usuario.
9. **RLS/Realtime completo:** revisar privilegios efectivos y que Realtime no exponga
   telefono/saldo/estado privado por error. Confirmar politicas de actividad,
   perfiles, security, roles, ledger y tickets con usuarios anonimos/autenticados
   y con cada rol.
10. **Loteria:** revisar atomicidad bajo concurrencia, idempotencia en ventas,
    verificacion de permisos de cajero/comprador, politicas de tickets y limite de
    BIGINT al aumentar saldo/pozo. Confirmar que una venta fisica registre pago y
    contribuya al pozo segun la regla acordada.
11. **Extensiones/vistas:** validar que `pgcrypto` en schema `extensions`, llamadas
    `extensions.digest`, `gen_random_uuid`, `security_invoker=false` y objetos de
    publicacion funcionen con la version/roles del proyecto Supabase nuevo.
12. **Idempotencia de migracion:** `create table if not exists` no actualiza objetos
    existentes ni garantiza que una segunda ejecucion de todo el archivo sea
    segura. Preparar estrategia de versionado/recuperacion y no pedir “Run” dos
    veces si la primera devuelve error parcial.
13. **Esquema pendiente de juegos:** aun no incluye las tablas/RPC de tragamonedas,
    mesas, chat o premios. No habilitar dichos modulos operativos solo porque haya
    una fila de configuracion con `visible=true`.
14. **Plantillas:** guardar JSON no implementa editor; cuando se implemente el
    renderizador, aceptar solo tipos de elemento/atributos permitidos, sin HTML o
    JS arbitrario.
15. **Respaldo de fichas:** requisitos nuevos piden canje fisico/digital y limite de
    premios por reserva, pero el borrador mantiene un saldo por perfil y un ledger
    de una sola pata, sin inventario/reserva ni contabilidad balanceada. Diseñar
    depositos, redenciones, caja/tesoreria, deuda/obligacion, premios y conciliacion
    antes de permitir acreditar saldos o pagar juegos.
16. **Rentabilidad:** un limite de tesoreria evita pagar premios sin fondos, pero no
    garantiza que la casa termine con ganancia. Definir ventaja/cuotas/porcentajes,
    limites de exposicion y politica de jackpot. No cambiar probabilidades por usuario
    o manipular resultados de modo no transparente.
17. **Administracion de cuentas:** el borrador no implementa una UI para buscar,
    crear, editar ni activar cuentas ni endpoints completos para usuarios de caja.
    Crear Auth users requiere backend privilegiado seguro; el navegador y desktop
    no pueden contener service key.
18. **Registro con WhatsApp:** falta la interfaz que genera enlace con el numero y
    texto solicitado, y falta definir si se abre automaticamente al completar el
    registro. Link `wa.me` solo prellena/abre WhatsApp; no confirma entrega ni
    permite que el backend sepa que el usuario envio el mensaje.
19. **Fondos iniciales/globales (decision actual):** no cargar 5.000 fichas como
    capital/pozo de premios. Cada fondo de premios por juego y la caja de ganancias
    parten de 0. El saldo digital de cada jugador es global entre juegos; no existe
    un pozo general de premios. Los fondos de premios son separados por modalidad y
    continuos entre fiestas.
20. **Fondos por juego:** el SQL modela un pozo unico y no hace el split de apuestas
    entre retencion de casa y fondo de premios propio. Rediseñar esquema, ledger,
    estados, reservas, RPC y panel para que un juego no use fondos de otro ni la caja
    de ganancias retire obligaciones de premio.
21. **Settlement y remanente:** decision mas reciente: la economia sigue abierta y
    los fondos por juego se conservan entre fiestas; no se barre el remanente al
    acabar una fiesta. Los premios individuales no reclamados no caducan; mantener
    su liability. La semantica de importe total vs ganancia neta se configura por
    juego y se congela para cada jugada.
22. **Multiplicadores vs reserva:** aplicar tope dinamico segun fondos no reservados,
    mostrarlo antes de la jugada y reservar exposicion atomicamente. Definir e
    implementar reglas de maximo por jugada/ronda y pago a ganadores multiples;
    bloquear antes de aceptar si no hay cobertura.
23. **Recaudacion, pasivos y ganancia:** fichas digitales de usuarios son pasivos
    canjeables y no ingresos automaticamente. Separar recargas respaldadas, apuestas,
    porcentaje de casa, fondo reservado para premios, pagos y canjes.
24. **Retiro de ganancia:** el panel requiere operacion auditada para sacar saldo de
    la caja de ganancias de circulacion o conservarlo, sin reducir saldos de usuarios
    ni fondos de premios comprometidos.

## 7. Flujos deseados entre componentes

### Registro y autenticacion

1. El usuario crea cuenta con telefono internacional y `username`; contrasena se
   maneja exclusivamente con Supabase Auth.
2. Trigger crea perfil, saldo 0 y estado de seguridad. Si en el futuro se configura
   bono, registrar credito en ledger; no dar saldo modificando solo el cliente.
3. Supabase entrega sesion despues del registro (si el ajuste de Phone provider lo
   permite); esa sesion inicial no debe consumir uno de los cinco inicios posteriores.
4. En futuros password sign-in, Auth Hook controla limite de inicios exitosos en el
   servidor; agotado el limite, el sitio muestra solicitud de verificacion presencial
   y link de WhatsApp prellenado.
5. Admin registra/valida presencia y emite codigo. El codigo se comunica manualmente;
   la confirmacion debe ser privilegiada, limitada y auditada.

### Wallet y caja

1. Todas las unidades economicas son fichas enteras.
2. Acreditacion por fichas fisicas/ajuste necesita un rol autorizado, motivo y ledger.
3. Juego y compra de carton no deben ejecutar lecturas-modificaciones de saldo
   confiables solo en JS; RPC transaccional bloquea/valida perfil y escribe saldo
   mas ledger atomico.
4. Caja vende a una cuenta identificada y registra operador, metodo, monto, hora,
   carton, pozo y movimiento fisico que se defina.
5. Los clientes consultan saldo/historial con RLS; no pueden editar saldo, rol ni
   resultado de juego.
6. La contabilidad debe distinguir al menos: fichas fisicas recibidas/respaldo de
   saldos digitales canjeables; fondo exclusivo de premios de cada juego; caja
   separada de ganancias propias; apuestas; premios pagados; y canjes/retiros. El
   total de saldos digitales de usuarios no es el saldo ni la ganancia propia de la
   casa, y el fondo de premios de un juego no puede mezclarse con el de otro.
7. Deposito fisico que origina una acreditacion y canje que debita saldo digital
   requieren operaciones atomicas, auditadas e idempotentes, con cajero, motivo y
   referencia. No emitir saldo sin respaldo o autorizacion segun reglas aprobadas.
8. Cada evento y juego debe tener ID/sesion contable, parametros versionados/
   congelados, apuestas recibidas, porcentaje de casa, fondo de premios, premios
   pagados y ganancia acumulada. Ejecutar conciliaciones auditables de respaldo,
   saldos de jugadores, fondos por juego, caja de ganancias y resultado, sin que
   terminar una fiesta cierre o reinicie la economia.
9. Incluir interruptor de seguridad para pausar apuestas/premios por juego cuando se
   alcance el umbral de reserva o se detecte descuadre. Solo rol autorizado puede
   reanudar tras conciliacion, dejando actor, hora, motivo y cambios.
10. Antes de aceptar una jugada con pago potencial, comprobar atomicamente que el
    fondo propio del juego cubre la exposicion maxima y reservar esa exposicion
    frente a otras jugadas concurrentes. Rechazar antes de aceptar, no luego de
    conocer un resultado desfavorable para la casa.
11. La caja de ganancias inicia en 0 y recibe la parte retenida de cada juego. Admin
   puede retirarla de circulacion mediante un movimiento auditado o mantenerla
   separada de fondos de premios.
12. Modelo economico acordado por el usuario: apuesta debitada al jugador = 30%
   inicial retenido para casa + contribucion neta al fondo
   exclusivo del juego. Mantener por separado fondo total, premios/liability ya
   reservados y liquidez no reservada. Un pago reduce solo el fondo correspondiente.
   No contar dos veces una apuesta, reserva o premio como ganancia.
13. El usuario eligio fondos continuos por modalidad entre fiestas; modalidades
   distintas no se mezclan y no hay cierre economico por terminar una fiesta. El
   remanente no se barre automaticamente. Multiplicadores se limitan al maximo
   cubierto; incorporar la apuesta, separar parte de casa, calcular/mostrar el maximo
   y reservar liability atomicamente antes de aceptarla. Bloquear si falta fondo.
   La semantica del premio se configura/versiona por juego.

### Loteria

1. UI pide configuracion/pozo/pronostico (RPC publica segura).
2. Usuario ve precio y desglose calculado antes de confirmar.
3. En confirmacion se genera `request_id` UUID y se llama `jva_issue_ticket`.
4. El backend verifica sesion, comprador, acceso/verificacion, saldo o rol de caja,
   idempotencia, genera 15 numeros diferentes de 1..25, guarda precio/numeros/
   snapshot, actualiza pozo y saldo/ledger de manera atomica.
5. La UI muestra/descarga e historial lee ticket persistido. La app Python usa el
   mismo backend y no debe mantener una base paralela ni credenciales privilegiadas.
6. Impresion termica debe capturar el snapshot de ese instante y numero identificador.
7. Congelar reglas y porcentaje retenido al abrir cada sorteo; las apuestas se
   asignan a la caja de ganancias y al fondo de premios exclusivo de esa modalidad.
   Emitir premios solo desde su fondo reservado/disponible y pausar/denegar ventas
   si no puede cubrirse la exposicion maxima.

### Juegos/mesas y chat

- Reimplementar primero contratos y reglas existentes; apuestas, premios, entradas,
  salidas y transferencias deben ser RPC con transaccion, autenticacion y limites.
- Realtime es notificacion/actualizacion, no autoridad de saldo ni permiso.
- Chat valida identidad en servidor, limita tamano/frecuencia y muestra texto escapado.
- Registrar cada juego en un catalogo/allowlist con manifiesto tipado: ID/version,
  categoria (costo sin premio o apuesta con premio), parametros y version de reglas,
  RPC permitido, apuesta minima/maxima, premio/liability maxima, porcentaje retenido,
  fondo propio del juego y estado habilitado. Agregar UI no otorga permisos de saldo.
- Los juegos de costo sin premio descuentan el costo y lo asignan a casa. Los juegos
  con premios separan cada apuesta entre ganancias de casa y el fondo propio del
  juego. Antes de aceptar una jugada comprobar/reservar la exposicion maxima con
  control de concurrencia; si el fondo no puede pagarla, bloquearla. Resolver y
  pagar desde ese fondo con ledger atomico.
- El constructor permite bloques validados de texto/imagenes y juegos/widgets
  registrados; nunca ejecuta HTML/JS/CSS arbitrario.
- Registrar cada juego en un catalogo/allowlist con manifiesto tipado: ID/versión,
  clase (costo sin premio o apuesta con premio), parametros, contrato RPC permitido,
  limites de apuesta, premio/liability maxima, politica de reserva y estado habilitado.
  El panel agrega componentes ya desarrollados y aprobados; codigo visual no autoriza
  operaciones de saldo.
- Juegos sin premios solo descuentan el costo configurado. Juegos con premios pasan
  por controles server-side de saldo, reserva, estado del evento y margen antes de
  iniciar; bloquear si el pago posible no puede cubrirse.
- El constructor permite bloques controlados de texto e imagen y juegos/widgets del
  catalogo; nunca ejecuta HTML/JavaScript/CSS arbitrario introducido por usuarios.

### GitHub/Vercel/Supabase

- GitHub conserva el codigo fuente.
- Vercel construye/despliega el frontend desde el repo y aloja variables publicas
  requeridas en build/runtime; la clave publica no equivale a permisos seguros, RLS
  debe proteger tablas.
- Supabase hospeda Auth, Postgres/RLS/RPC y Realtime.
- GitHub Pages se mantiene hasta comparar URLs, rutas, auth, juegos y backend en Vercel.
- La app Windows habla con Supabase usando SDK y clave publica + sesion/rol del
  operador. Si una operacion requiere servicio privilegiado, usar backend seguro,
  nunca insertar `service_role` en cliente web, app empaquetada o repositorio.

## 8. Credenciales y configuracion pendiente

- No se tiene la URL del Supabase nuevo ni su key publica.
- `js/supabase.js` apunta al proyecto anterior y tiene key censurada; debe considerarse
  inusable para el nuevo despliegue.
- Cuando corresponda: obtener Project URL y clave `publishable`/`anon` en el Dashboard.
- Para proyecto estatico sin bundler, no asumir que `import.meta.env` funciona.
  Elegir una estrategia compatible con el build/deploy. Posibles opciones son
  agregar Vite/npm o inyectar configuracion publica durante build; decidir despues
  de evaluar rutas y hosting. El usuario no pidio aun un refactor bundler concreto.
- Variables secretas solo en Vercel/backend local protegido. No incluir tokens,
  contrasenas, `service_role`, `secret`, claves de impresora o credenciales Wi-Fi en
  codigo, prompts ni documentacion versionada.
- Auth debe configurarse en Supabase Dashboard para permitir telefono + password y
  desactivar confirmacion de telefono/email conforme a la decision de no usar OTP;
  comprobar opciones disponibles en el proyecto y el riesgo de telefonos no verificados.
- Password Verification Attempt Hook se debe habilitar manualmente en
  Authentication > Hooks, apuntando a
  `pg-functions://postgres/public/jva_password_verification_attempt`, solo despues
  de validar implementacion y fallos; no activar mientras el frontend no tenga
  mensajes UX para `JVA_VERIFICATION_REQUIRED`.

## 9. Plan de trabajo sugerido, orden y criterios para avanzar

El esquema antiguo descrito en el plan historico fue reemplazado. El siguiente
trabajo real es: validar los cuerpos PL/pgSQL en PostgreSQL de prueba; probar
Auth Hook/RLS/contabilidad/RPC; completar el panel con alta Auth segura y editor
de plantillas; migrar mesas y chat con operaciones server-side; integrar la
terminal Python y la impresion; luego probar un Preview de Vercel. Mantener los
juegos apagados y no aplicar SQL remoto, hacer push o desplegar sin aprobacion
expresa del usuario.

### Fase A: cerrar el esquema sin riesgo

1. Confirmar con el usuario si ya ejecuto algo y si el proyecto nuevo contiene datos.
2. Revisar el SQL por completo, resolver los puntos de la seccion 6, contrastar con
   documentacion oficial de Supabase Auth Hook, grants/RLS, Realtime y extensiones.
3. Dividir en migraciones versionadas si ayuda a probar y recuperar; incluir
   instrucciones de bootstrap del primer super_admin y configuracion Dashboard.
4. Probar en proyecto de prueba/local compatible, o si no es posible, explicar
   claramente que queda sin prueba antes de pedir cualquier ejecucion real.
5. Solo con SQL revisado, proyecto correcto confirmado y aprobacion del usuario,
   ejecutar una vez y comprobar resultados en Table Editor/SQL Editor.

### Fase B: identidad y conexion web

1. Definir configuracion/build del sitio y manejo de rutas para GitHub Pages y Vercel.
2. Reemplazar auth viejo por Supabase Auth phone/password y profile username.
3. Desarrollar registro/login/salida/refresh, estados de cuenta, bloqueo por limite,
   flujo presencial y WhatsApp prellenado; manejar errores sin fallback silencioso.
4. Sustituir todas las lecturas/escrituras del cliente por RLS/RPC validas donde
   cambien estado o dinero.

### Fase C: controles y juegos

1. Completar administracion de roles, cuentas, usuarios/cajeros y ledger.
2. Rediseñar economia para respaldo/canje fisico, fondos de premio separados por
   juego, caja de ganancias en 0, retenciones, reservas/liability, pausa y
   conciliacion continua. Eliminar pozo global y seed de 5.000 del borrador actual;
   no liquidar fondos por terminar una fiesta.
3. Construir lottery web, historial, descarga y editor validado de cartones usando
   reglas/versiones de modalidad y fondos aislados por juego.
4. Construir loteria Windows/Python conectada al mismo esquema, impresora 58 mm,
   logo, configuracion y venta de caja asociada a cuenta.
5. Migrar tragamonedas y mesas con reglas server-side; probar concurrencia,
   reconciliacion de fichas y aislamiento entre usuarios.
6. Corregir renderizado del chat y reglas Realtime.
7. Activar solo modulos implementados y probados.

### Fase D: validacion y despliegue

1. Agregar/ejecutar pruebas pertinentes (SQL/RPC/auth/UI), build y revisiones estaticas.
2. Crear proyecto Vercel nuevo y vincular el repo existente con consentimiento del
   usuario; configurar variables en panel sin escribir secretos en Git.
3. Validar un preview Vercel, auth, enlaces, juegos y Supabase antes de produccion.
4. Mantener GitHub Pages en paralelo hasta aceptacion explicita y decidir luego
   dominio/redirect; no eliminar ni romper el sitio existente.

## 10. Como comunicar el progreso al usuario

- Hacer trabajo real y devolver resultado en el mismo turno cuando sea posible.
- Decir exactamente que archivo se cambio y que comprobacion se ejecuto.
- Distinguir “parser valida sintaxis” de “migracion probada en Supabase”.
- Dar pasos manuales con nombre exacto de la pagina/boton del Dashboard solo cuando
  ese paso este listo; pedir que el usuario informe el mensaje de resultado.
- No dejar instrucciones contradictorias del tipo “no ejecutes” y luego “ejecuta”
  sin explicar que condicion cambio.
- Usar enlaces Markdown absolutos para rutas de archivos/folders del workspace en
  respuestas; esta es una instruccion de presentacion de VS Code.

## 11. Prompt corto reutilizable para el siguiente modelo

> Continua Juega Virtual Argentina en el workspace actual y lee primero
> `CONTEXTO-TRASPASO-IA.md` y las migraciones vigentes
> `supabase/migrations/20261025170000_jva_schema.sql` y
> `supabase/migrations/20261025171000_jva_economy_rpcs.sql`.
> No cambies de workspace, no toques otros clones/proyectos y no asumas que SQL fue
> ejecutado. El usuario quiere una web JVA en Vercel desde el repo GitHub actual,
> Supabase nuevo, registro por telefono/clave sin email/OTP, saldo inicial 0,
> WhatsApp prellenado/manual al registrarse, activacion permanente desde panel,
> bloqueo y WhatsApp de verificacion al agotar cinco inicios, sorteos ficticios de
> modalidades separadas inspiradas en reglas oficiales, economia por juego sin pozo
> global ni capital inicial de 5.000 (cada fondo de premios y caja de ganancias parte
> de 0), split configurable apuestas/casa/premios, reservas por juego, control de
> pagos antes de aceptar y seguimiento/pausa para proteger ganancias. Fondos separados
> por modalidad persisten entre fiestas, sin cierre economico por evento; informar y
> reservar el premio maximo dinamico antes de aceptar, con semantica de pago
> configurable por juego. Fichas digitales necesitan respaldo/canje fisico; son
> pasivo de jugadores, no ganancia. Constructor
> modular incluye texto/imagenes validados, sin codigo arbitrario; app de caja
> Python/CustomTkinter con impresion de 58 mm. La migracion solo paso parseo estatico;
> no hay Supabase CLI/psql y no se valido en la instancia. El SQL actual usa pozo
> global y debe rediseñarse; el esquema no incluye reservas/canje balanceado ni
> sustituye la logica economica heredada. Decisiones: retencion inicial de 30% por
> juego, editable antes de habilitarlo; premios individuales no reclamados no caducan.
> No ejecutar SQL/publicar sin
> confirmacion expresa.
> Revisa seguridad/semantica SQL y comunica pasos claros; pregunta decisiones de
> producto abiertas; no pidas ni pongas `service_role`/secret, no ejecutes SQL ni
> publiques sin confirmacion expresa.
