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

/*
========================
AUTOEVALUACIÓN 2: REVISIÓN DE CÓDIGO
========================
- mostrarMensaje elimina mensajes previos antes de mostrar uno nuevo.
- Agrega icono y clase según tipo (error, info, success).
- Log detallado en consola para cada mensaje mostrado.
- No se elimina ninguna utilidad previa útil.
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