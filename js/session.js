import { supabase } from './supabase.js';

/*
========================
AUTOEVALUACIÓN 1: LECTURA DE CONTEXTO
========================
- La verificación de sesión debe ser robusta y asíncrona.
- Debe devolver el usuario actualizado o redirigir a login si no hay sesión.
- Debe agregar logs detallados para depuración.
- No eliminar utilidades previas útiles.
========================
*/

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

/*
========================
AUTOEVALUACIÓN 2: REVISIÓN DE CÓDIGO
========================
- La función es asíncrona y robusta.
- Devuelve el usuario actualizado o redirige a login si no hay sesión.
- Agrega logs detallados para depuración.
- No elimina utilidades previas útiles.
========================
*/

/*
========================
AUTOEVALUACIÓN 3: COMPARACIÓN FINAL CON CONTEXTO
========================
- El código sigue la lógica y mecánicas del contexto-proyecto.md.
- No contradice el contexto ni omite funcionalidades clave.
- Todas las utilidades siguen presentes y operativas.
========================
*/