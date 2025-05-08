// js/historial.js
import { supabase } from './supabase.js';
import { getUsuarioActual } from './auth.js';

/**
 * Obtener historial de jugadas del usuario actual
 */
export async function obtenerHistorialJugadas() {
  const usuario = await getUsuarioActual();
  if (!usuario) return [];

  const { data, error } = await supabase
    .from('jugadas')
    .select('*')
    .eq('usuario_id', usuario.id)
    .order('creada_en', { ascending: false });

  if (error) {
    console.error('Error al obtener historial de jugadas:', error.message);
    return [];
  }

  return data;
}

/**
 * Obtener historial de mesas en las que participó el usuario
 */
export async function obtenerHistorialMesas() {
  const usuario = await getUsuarioActual();
  if (!usuario) return [];

  const { data, error } = await supabase
    .from('historial_mesas')
    .select('*')
    .eq('usuario_id', usuario.id)
    .order('creada_en', { ascending: false });

  if (error) {
    console.error('Error al obtener historial de mesas:', error.message);
    return [];
  }

  return data;
}

/**
 * Obtener movimientos de fichas del usuario (apuestas, ganancias, etc.)
 */
export async function obtenerMovimientosFichas() {
  const usuario = await getUsuarioActual();
  if (!usuario) return [];

  const { data, error } = await supabase
    .from('movimientos_fichas')
    .select('*')
    .eq('usuario_id', usuario.id)
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('Error al obtener movimientos de fichas:', error.message);
    return [];
  }

  return data;
}
