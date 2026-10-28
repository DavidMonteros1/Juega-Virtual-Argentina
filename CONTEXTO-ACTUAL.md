# Juega Virtual Argentina — contexto operativo actual

**Revisado:** 28 de octubre de 2026
**Workspace:** `Juega Virtual Argentina multijugador`
**Repositorio:** `DavidMonteros1/Juega-Virtual-Argentina`
**Rama:** `main`
**Último commit funcional:** `c925fc2` (las actualizaciones QA posteriores son documentales).
**Idioma de trabajo con el propietario:** español.

> Este documento describe el estado comprobado en el workspace. No equivale a
> una consulta en vivo a Supabase o Vercel. El README registra algunos estados
> remotos que fueron confirmados durante sesiones anteriores; cada agente debe
> separar esos registros documentales de una verificación remota hecha ahora.
> Las instrucciones operativas de esta sección son la autoridad actual y
> reemplazan cualquier recomendación contradictoria de entradas históricas.
> Nunca incluir aquí contraseñas, tokens, claves secretas, `service_role` ni el
> contenido de `.env.local`; las credenciales QA viven exclusivamente en el
> archivo local ignorado `.qa-credentials.local.md`.
> Para iniciar sin releer toda la historia, sigue
> [`AGENTS.md`](./AGENTS.md) y el índice
> [`docs/agent-memory/README.md`](./docs/agent-memory/README.md). Los puntos
> 8–22 de la sección siguiente contienen estados/hallazgos anteriores al retest
> QA del 28/10; consultar el punto 25 y refrescar el remoto antes de operar.

## 1. Instrucciones inmediatas para continuar

1. Trabajar en este workspace y revisar `git status` antes de editar. No tocar
   otros clones, el sitio Vercel del otro proyecto ni la aplicación Python que
   pudiera estar en otra carpeta.
2. No usar la cuenta humana `davidmonteros` ni contraseñas compartidas en
   conversación. Las cuentas QA dedicadas pueden usarse para pruebas autorizadas
   mediante los flujos normales. No guardar claves en el repo ni compartir la
   misma credencial entre agentes; para otra identidad/sesión, el propietario
   debe aprovisionar una cuenta QA separada.
3. La pestaña de auditoría IA añadida localmente es **solo lectura**. No contiene
   editor SQL, endpoint SQL genérico, clave privilegiada ni operaciones para
   modificar Supabase.
4. **Entorno de QA (27/10/2026):** el propietario indicó que este proyecto y
   Supabase son descartables y que las fichas son de juguete. Se autoriza usar
   los flujos normales de la aplicación y Caja física (`physical_tokens`,
   `physical_deposit`, `physical_redemption`) para simulaciones identificadas
   explícitamente como QA; no afirmar que se recibió o pagó efectivo real. No
   borrar datos ni destruir el proyecto sin una instrucción concreta.
5. El propietario ordena expresamente pruebas multiusuario en este bucket QA:
   iniciar sesión en las cuentas QA dedicadas, activar/acreditar mediante
   Administración/Caja y apostar desde los flujos normales. Esta orden
   reemplaza las recomendaciones históricas de no iniciar sesión en cuentas QA.
   `admin` sigue siendo rol de aplicación, no root ni `service_role`; no eludir
   Auth/RLS ni hacer escrituras financieras manuales por SQL. No dar permisos
   root a agentes ni crear endpoints privilegiados para automatización.
6. La contraseña humana de `davidmonteros` compartida en la conversación debe
   tratarse como comprometida. No solicitarla, guardarla ni reutilizarla; el
   propietario debe rotarla y cerrar sesiones.
7. El 27/10 se acreditaron 500 fichas QA por Caja física a seis cuentas
   anteriores y a `qa_audit_01`, `qa_audit_02` y `qa_audit_03`. El 28/10 se
   crearon `qa_colmena_01`, `qa_colmena_02` y `qa_colmena_03` mediante el
   formulario oficial. Sus credenciales temporales están en el archivo local
   ignorado `.qa-credentials.local.md`. Las tres cuentas ya fueron activadas,
   recibieron 620 fichas QA por Caja y completaron login exitoso en orígenes
   separados; ver el punto 25 para la evidencia y conciliación posterior.
