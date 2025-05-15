import { supabase } from './supabase.js';
import { manejarError } from './util.js';

// Función para iniciar sesión
export async function login(nombre_usuario, contrasena) {
  const { data: user, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('nombre_usuario', nombre_usuario)
    .eq('contrasena', contrasena)
    .single();

  if (error || !user) {
    manejarError('Usuario o contraseña incorrectos.', error);
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
    manejarError('El nombre de usuario ya está en uso.', error);
    return { error: 'El nombre de usuario ya está en uso.' };
  }

  return await login(nombre_usuario, contrasena); // Auto-login
}

// Función para cerrar sesión
export async function logout() {
  const usuario_id = localStorage.getItem('usuario_id');
  if (usuario_id) {
    try {
      await supabase
        .from('usuarios')
        .update({ conectado: false })
        .eq('id', usuario_id);
    } catch (error) {
      manejarError('Error al cerrar sesión.', error);
    }
  }

  localStorage.removeItem('usuario_id');
  localStorage.removeItem('nombre_usuario');
  window.location.href = 'login.html';
}

// Función para obtener el usuario actual (ahora asíncrona y siempre desde la base de datos)
export async function getUsuarioActual() {
  const usuario_id = localStorage.getItem('usuario_id');
  if (!usuario_id) {
    manejarError('No hay usuario autenticado en localStorage.');
    return null;
  }
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', usuario_id)
    .single();

  if (error || !usuario) {
    manejarError('Usuario no encontrado o sesión inválida.', error);
    return null;
  }
  // Log para depuración profunda
  console.log('[auth][getUsuarioActual] Usuario obtenido:', usuario);
  return usuario;
}