import { supabase } from './supabase.js';


// Verifica si el usuario está autenticado y devuelve sus datos completos
export async function verificarSesion() {
  const usuario_id = localStorage.getItem('usuario_id');
  console.log('[session][verificarSesion] usuario_id en localStorage:', usuario_id);

  if (!usuario_id) {
    console.warn('[session][verificarSesion] No autenticado. Redirigiendo a login.');
    window.location.href = 'login.html';
    throw new Error('No autenticado');
  }

  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', usuario_id)
    .single();

  if (error || !usuario) {
    console.error('[session][verificarSesion] Usuario no encontrado o sesión inválida:', error);
    window.location.href = 'login.html';
    throw new Error('Usuario no encontrado o sesión inválida');
  }

  console.log('[session][verificarSesion] Usuario autenticado:', usuario.nombre_usuario, '| Fichas:', usuario.fichas);
  return usuario;
}