8. **Estado remoto verificado después del retest técnico Crash:** `ai_audiror`
   4.892, `davidmonteros` 1.756, `lodelchino` 2.119, `nuevonuevo` 990,
   `Vanesaf` 500, `Vanesaflores` 2.503, `qa_audit_01` 502, `qa_audit_02` 502
   y `qa_audit_03` 500. Caja física 12.069; ganancias de la casa 1.190;
   billeteras 14.264. Fondos/reservas/disponible: Crash 248/0/248; Dados
   0/0/0; Jackpot 0/0/0; Lotería 49/0/49; Minas 257/50/207; Tragamonedas
   495/0/495; Ruleta 566/0/566; Mesas 0/0/0.
9. La conciliación administrativa remota más reciente informó 27.438 débitos =
   27.438 créditos, 0 asientos descuadrados y 0 diferencias de saldos; el panel
   reportó 324 asientos, 231 apuestas y 7 cartones. No había sorteos abiertos
   de Lotería ni Jackpot.
10. **Lotería:** se consultaron directamente en modo lectura los siete cartones.
    Sorteo #1 quedó liquidado con 5 cartones (8, 10, 7, 10 y 9 aciertos); el
    sorteo #2 quedó liquidado con los cartones #6/#7 (10 y 6 aciertos). Todos
    tuvieron premio 0, reserva 0 y reserva liberada; no había sorteo abierto.
    La página de Lotería muestra esos cartones como “Este cartón no obtuvo
    premio” y avisa que no hay sorteo abierto.
11. **Jackpot:** el sorteo #2 tuvo una sola entrada QA de 10 fichas; pagó 7 al
    único participante y 3 quedaron como ganancia de la casa. Se liquidó y no
    quedó sorteo abierto. La página deshabilita la compra y comunica que el
    organizador aún no abrió otro sorteo.
12. **Pruebas visuales interactivas recientes, todas desde la sesión válida de
    `ai_audiror`:** Dados, apuesta 4, Bajo, resultado 36, premio 3 (saldo
    4.909→4.908); Tragamonedas, apuesta 4, pérdida (4.908→4.904); Ruleta,
    apuesta 4, segmento 2 sin premio (4.904→4.900); Minas, apuesta 4, casilla
    1 segura y cobro de 4 (saldo neto sin cambio); Crash, apuesta 4, caída
    en 1,00× (4.900→4.896). Se verificaron los mensajes, saldo, estado de
    controles y, en Tragamonedas, los rodillos con estado `lose`; en Dados, el
    valor final y la animación visual. No se dejaron rondas activas de QA.
13. La anomalía previa de Dados (apuesta 300, pago 331, UI reportada en 210)
    se contrastó con `jva_game_bets` y el ledger: el servidor guardó máximo 331,
    pagó 331, acreditó 210 al fondo en la apuesta y debitó 331 del fondo para
    el premio. No es un sobrepago contable. La UI actual estima correctamente
    7 para apuesta 10 cuando el fondo consultado es 0. La discrepancia histórica
    de vista previa no se ha reproducido ni se ha explicado con certeza; revisar
    posible estado obsoleto/concurrencia antes de cambiar código o probar
    apuestas mayores.
14. En la navegación visual, la RPC de Lotería devolvía
    `P0001: No hay un sorteo abierto`, estado funcional esperado. La página
    presentaba correctamente el estado vacío, aunque antes lo registraba como
    error de consola; el commit `c925fc2` lo trata como estado vacío esperado
    sin ocultar otros fallos. El bundle actualizado se verificó en Production.
    La migración de auditoría de solo lectura y su panel ya estaban publicados
    antes de esta etapa. La corrección visual anterior de Dados se publicó en
    `4af2e79`.
15. La última evidencia histórica mostraba una ronda de `Vanesaflores` activa.
    Esta continuación no la consultó ni modificó; verificar su estado actual
    antes de intervenir en partidas ajenas.
