import { supabase } from './supabase.js';
import { getUsuarioActual } from './auth.js';

// Obtener mesas abiertas
export async function obtenerMesas() {
  const { data, error } = await supabase
    .from('mesas')
    .select('id, nombre_mesa, fichas_apuesta, max_jugadores, estado, creador_id, jugadores:mesas_usuarios(usuario_id), creador:usuarios(nombre_usuario)')
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

  return { data: mesa };
}

// Unirse a una mesa
export async function unirseAMesa(mesaId) {
  const usuario = await getUsuarioActual();
  if (!usuario) {
    return { error: 'No autenticado' };
  }

  // Verificar si hay lugares disponibles
  const { data: mesa, error: errorMesa } = await supabase
    .from('mesas')
    .select('id, max_jugadores, jugadores:mesas_usuarios(usuario_id)')
    .eq('id', mesaId)
    .single();

  if (errorMesa || !mesa) {
    return { error: 'No se pudo obtener la información de la mesa.' };
  }

  const jugadoresActuales = mesa.jugadores.length;
  if (jugadoresActuales >= mesa.max_jugadores) {
    return { error: 'La mesa está llena.' };
  }

  // Unirse a la mesa
  const { error } = await supabase
    .from('mesas_usuarios')
    .insert([
      {
        mesa_id: mesaId,
        usuario_id: usuario.id,
        fichas_apostadas: 0,
        estado: 'activo',
      }
    ]);

  if (error) {
    console.error('Error al unirse a la mesa:', error.message);
    return { error };
  }

  return { success: true };
}

// Obtener detalles de una mesa
export async function obtenerDetallesMesa(mesaId, usuarioId) {
  const { data, error } = await supabase
    .from('mesas')
    .select('id, nombre_mesa, fichas_apuesta, max_jugadores, estado, creador_id, jugadores:mesas_usuarios(usuario_id, estado, resultado_manual, usuarios(nombre_usuario))')
    .eq('id', mesaId)
    .single();

  if (error) {
    console.error('Error al obtener detalles de la mesa:', error.message);
    throw new Error('No se pudo obtener los detalles de la mesa.');
  }

  return data;
}

// Enviar resultado del jugador
export async function enviarResultadoJugador(mesaId, usuarioId, resultado) {
  const { error } = await supabase
    .from('mesas_usuarios')
    .update({ resultado_manual: resultado })
    .eq('mesa_id', mesaId)
    .eq('usuario_id', usuarioId);

  if (error) {
    console.error('Error al enviar el resultado del jugador:', error.message);
    return { error: 'No se pudo enviar el resultado.' };
  }

  return { success: true };
}

// Salir de una mesa
export async function salirDeMesa(mesaId, usuarioId) {
  const { error } = await supabase
    .from('mesas_usuarios')
    .delete()
    .eq('mesa_id', mesaId)
    .eq('usuario_id', usuarioId);

  if (error) {
    console.error('Error al salir de la mesa:', error.message);
    return { error: 'No se pudo salir de la mesa.' };
  }

  return { success: true };
}

// Iniciar juego en una mesa
export async function iniciarJuego(mesaId) {
  const { error } = await supabase
    .from('mesas')
    .update({ estado: 'jugando' })
    .eq('id', mesaId);

  if (error) {
    console.error('Error al iniciar el juego:', error.message);
    return { error: 'No se pudo iniciar el juego.' };
  }

  return { success: true };
}