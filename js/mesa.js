import { supabase } from './supabase.js';
import { obtenerDetallesMesa, iniciarJuego, enviarResultadoJugador } from './mesas.js';
import { mostrarMensaje } from './util.js';

let usuarioActual = null;

export async function cargarDetallesMesa(mesaId, usuarioId) {
  try {
    const detalles = await obtenerDetallesMesa(mesaId, usuarioId);

    document.getElementById('mesa-nombre').textContent = `Mesa: ${detalles.nombre_mesa}`;
    document.getElementById('mesa-detalles').textContent = `Estado: ${detalles.estado} | Apuesta: ${detalles.fichas_apuesta} fichas`;

    // Mostrar botón "Iniciar juego" solo al creador y si el estado es 'abierta'
    const botonIniciar = document.getElementById('iniciar-juego');
    if (detalles.creador_id === usuarioId && detalles.estado === 'abierta') {
      botonIniciar.classList.remove('oculto');
    }

    if (detalles.estado === 'jugando') {
      document.getElementById('resultado-container').classList.remove('oculto');
      document.getElementById('enviar-resultado').classList.remove('oculto');
    }

    actualizarJugadores(mesaId);
  } catch (error) {
    console.error('Error al cargar los detalles de la mesa:', error.message);
    mostrarMensaje('No se pudo cargar la mesa.', 'error');
    window.location.href = '../lobby.html';
  }
}

export async function actualizarJugadores(mesaId) {
  const { data, error } = await supabase
    .from('mesas_usuarios')
    .select('usuario_id, estado, resultado_manual, usuarios(nombre_usuario)')
    .eq('mesa_id', mesaId);

  if (error) {
    mostrarMensaje('Error al obtener jugadores.', 'error');
    return;
  }

  const lista = document.getElementById('jugadores-lista');
  lista.innerHTML = '';

  data.forEach((j) => {
    const li = document.createElement('li');
    li.textContent = `${j.usuarios.nombre_usuario} - Estado: ${j.estado}${j.resultado_manual ? ' (' + j.resultado_manual + ')' : ''}`;
    lista.appendChild(li);
  });
}

export async function salirDeMesa(mesaId, usuarioId) {
  await supabase
    .from('mesas_usuarios')
    .delete()
    .eq('mesa_id', mesaId)
    .eq('usuario_id', usuarioId);

  window.location.href = '../lobby.html';
}