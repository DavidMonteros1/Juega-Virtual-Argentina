// js/chat.js
import { supabase } from './supabase.js';
import { getUsuarioActual } from './auth.js';

let canalChat = null;

/**
 * Iniciar el canal de escucha de mensajes de chat global
 * @param {Function} callback - Función que recibe nuevos mensajes
 */
export function iniciarChat(callback) {
  canalChat = supabase
    .channel('chat_global')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mensajes_chat' },
      (payload) => {
        const mensaje = payload.new;
        callback(mensaje);
      }
    )
    .subscribe();
}

/**
 * Enviar un mensaje al chat global
 * @param {string} texto - El contenido del mensaje
 */
export async function enviarMensaje(texto) {
  const usuario = await getUsuarioActual();
  if (!usuario) return { error: 'Usuario no autenticado' };

  const { error } = await supabase.from('mensajes_chat').insert([
    {
      usuario_id: usuario.id,
      nombre_usuario: usuario.nombre_usuario,
      mensaje: texto,
    }
  ]);

  return { error };
}

/**
 * Obtener mensajes anteriores (últimos 50)
 */
export async function obtenerMensajesAnteriores() {
  const { data, error } = await supabase
    .from('mensajes_chat')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error al obtener mensajes anteriores:', error.message);
    return [];
  }

  return data.reverse(); // Mostrar los más antiguos arriba
}

/**
 * Cerrar el canal del chat
 */
export function cerrarChat() {
  if (canalChat) {
    supabase.removeChannel(canalChat);
    canalChat = null;
  }
}