16. El informe histórico del 27/10 está en
    [`INFORME-AUDITORIA-QA-2026-10-27.md`](./INFORME-AUDITORIA-QA-2026-10-27.md).
    La tanda multijugador más reciente del 28/10 está en
    [`INFORME-AUDITORIA-MULTIJUGADOR-2026-10-28.md`](./INFORME-AUDITORIA-MULTIJUGADOR-2026-10-28.md).
17. **QA multiusuario adicional (27/10/2026):** se crearon por el flujo normal
    `qa_audit_01`, `qa_audit_02` y `qa_audit_03`, con depósito de 500 fichas QA
    por cuenta. Apuestas liquidadas: slots 4→6 (saldo 502), ruleta 4→6 (502) y
    Crash 4→4 (500). El libro muestra en cada caso la apuesta y premio, y los
    tres saldos coinciden con el ledger. Conciliación remota posterior:
    27.434 débitos = 27.434 créditos, 0 asientos descuadrados y 0 diferencias
    de saldo. No se guardaron contraseñas.
18. **Hallazgo visual Crash:** en el retest de `qa_audit_03` la pantalla terminó
    mostrando 1,65× junto con un premio de 4. La migración distingue el
    multiplicador efectivo de cobro (`multiplier`) del punto de caída
    (`crash_multiplier`); la UI usaba el segundo al terminar incluso si la ronda
    fue cobrada. Se corrigió para mostrar el multiplicador efectivo
    en cobros y el punto de caída en pérdidas. El ledger confirma apuesta/premio
    4 y saldo neto 0, pero no expone el multiplicador exacto. El cambio se
    desplegó con `0bbf6e9`; falta una ronda ganadora autenticada para completar
    la verificación visual de extremo a extremo.
19. **Commit y despliegue (27/10/2026):** `0bbf6e9` se envió a `main`; Vercel
    completó el deployment Production y el sitio público carga
    `assets/arcade--_Jkl1Mt.js`, que contiene la corrección. Después se hizo un
    retest mínimo real de Crash (4 fichas, pérdida en 1,00×) y se comprobó el
    renderizado de cobro mediante RPC simulada, sin transacción. El commit
    `c925fc2` se publicó después; Vercel reportó Production Ready y se verificaron
    los bundles actualizados en el dominio público.
20. **Límite del análisis económico:** no ajustar probabilidades o premios en
    función del historial/gasto de una persona ni de la caja para producir
    “enganche”. Mantener reglas y tabla de pagos fijas, versionadas y divulgadas.
    El informe QA incluye cálculos teóricos derivados de valores por defecto de
    migraciones, no una confirmación de todos los parámetros avanzados remotos.
21. **Retest técnico del 27/10/2026:** se probó una ronda Crash real de 4 fichas
    en Production; cayó en 1,00×, perdió 4, saldo `ai_audiror` 4.896→4.892 y
    fondo Crash 245→248; la casa subió 1. No es un fallo: la interfaz indicó
    pérdida y la conciliación quedó 27.438=27.438, sin diferencias. Para no
    insistir en rondas hasta obtener un resultado favorable, el nuevo estado de
    cobro 1,25× se validó además con RPC simulada, sin transacción de Supabase:
    se mostró “Premio acreditado: 5 fichas (1.25×)” y el indicador terminó en
    1,25×, no en el punto de caída simulado 1,45×.
22. Se inspeccionaron sin apostar Dados, Tragamonedas, Ruleta, Minas, Crash,
    Jackpot y Lotería. Jackpot/Lotería no tienen sorteo abierto y sus botones de
    compra estaban deshabilitados. Lotería devolvía `P0001` esperado y el
    frontend lo registraba como error de consola; se corrigió para presentar el
    estado vacío sin falso error. También se unificó el formato del saldo de
    Tragamonedas (`4.892` en vez de `4892`). `c925fc2` incluye ambas correcciones
    y actualiza el informe/historial. El build local pasó; Vercel Production
    quedó Ready y el HTML público referencia `assets/loteria-Bl4GxK13.js` y
    `assets/tragamonedas-D6PZVNv3.js`. Ambos recursos respondieron HTTP 200; el
    primero contiene el manejo esperado de `P0001` y el segundo el formateador
    `es-AR`. No se hizo una sesión autenticada nueva para verificar consola.
