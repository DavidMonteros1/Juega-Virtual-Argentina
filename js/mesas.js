import { supabase } from './supabase.js';
import { getUsuarioActual } from './auth.js';

// Obtener mesas abiertas
export async function obtenerMesas() {
  const { data, error } = await supabase
    .from('mesas')
    .select('id, nombre_mesa, fichas_apuesta, max_jugadores, estado, creador_id, creador:usuarios(nombre_usuario)') // Incluye el nombre del creador
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

  // Validar si el usuario tiene suficientes fichas
  if (usuario.fichas < fichas_apuesta) {
    return { error: 'No tienes suficientes fichas para crear esta mesa.' };
  }

  // Crear la mesa
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

  // Agregar al creador como participante en la mesa
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

// Unirse a una mesa
export async function unirseAMesa(mesa_id) {
  const usuario = await getUsuarioActual();
  if (!usuario) {
    return { error: 'No autenticado' };
  }

  // Validar si la mesa está llena
  const { data: jugadores, error: errorJugadores } = await supabase
    .from('mesas_usuarios')
    .select('*')
    .eq('mesa_id', mesa_id);

  if (errorJugadores) {
    console.error('Error al obtener jugadores en la mesa:', errorJugadores.message);
    return { error: 'No se pudo verificar el estado de la mesa.' };
  }

  const { data: mesa, error: errorMesa } = await supabase
    .from('mesas')
    .select('max_jugadores')
    .eq('id', mesa_id)
    .single();

  if (errorMesa) {
    console.error('Error al obtener detalles de la mesa:', errorMesa.message);
    return { error: 'No se pudo verificar el estado de la mesa.' };
  }

  if (jugadores.length >= mesa.max_jugadores) {
    return { error: 'La mesa ya está llena.' };
  }

  // Agregar al usuario a la mesa
  const { error } = await supabase
    .from('mesas_usuarios')
    .insert([
      {
        mesa_id,
        usuario_id: usuario.id,
        fichas_apostadas: 0,
        estado: 'esperando',
      }
    ]);

  return { error };
}

// Obtener usuarios en una mesa
export async function obtenerUsuariosEnMesa(mesa_id) {
  const { data, error } = await supabase
    .from('mesas_usuarios')
    .select('*, usuarios(nombre_usuario)')
    .eq('mesa_id', mesa_id);

  if (error) {
    console.error('Error al obtener usuarios en la mesa:', error.message);
    return { error: 'No se pudo obtener la lista de usuarios.' };
  }

  return data;
}