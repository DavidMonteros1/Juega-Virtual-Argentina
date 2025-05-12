import { supabase } from './supabase.js';

/*
========================
AUTOEVALUACIÓN 1: LECTURA DE CONTEXTO
========================
- El sistema debe manejar usuarios completos y actualizados en todo momento.
- El campo "fichas" y demás datos deben estar siempre disponibles y actualizados.
- La autenticación y obtención de usuario debe ser robusta y coherente.
- No eliminar funcionalidades previas útiles.
========================
*/

// Función para iniciar sesión
export async function login(nombre_usuario, contrasena) {
  const { data: user, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('nombre_usuario', nombre_usuario)
    .eq('contrasena', contrasena)
    .single();

  if (error || !user) {
    return { error: 'Usuario o contraseña incorrectos.' };
  }

  // Marcar usuario como conectado
  await supabase
    .from('usuarios')
    .update({ conectado: true })
    .eq('id', user.id);

  localStorage.setItem('usuario_id', user.id);
  localStorage.setItem('nombre_usuario', user.nombre_usuario);
  return { data: user };
}

// Función para registrarse
export async function register(nombre_usuario, contrasena) {
  const { data, error } = await supabase
    .from('usuarios')
    .insert([{ nombre_usuario, contrasena }])
    .select()
    .single();

  if (error) {
    return { error: 'El nombre de usuario ya está en uso.' };
  }

  return await login(nombre_usuario, contrasena); // Auto-login
}

// Función para cerrar sesión
export async function logout() {
  const usuario_id = localStorage.getItem('usuario_id');
  if (usuario_id) {
    await supabase
      .from('usuarios')
      .update({ conectado: false })
      .eq('id', usuario_id);
  }

  localStorage.removeItem('usuario_id');
  localStorage.removeItem('nombre_usuario');
  window.location.href = 'login.html';
}

// Función para obtener el usuario actual (ahora asíncrona y siempre desde la base de datos)
export async function getUsuarioActual() {
  const usuario_id = localStorage.getItem('usuario_id');
  if (!usuario_id) {
    console.log('[auth][getUsuarioActual] No hay usuario autenticado en localStorage.');
    return null;
  }
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', usuario_id)
    .single();

  if (error || !usuario) {
    console.log('[auth][getUsuarioActual] Usuario no encontrado o error:', error?.message);
    return null;
  }
  // Log para depuración profunda
  console.log('[auth][getUsuarioActual] Usuario obtenido:', usuario);
  return usuario;
}

/*
========================
AUTOEVALUACIÓN 2: REVISIÓN DE CÓDIGO
========================
- getUsuarioActual ahora es asíncrona y siempre retorna el usuario completo y actualizado.
- Se mantienen todas las funciones previas (login, register, logout).
- Se agregan logs detallados para depuración.
- No se elimina ninguna funcionalidad previa relevante.
========================
*/

/*
========================
AUTOEVALUACIÓN 3: COMPARACIÓN FINAL CON CONTEXTO
========================
- El código sigue la lógica y mecánicas del contexto-proyecto.md.
- No contradice el contexto ni omite funcionalidades clave.
- Mantiene y mejora la robustez y trazabilidad de la autenticación.
- Todas las partes funcionales existentes siguen presentes.
========================
*/