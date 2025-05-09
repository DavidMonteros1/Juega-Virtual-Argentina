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