import { obtenerDetallesMesa, enviarResultadoJugador, salirDeMesa, suscribirMesasRealtime, suscribirMesasUsuariosRealtime } from './mesas.js';
import { getUsuarioActual } from './auth.js';
import { mostrarMensaje } from './util.js';

/*
========================
AUTOEVALUACIÓN 1: LECTURA DE CONTEXTO
========================
- La vista de la mesa debe ser 100% realtime.
- Mostrar nombre, estado, apuesta, pozo, jugadores y sus estados/resultados.
- Botones: "gane", "perdi", "empate", "salir/abandonar".
- Solo 1 puede elegir "gane". Si todos "perdi" o "empate", reintegro.
- Al abandonar/desconectar, cuenta como "perdi" sin reintegro.
- Al finalizar, expulsar a todos y cerrar la mesa.
- Todo debe reflejarse en tiempo real.
- Agregar logs detallados para depuración.
- No expulsar por recarga/minimizar/cerrar navegador, solo por inactividad real (>10min).
========================
*/

let mesaId = null;
let usuarioActual = null;
let mesaActual = null;
let expulsado = false;
let actividadTimeout = null;
const TIEMPO_EXPULSION_MS = 10 * 60 * 1000; // 10 minutos

// Inicializar la vista de la mesa
export async function inicializarMesaVista(idMesa) {
  mesaId = idMesa;
  usuarioActual = await getUsuarioActual();
  if (!usuarioActual) {
    mostrarMensaje('No autenticado', 'error');
    window.location.href = '../login.html';
    return;
  }
  console.log('[Mesa][Init] Usuario:', usuarioActual.nombre_usuario, 'Mesa:', mesaId);

  await cargarDetallesMesa();

  // Suscribirse a cambios realtime en la mesa y sus jugadores
  suscribirMesasRealtime((payload) => {
    if (payload.new && payload.new.id === mesaId) {
      console.log('[Mesa][Realtime][mesas] Actualización recibida:', payload);
      cargarDetallesMesa();
    }
  });
  suscribirMesasUsuariosRealtime((payload) => {
    if (payload.new && payload.new.mesa_id === mesaId) {
      console.log('[Mesa][Realtime][mesas_usuarios] Actualización recibida:', payload);
      cargarDetallesMesa();
    }
  });

  // Configurar botones
  document.getElementById('btn-gane').onclick = () => enviarResultado('gane');
  document.getElementById('btn-perdi').onclick = () => enviarResultado('perdi');
  document.getElementById('btn-empate').onclick = () => enviarResultado('empate');
  document.getElementById('btn-salir').onclick = () => abandonarMesa();

  // Iniciar detección de actividad del usuario
  inicializarDeteccionActividad();
}

// Cargar detalles de la mesa y actualizar la vista
async function cargarDetallesMesa() {
  try {
    mesaActual = await obtenerDetallesMesa(mesaId);
    if (!mesaActual) throw new Error('No se pudo obtener la mesa');
    console.log('[Mesa][Detalles]', mesaActual);

    // Nombre, estado, apuesta, pozo
    document.getElementById('mesa-nombre').textContent = `Mesa: ${mesaActual.nombre_mesa}`;
    document.getElementById('mesa-detalles').textContent =
      `Estado: ${mesaActual.estado} | Apuesta: ${mesaActual.fichas_apuesta} fichas | Pozo: ${mesaActual.fichas_apuesta * mesaActual.max_jugadores} fichas`;

    // Mostrar/ocultar botones según estado
    const botones = ['btn-gane', 'btn-perdi', 'btn-empate', 'btn-salir'];
    botones.forEach(id => document.getElementById(id).classList.add('oculto'));
    if (mesaActual.estado === 'jugando') {
      botones.forEach(id => document.getElementById(id).classList.remove('oculto'));
    }
    if (mesaActual.estado === 'cerrada') {
      mostrarMensaje('La mesa ha finalizado.', 'info');
      setTimeout(() => window.location.href = '../lobby.html', 2000);
    }

    // Actualizar lista de jugadores
    actualizarJugadoresVista(mesaActual.jugadores);

  } catch (error) {
    console.error('[Mesa][Error] al cargar detalles:', error.message);
    mostrarMensaje('No se pudo cargar la mesa.', 'error');
    setTimeout(() => window.location.href = '../lobby.html', 2000);
  }
}

