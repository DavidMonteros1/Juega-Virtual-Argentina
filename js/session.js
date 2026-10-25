import { getUsuarioActual } from './auth.js';

export async function verificarSesion() {
  const usuario = await getUsuarioActual();
  if (!usuario) {
    window.location.href = 'login.html';
    throw new Error('No hay una sesión activa.');
  }
  return usuario;
}
