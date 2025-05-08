// Mostrar mensajes en pantalla
export function mostrarMensaje(mensaje, tipo = 'info') {
    const div = document.createElement('div');
    div.textContent = mensaje;
    div.className = `mensaje ${tipo}`;
    document.body.appendChild(div);
  
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
  