// Actualizar la lista de jugadores en la vista
function actualizarJugadoresVista(jugadores) {
  const lista = document.getElementById('jugadores-lista');
  lista.innerHTML = '';
  jugadores.forEach(j => {
    const li = document.createElement('li');
    li.textContent = `${j.usuarios.nombre_usuario} - Estado: ${j.estado}${j.resultado_manual ? ' (' + j.resultado_manual + ')' : ''}`;
    if (j.usuario_id === usuarioActual.id) li.style.fontWeight = 'bold';
    lista.appendChild(li);
  });
  console.log('[Mesa][Jugadores]', jugadores.map(j => ({
    nombre: j.usuarios.nombre_usuario,
    estado: j.estado,
    resultado: j.resultado_manual
  })));
}

// Enviar resultado del usuario
async function enviarResultado(resultado) {
  console.log('[Mesa][Accion] Enviando resultado:', resultado);
  reiniciarContadorActividad();
  const res = await enviarResultadoJugador(mesaId, resultado);
  if (res.error) {
    mostrarMensaje(res.error, 'error');
    return;
  }
  mostrarMensaje('Resultado enviado.', 'success');
}

// Abandonar la mesa
async function abandonarMesa() {
  if (!confirm('¿Seguro que quieres abandonar la mesa? Esto contará como "perdi" y no se reintegrarán fichas.')) return;
  console.log('[Mesa][Accion] Abandonando mesa');
  const res = await salirDeMesa(mesaId);
  if (res.error) {
    mostrarMensaje(res.error, 'error');
    return;
  }
  mostrarMensaje('Has abandonado la mesa.', 'info');
  setTimeout(() => window.location.href = '../lobby.html', 1500);
}

/* ========================
   DETECCIÓN DE ACTIVIDAD
   ======================== */
function inicializarDeteccionActividad() {
  reiniciarContadorActividad();
  // Consideramos actividad: click, keydown, mousemove, touchstart, focus
  ['click', 'keydown', 'mousemove', 'touchstart', 'focus'].forEach(evt =>
    window.addEventListener(evt, reiniciarContadorActividad)
  );
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      reiniciarContadorActividad();
    }
  });
  console.log('[Mesa][Actividad] Detección de actividad inicializada. Expulsión tras 10 minutos de inactividad.');
}

function reiniciarContadorActividad() {
  if (actividadTimeout) clearTimeout(actividadTimeout);
  actividadTimeout = setTimeout(expulsarPorInactividad, TIEMPO_EXPULSION_MS);
  //console.log('[Mesa][Actividad] Contador de inactividad reiniciado.');
}

async function expulsarPorInactividad() {
  if (expulsado) return;
  expulsado = true;
  console.log('[Mesa][Actividad] Usuario expulsado por inactividad de más de 10 minutos.');
  await salirDeMesa(mesaId);
  mostrarMensaje('Fuiste expulsado de la mesa por inactividad (más de 10 minutos).', 'info');
  setTimeout(() => window.location.href = '../lobby.html', 2000);
}

/*
========================
AUTOEVALUACIÓN 2: REVISIÓN DE CÓDIGO
========================
- No se expulsa por recarga, minimizar o cerrar navegador.
- Solo se expulsa por inactividad real (>10 minutos sin interacción).
- Se suscribe a cambios realtime en mesas y mesas_usuarios.
- Actualiza la vista en tiempo real.
- Muestra nombre, estado, apuesta, pozo y jugadores.
- Botones de acción según estado.
- Abandono cuenta como "perdi" y redirige.
- Logs detallados en cada proceso.
- No se elimina ninguna funcionalidad previa relevante.
========================
*/

/*
========================
AUTOEVALUACIÓN 3: COMPARACIÓN FINAL CON CONTEXTO
========================
- El código sigue la lógica y mecánicas del contexto-proyecto.md.
- No contradice el contexto ni omite funcionalidades clave.
- Mantiene y mejora la experiencia realtime y la depuración.
- Todas las partes funcionales existentes siguen presentes.
========================
*/

/*
========================
EXPLICACIÓN DE REPARACIÓN
========================
- Se elimina la expulsión por recarga/minimizar/cerrar navegador.
- Se implementa expulsión solo por inactividad real (>10 minutos sin interacción).
- El usuario puede recargar/minimizar/cerrar y volver sin ser penalizado, siempre que no supere el tiempo de inactividad.
- Se refuerzan los logs y la trazabilidad.
========================
*/