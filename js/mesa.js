// js/mesa.js
import { supabase } from './supabase.js';
import { redirigirSiNoAutenticado } from './auth.js';
import { mostrarMensaje } from './util.js';

let usuarioActual = null;

export async function obtenerDetallesMesa(mesaId, usuarioId) {
  redirigirSiNoAutenticado();

  const { data: usuario } = await supabase.auth.getUser();
  usuarioActual = usuario.user;

  // Cargar datos de la mesa
  const { data: mesa, error } = await supabase
    .from('mesas')
    .select('*')
    .eq('id', mesaId)
    .single();

  if (error || !mesa) {
    alert("No se pudo cargar la mesa.");
    window.location.href = '../lobby.html';
    return;
  }

  document.getElementById('mesa-nombre').textContent = `Mesa: ${mesa.nombre_mesa}`;
  document.getElementById('mesa-detalles').textContent = `Estado: ${mesa.estado} | Apuesta: ${mesa.fichas_apuesta} fichas`;

  // Mostrar botón "Iniciar juego" solo al creador y si el estado es 'abierta'
  const botonIniciar = document.getElementById('iniciar-juego');
  if (mesa.creador_id === usuarioId && mesa.estado === 'abierta') {
    botonIniciar.classList.remove('oculto');
  }

  if (mesa.estado === 'jugando') {
    document.getElementById('resultado-container').classList.remove('oculto');
    document.getElementById('enviar-resultado').classList.remove('oculto');
  }

  actualizarJugadores(mesaId);
}

export async function actualizarJugadores(mesaId) {
  const { data, error } = await supabase
    .from('mesas_usuarios')
    .select('usuario_id, estado, resultado_manual, usuarios(nombre_usuario)')
    .eq('mesa_id', mesaId);

  if (error) {
    mostrarMensaje("Error al obtener jugadores.");
    return;
  }

  const lista = document.getElementById('jugadores-lista');
  lista.innerHTML = '';

  data.forEach(j => {
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

export async function iniciarJuego(mesaId) {
  const { error } = await supabase
    .from('mesas')
    .update({ estado: 'jugando' })
    .eq('id', mesaId);

  if (!error) {
    mostrarMensaje("Juego iniciado.");
    location.reload();
  }
}

export async function enviarResultadoJugador(mesaId, usuarioId, resultado) {
  const { error } = await supabase
    .from('mesas_usuarios')
    .update({
      estado: resultado,
      resultado_manual: resultado
    })
    .eq('mesa_id', mesaId)
    .eq('usuario_id', usuarioId);

  if (!error) {
    mostrarMensaje("Resultado enviado.");
    actualizarJugadores(mesaId);
  }
}
