// js/auth.js
import { supabase } from './supabase.js';

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

// Función para verificar si el usuario está logueado
export function verificarSesion() {
  const usuario_id = localStorage.getItem('usuario_id');
  if (!usuario_id) {
    window.location.href = 'login.html';
  }
}

// ✅ Función faltante: obtener usuario actual (corregido)
export async function getUsuarioActual() {
  const usuario_id = localStorage.getItem('usuario_id');
  if (!usuario_id) return null;

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', usuario_id)
    .single();

  if (error) {
    console.error('Error al obtener usuario actual:', error.message);
    return null;
  }

  return data;
}
