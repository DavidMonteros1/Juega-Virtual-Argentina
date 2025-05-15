// Mostrar mensajes en pantalla
export function mostrarMensaje(mensaje, tipo = 'info') {
  // Elimina mensajes previos
  document.querySelectorAll('.mensaje').forEach(el => el.remove());

  // Crear el contenedor de mensaje
  const div = document.createElement('div');
  div.textContent = mensaje;
  div.className = `mensaje ${tipo}`;

  // Opcional: icono según tipo
  let icon = '';
  if (tipo === 'error') icon = '❌ ';
  else if (tipo === 'success') icon = '✅ ';
  else if (tipo === 'info') icon = 'ℹ️ ';
  div.textContent = icon + mensaje;

  // Insertar en el DOM (puede personalizarse el contenedor)
  document.body.appendChild(div);

  // Log detallado para depuración
  console.log(`[util][mostrarMensaje] (${tipo}): ${mensaje}`);

  setTimeout(() => {
    div.remove();
  }, 3000);
}

// Obtener parámetros de la URL
export function getQueryParam(nombre) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(nombre);
}

// Formatear fecha
export function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleString();
}

/**
 * Manejar errores de forma centralizada
 * @param {string} mensajeUsuario - Mensaje que se mostrará al usuario (opcional)
 * @param {Error|string} error - Detalles del error (opcional)
 */
export function manejarError(mensajeUsuario, error) {
  if (error) {
    console.error('[Error]', error);
  }
  if (mensajeUsuario) {
    mostrarMensaje(mensajeUsuario, 'error');
  }
}