23. **Prueba multijugador terminada (28/10/2026):** con las sesiones propias de
    `qa_multi_01`, `qa_multi_02` y `qa_multi_03`, cada una iniciada con 620
    fichas QA, se completaron 31 cartones y 31 entradas de Jackpot por cuenta
    (93 por juego en total), en cinco sorteos liquidados (#3–#7). Un segundo
    clic de Lotería se intentó mientras el control de emisión seguía ocupado;
    se verificó la emisión real y se completó el cartón faltante en #5. Las
    ganancias de Lotería fueron 30, 10 y 4 fichas; Jackpot pagó 504 a
    `qa_multi_01`, 0 a `qa_multi_02` y 147 a `qa_multi_03`. Saldos finales:
    534, 10 y 151. Todas las reservas QA de ambos sorteos quedaron en cero;
    no quedan sorteos abiertos. Conciliación más reciente: 33.417 débitos =
    33.417 créditos, 0 asientos descuadrados, 0 saldos fuera del libro;
    panel: 564 asientos, 350 apuestas y 100 cartones. Caja física QA 13.929,
    ganancias de casa 2.054, billeteras 14.467, fondo Lotería 656 y Jackpot 0.
    No se almacenaron contraseñas ni se modificó código para esta tanda.
24. **Continuidad operativa ordenada por el propietario (28/10/2026):** las
    pautas antiguas que impedían iniciar sesión como cuentas QA quedan
    explícitamente supersedidas. La tanda #3–#7 terminó; la siguiente debe
    usar las nuevas cuentas `qa_colmena_01/02/03`, cuyas claves están solo en
    `.qa-credentials.local.md`. Esas cuentas se crearon por `register.html` con
    teléfonos ficticios únicos `+5491100000101`–`0103`; la pantalla confirmó
    registro completado. Esta nota describía el estado inicial y quedó
    supersedida por el punto 25: activación, depósitos y logins sí se completaron.
    No reutilizar las cuentas `qa_multi_*`: sus contraseñas no fueron guardadas
    y no son recuperables desde Supabase.
25. **Cuentas QA nuevas listas y accesos comprobados (28/10/2026):** se
    activaron `qa_colmena_01/02/03` desde Administración y se acreditaron 620
    fichas a cada una desde Caja con motivo de simulación QA. Se inició sesión
    correctamente en las tres: `qa_colmena_01` en `127.0.0.1:4176`,
    `qa_colmena_02` en `localhost:4177` y `qa_colmena_03` en
    `127.0.0.1:4178`. Cada lobby mostró el usuario correcto, 620 fichas y los
    siete juegos. No se hicieron apuestas ni se abrieron sorteos en esta
    verificación. El estado financiero posterior mostró caja física 15.789,
    ganancias de casa 2.054, billeteras 16.327; 567 asientos, 350 apuestas y
    100 cartones. El libro quedó conciliado: 35.277 débitos = 35.277 créditos,
    cero asientos descuadrados y cero diferencias de saldos. No quedan sorteos
    abiertos de Lotería o Jackpot por las tandas previas. Antes de apostar,
    volver a consultar el estado remoto y seguir el plan de pruebas sin alterar
    cuotas ni perseguir resultados favorables. Las credenciales siguen solo en
    el archivo local ignorado; no copiar secretos a documentos versionados.
    **Precaución de credenciales:** en un intento previo de login, la contraseña
    de `qa_colmena_01` quedó visible en un snapshot de error del navegador.
    No se reproduce aquí; antes de compartir el archivo fuera de esta máquina,
    rotar esa contraseña mediante un flujo Auth soportado y actualizar el
    archivo local sin imprimirla.
26. **Continuidad de agentes preparada (28/10/2026):** `AGENTS.md` es ahora la
    entrada breve; `docs/agent-memory/README.md` organiza las fuentes y
    precedencia; `docs/agent-memory/WORKFLOW.md` define coordinación por Issues
    y PRs, secretos, pruebas y handoff; `.github/copilot-instructions.md` enlaza
    esas reglas y `.github/ISSUE_TEMPLATE/agent-handoff.yml` facilita dejar
    tareas. Esta documentación no es un chat/notificador y no se comparte con
    otros clones hasta publicar los cambios en GitHub. El árbol sigue sin
    commit/push de esta arquitectura. No se concedió root ni se cambiaron
    permisos, código, cuotas o fondos; se mantienen Auth/RLS y reglas fijas.

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
`authenticated` puede ejecutarla y que `anon` no. El 27 de octubre se inició
sesión con `ai_audiror`, se consultó el informe y se realizó una conciliación
antes y después de la prueba QA; los resultados concretos se detallan más abajo.

El commit `5600a10` se publicó en `main` y Vercel completó el deployment
Production. La URL pública de la pantalla
`https://juega-virtual-argentina.vercel.app/auditoria-ia.html` sirvió el HTML
esperado. La RPC también se probó con la sesión autorizada de `ai_audiror`; no
guardar credenciales de esa cuenta en el repositorio ni en este documento.

### Prueba QA autorizada — 27 de octubre de 2026

Proyecto remoto verificado: Supabase `frbnaypbmwahbytxqzwl` y la aplicación
`https://juega-virtual-argentina.vercel.app`. El usuario tenía saldo 0, rol
`ai_auditor`, no tenía rondas activas y no existía una fuente QA previa. Se le
añadió temporalmente `admin` y se creó la cuenta contable `qa_test_issuance`
(`asset`, lado normal `debit`). El asiento `qa_synthetic_credit` acreditó
5.000 fichas desde esa cuenta al wallet del usuario, marcado explícitamente como
saldo sintético no proveniente de efectivo físico. El asiento tuvo débitos y
créditos por 5.000.

Resultados por juego:

| Juego | Operación comprobada | Resultado |
|---|---|---|
| Tragamonedas | Apuesta de 10 | Pérdida registrada; el saldo de la interfaz bajó a 4.990. |
| Dados | Apuesta inicial de 4, opción Bajo; luego retest de 4 tras publicar la corrección | La primera pérdida se registró, pero la interfaz mostró `Cannot read properties of undefined (reading 'length')`. Tras el deploy, el retest dio 42, premio 5 (1,40×), actualizó el saldo y no produjo errores de consola. |
| Ruleta | Apuesta de 4 | Segmento 10, multiplicador 1,60×, premio 6; el saldo llegó a 4.988. |
| Minas | Apuesta de 4; se reveló la casilla 1 | Se encontró una mina, la partida quedó `lost` y la reserva se liberó. |
| Crash | Apuesta de 4 | La ronda llegó a 1,12× y quedó `crashed` antes de que la acción de cobro se procesara. Se perdió la apuesta y no quedó ronda activa. |
| Lotería 15/25 | Compra digital de 10 en el sorteo abierto #1 | Cartón #5 creado y pendiente; no se cerró ni liquidó el sorteo. |
| Jackpot | Sin apuesta | No había sorteo abierto; la propia interfaz deshabilitó la entrada. No se abrió un sorteo artificialmente. |

Conciliación final consultada en SQL Editor después de retirar el rol temporal:

- Usuario `ai_audiror`: saldo 4.971; roles únicamente `ai_auditor`.
- Apuestas instantáneas: slots 10/pérdida, dados 4/pérdida más retest 4/premio 5,
  ruleta 4/premio 6.
- Rondas arcade: Minas `lost`, Crash `crashed`; 0 rondas activas.
- Un cartón de lotería, número 5, asociado al sorteo #1 aún abierto; 0 entradas
  al Jackpot.
- `qa_test_issuance`: saldo 5.000; no borrar esta cuenta contable ni alterar el
  ledger para “deshacer” la prueba. El asiento sintético y las jugadas quedan
  como trazabilidad de QA.
- En la ronda posterior se usó el flujo de caja física existente para simular
  dinero de juguete: 500 de depósito y 100 de canje para cada una de
  `nuevonuevo`, `lodelchino` y `davidmonteros`. Los seis asientos son
  `physical_deposit` / `physical_redemption`, hechos por `ai_audiror`, con
  descripción explícita de que es una simulación QA. No son efectivo real.
- Estado después de esos movimientos: `nuevonuevo` 490, `lodelchino` 1.619,
  `davidmonteros` 1.256; Caja física 7.569; total billeteras 10.339.
  Conciliación: 21.641 débitos = 21.641 créditos, 0 desbalances y 0 diferencias
  de saldo contra el ledger.
- Luego se probó Jackpot #2 con `ai_audiror`: entrada de 10, único participante,
  premio de 7, y 3 fichas a ganancias de la casa. El sorteo quedó liquidado, el
  pozo en 0 y el saldo de `ai_audiror` en 4.968. Las tres cuentas humanas no
  hicieron apuestas nuevas.
- Estado financiero final: Caja física 7.569; ganancias de la casa 914; total
  billeteras 10.336; 291 asientos, 215 apuestas y 5 cartones. Conciliación:
  21.658 débitos = 21.658 créditos, 0 desbalances y 0 diferencias de saldo.
- En esa fotografía histórica, `Vanesaflores` conservaba la única ronda arcade
  activa y Lotería #1 seguía abierta; ninguna se tocó durante esa operación.
- A continuación, por instrucción expresa del propietario de probar todos los
  usuarios del bucket, se acreditaron 500 fichas de juguete por el flujo normal
  de Caja física a cada una de las seis cuentas registradas. El panel activó
  primero a `Vanesaf`, cuya cuenta estaba pendiente; no se usó la identidad de
  ninguna cuenta destino.
- Estado después de estas seis nuevas acreditaciones:
  `ai_audiror` 5.468; `davidmonteros` 1.756; `lodelchino` 2.119;
  `nuevonuevo` 990; `Vanesaf` 500; `Vanesaflores` 2.503. Caja física 10.569;
  billeteras 13.336. Se confirmaron seis asientos de 500 con el motivo
  “Simulación de dinero de juguete para QA; acreditación por Caja física”.
  Débitos y créditos totales: 24.658 cada uno; 0 asientos desbalanceados y
  0 diferencias de saldos. No se hicieron apuestas ni canjes en esta operación.
- En esa fotografía histórica, Lotería #1 seguía abierta, Jackpot no tenía
  sorteo abierto y la ronda activa global de `Vanesaflores` permanecía sin
  cambios.
- Diferencias de balances contra el ledger: 0. Asientos desbalanceados: 0.

#### Hallazgo y corrección de Dados

El HTML compartido de los juegos contiene también la ruleta oculta. `playInstant`
buscaba `.arcade-wheel` globalmente, por lo que la página de Dados encontraba ese
elemento oculto y `finishInstantAnimation` intentaba leer
`gameStatus.settings.multipliers.length`, una propiedad que Dados no tiene. La
apuesta ya estaba confirmada en el servidor, pero la excepción impedía completar
la actualización visual posterior. Se corrigió en `juegos/arcade/arcade.js` para
seleccionar la ruleta solo cuando `gameKey` es `wheel`. `npm run build` y
`git diff --check` pasaron. Con autorización, se publicó el commit `4af2e79`
(`fix: handle dice result animation`) en `main`. Vercel sirvió la ruta de Dados
con el bundle nuevo `arcade-B30OdaRm.js`; una apuesta de retest de 4 fichas mostró
el resultado 42 y el premio de 5, actualizó el saldo a 4.971 y no generó errores
de consola.

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
activo podría participar en un juego habilitado si tiene saldo. No realizar
apuestas en producción por defecto; la ejecución descrita arriba fue una
excepción limitada autorizada explícitamente por el propietario.

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
- Todavía no incluye un orquestador que lance apuestas de prueba. Las jugadas de
  esta sesión se realizaron manualmente por los flujos existentes de la web; no
  se automatizó una matriz exhaustiva de RPC, concurrencia o reintentos.
- La migración se parseó con `pglast`, se aplicó en producción y se verificaron
  por consultas de catálogo la función, la restricción y los grants básicos.
  El frontend pasó `npm run build`, `node --check` y `git diff --check`.
- La página y la RPC se validaron con una sesión autorizada, además de consultas
  de conciliación antes y después de QA. Esto no equivale a probar todos los
  informes de catálogo, políticas o esquinas de ejecución.

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
| `20261026200000_jva_readonly_platform_audit.sql` | role `ai_auditor` e informe de metadatos/conciliación | Aplicada en producción; RPC/grants verificados y el informe se consultó con `ai_audiror` el 27/10/2026 |

El estado remoto solo se resuelve revisando el proyecto/ref correcto y la tabla
de versiones aplicada. No volver a ejecutar SQL manualmente solo porque aparezca
en este listado. La aplicación manual anterior de migraciones hace especialmente
importante reconciliar historial de versiones antes de usar `supabase db push`.

## 7. Seguridad y límites operativos

- Una página no es segura por no estar enlazada o por tener una URL difícil de
  adivinar. La autorización se hace en servidor/RPC con sesión y rol.
- `ai_auditor` debe ser cuenta de prueba propia y normalmente recibir solo ese
  rol. En este bucket descartable, `ai_audiror` conserva además `admin` por
  autorización expresa del propietario para las pruebas. No extender ese permiso
  a otras cuentas o proyectos sin autorización.
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
2. Continuar la auditoría multiusuario desde `qa_colmena_01`,
   `qa_colmena_02` y `qa_colmena_03`; activación, depósito de 620 fichas y
   login ya están verificados. Las claves están solo en
   `.qa-credentials.local.md`. Antes de apostar, consultar el estado remoto,
   confirmar que los sorteos siguen cerrados y acordar/registrar la matriz.
   Las cuentas `qa_multi_*` anteriores no tienen claves disponibles.
3. Investigar, sin aumentar la apuesta, por qué la vista previa histórica de
   Dados mostró 210 mientras la transacción guardó máximo/pago 331. El servidor
   y el ledger cuadran; la diferencia no está reproducida en el estado actual.
4. Los sorteos #3–#7 de ambos juegos están liquidados según la última
   verificación. Consultar estado remoto antes de abrir la próxima ronda.
   Planificar las cantidades y conciliar después de cada liquidación.
5. Para sesiones simultáneas ya se comprobó que los orígenes
   `127.0.0.1:4176`, `localhost:4177` y `127.0.0.1:4178` aíslan Auth. Reutilizar
   estos servidores mientras sigan activos o iniciarlos de nuevo y verificar
   HTTP antes del login. No usar cuentas humanas ni convertir el rol `admin`
   de aplicación en acceso privilegiado de base de datos.
6. La autorización de este bucket descartable no se extiende a otros proyectos.
   Fuera de él, obtener autorización específica y preferir staging.
7. La tanda visual revisó textos/estados y algunas animaciones con importes
   mínimos, pero no valida toda la plataforma ni todos los estados límite.
   Completar una matriz de saldos insuficientes, fondos/reservas, reintentos,
   concurrencia, permisos y juegos pausados; conciliar después de cada tanda.
   El cambio desplegado de Crash que distingue el multiplicador cobrado del
   punto de caída se verificó con una respuesta simulada, sin apostar. La
   verificación integral con un pago real queda pendiente; no repetir rondas
   reales buscando un cobro favorable.
   Para nuevas pruebas de juegos, usar las cuentas QA, documentar cada apuesta,
   mantener reglas fijas y no perseguir secuencias de premios.
8. Conservar este registro y no borrar el asiento, el ticket o la cuenta fuente
   QA para simular una reversión. Una eliminación futura del proyecto/base requiere
   una instrucción específica y no forma parte de este trabajo.
9. Definir modalidad y modelo económico; separar la actual lotería 15/25 de
   Quiniela/Quini 6 y verificar reglas con fuentes oficiales antes de programar.
10. Diseñar alta segura de cuentas Auth de invitados y terminal de caja/impresión
   (Python/CustomTkinter, 58 mm) conectadas al mismo ledger y con rol de cajero.
11. Migrar mesas/chat legacy a RPC seguras, o mantenerlas fuera de navegación.
12. Añadir tests automatizados y pipeline CI; no existe suite de tests en npm ni
    `.github` workflow según la inspección actual.
13. Hacer limpieza de legado solo tras inspeccionar referencias/imports y confirmar
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
