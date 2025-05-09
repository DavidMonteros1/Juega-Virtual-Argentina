// js/session.js
import { supabase } from './supabase.js';

// Verifica si el usuario está autenticado y devuelve sus datos completos
export async function verificarSesion() {
  const usuario_id = localStorage.getItem('usuario_id');

  if (!usuario_id) {
    window.location.href = 'login.html';
    throw new Error('No autenticado');
  }

  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', usuario_id)
    .single();

  if (error || !usuario) {
    window.location.href = 'login.html';
    throw new Error('Usuario no encontrado o sesión inválida');
  }

  return usuario;
}
