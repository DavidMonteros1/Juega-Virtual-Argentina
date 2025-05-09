// js/mesas.js
import { supabase } from './supabase.js';
import { getUsuarioActual } from './auth.js';

// Obtener mesas abiertas
export async function obtenerMesas() {
  const { data, error } = await supabase
    .from('mesas')
    .select('*')
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

  const { error } = await supabase.from('mesas').insert([
    {
      nombre_mesa,
      fichas_apuesta,
      max_jugadores,
      creador_id: usuario.id,
    }
  ]);

  return { error };
}

// Unirse a una mesa
export async function unirseAMesa(mesa_id) {
  const usuario = await getUsuarioActual();
  if (!usuario) {
    return { error: 'No autenticado' };
  }

  const { error } = await supabase.from('mesas_usuarios').insert([
    {
      mesa_id,
      usuario_id: usuario.id,
      fichas_apostadas: 0,
      estado: 'esperando'
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
    return [];
  }

  return data;
}