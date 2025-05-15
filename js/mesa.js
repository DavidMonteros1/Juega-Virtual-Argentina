import { obtenerDetallesMesa, enviarResultadoJugador, salirDeMesa, suscribirMesasRealtime, suscribirMesasUsuariosRealtime } from './mesas.js';
import { getUsuarioActual } from './auth.js';
import { mostrarMensaje } from './util.js';



let mesaId = null;
let usuarioActual = null;
let mesaActual = null;
let expulsado = false;
let actividadTimeout = null;


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

    // Mostrar/ocultar botones según estado y reglas
    const botones = ['btn-gane', 'btn-perdi', 'btn-empate', 'btn-salir'];
    botones.forEach(id => document.getElementById(id).classList.add('oculto'));

    // Solo mostrar botones si la mesa está en estado "jugando" y el usuario está activo en la mesa
    const jugadorEnMesa = (mesaActual.jugadores || []).find(j => j.usuario_id === usuarioActual.id && j.estado !== 'salio');
    if (mesaActual.estado === 'jugando' && jugadorEnMesa) {
      botones.forEach(id => document.getElementById(id).classList.remove('oculto'));

      // Si ya envió resultado, deshabilitar botones de resultado
      if (jugadorEnMesa.resultado_manual) {
        ['btn-gane', 'btn-perdi', 'btn-empate'].forEach(id => {
          document.getElementById(id).disabled = true;
        });
      } else {
        ['btn-gane', 'btn-perdi', 'btn-empate'].forEach(id => {
          document.getElementById(id).disabled = false;
        });
      }

      // Si ya hay un ganador, deshabilitar botón "gane"
      const hayGanador = (mesaActual.jugadores || []).some(j => j.resultado_manual === 'gane');
      if (hayGanador) {
        document.getElementById('btn-gane').disabled = true;
      }
    }

    if (mesaActual.estado === 'cerrada') {
      mostrarMensaje('La mesa ha finalizado.', 'info');
      setTimeout(() => window.location.href = '../lobby.html', 2000);
    }

    // Actualizar lista de jugadores
    actualizarJugadoresVista(mesaActual.jugadores);

    // Mostrar estado de juego
    mostrarEstadoJuego(mesaActual);

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
  (jugadores || []).forEach(j => {
    // Solo mostrar jugadores activos o que hayan enviado resultado
    if (['esperando', 'jugando', 'salio'].includes(j.estado)) {
      const li = document.createElement('li');
      li.textContent = `${j.usuarios.nombre_usuario} - Estado: ${j.estado}${j.resultado_manual ? ' (' + j.resultado_manual + ')' : ''}`;
      if (j.usuario_id === usuarioActual.id) li.style.fontWeight = 'bold';
      lista.appendChild(li);
    }
  });
  console.log('[Mesa][Jugadores]', (jugadores || []).map(j => ({
    nombre: j.usuarios.nombre_usuario,
    estado: j.estado,
    resultado: j.resultado_manual
  })));
}

// Mostrar estado de juego y mensajes relevantes
function mostrarEstadoJuego(mesa) {
  const estadoDiv = document.getElementById('estado-juego');
  if (!mesa || !mesa.jugadores) {
    estadoDiv.textContent = '';
    return;
  }
  const jugadores = mesa.jugadores;
  const hayGanador = jugadores.some(j => j.resultado_manual === 'gane');
  const todosPerdi = jugadores.every(j => j.resultado_manual === 'perdi');
  const todosEmpate = jugadores.every(j => j.resultado_manual === 'empate');
  let texto = '';

  if (mesa.estado === 'jugando') {
    if (hayGanador) {
      const ganador = jugadores.find(j => j.resultado_manual === 'gane');
      texto = `¡${ganador.usuarios.nombre_usuario} ha ganado la mesa!`;
    } else if (todosPerdi) {
      texto = 'Todos los jugadores han perdido. Se reintegran las fichas.';
    } else if (todosEmpate) {
      texto = 'Todos los jugadores han empatado. Se reintegran las fichas.';
    } else {
      texto = 'Esperando resultados de los jugadores...';
    }
  } else if (mesa.estado === 'cerrada') {
    texto = 'La mesa ha finalizado.';
  } else {
    texto = '';
  }
  estadoDiv.textContent = texto;
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







