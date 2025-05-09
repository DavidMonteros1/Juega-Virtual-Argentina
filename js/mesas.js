import { supabase } from './supabase.js';
import { getUsuarioActual } from './auth.js';

// Obtener mesas abiertas
export async function obtenerMesas() {
  const { data, error } = await supabase
    .from('mesas')
    .select('id, nombre_mesa, fichas_apuesta, max_jugadores, estado, creador_id, creador:usuarios(nombre_usuario)')
    .eq('estado', 'abierta')
    .order('creada_en', { ascending: false });

  if (error) {
    console.error('Error al obtener mesas:', error.message);
    return [];
  }

  return data;
}

// Crear una nueva mesa
export async function crearMesa(nombre_mesa, fichas_apuesta, max_jugadores) {
  const usuario = await getUsuarioActual();
  if (!usuario) {
    return { error: 'No autenticado' };
  }

  if (usuario.fichas < fichas_apuesta) {
    return { error: 'No tienes suficientes fichas para crear esta mesa.' };
  }

  const { data: mesa, error } = await supabase
    .from('mesas')
    .insert([
      {
        nombre_mesa,
        fichas_apuesta,
        max_jugadores,
        creador_id: usuario.id,
        estado: 'abierta',
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error al crear la mesa:', error.message);
    return { error };
  }

  const { error: errorParticipante } = await supabase
    .from('mesas_usuarios')
    .insert([
      {
        mesa_id: mesa.id,
        usuario_id: usuario.id,
        fichas_apostadas: 0,
        estado: 'activo',
      }
    ]);

  if (errorParticipante) {
    console.error('Error al agregar al creador como participante:', errorParticipante.message);
    return { error: errorParticipante };
  }

  return { data: mesa };
}

// Obtener detalles de una mesa
export async function obtenerDetallesMesa(mesaId, usuarioId) {
  const { data: mesa, error } = await supabase
    .from('mesas')
    .select('*')
    .eq('id', mesaId)
    .single();

  if (error || !mesa) {
    console.error('Error al obtener detalles de la mesa:', error?.message);
    throw new Error('No se pudo cargar la mesa.');
  }

  const { data: jugadores, error: errorJugadores } = await supabase
    .from('mesas_usuarios')
    .select('usuario_id, estado, resultado_manual, usuarios(nombre_usuario)')
    .eq('mesa_id', mesaId);

  if (errorJugadores) {
    console.error('Error al obtener jugadores de la mesa:', errorJugadores.message);
    throw new Error('No se pudieron cargar los jugadores.');
  }

  return {
    ...mesa,
    jugadores,
  };
}

// Iniciar el juego
export async function iniciarJuego(mesa_id) {
  const { error } = await supabase
    .from('mesas')
    .update({ estado: 'jugando' })
    .eq('id', mesa_id);

  if (error) {
    console.error('Error al iniciar el juego:', error.message);
    return { error };
  }

  return { success: true };
}

// Enviar resultado del jugador
export async function enviarResultadoJugador(mesa_id, usuario_id, resultado) {
  const { error } = await supabase
    .from('mesas_usuarios')
    .update({
      estado: resultado,
      resultado_manual: resultado,
    })
    .eq('mesa_id', mesa_id)
    .eq('usuario_id', usuario_id);

  if (error) {
    console.error('Error al enviar el resultado:', error.message);
    return { error };
  }

  return { success: true };
}