import { obtenerMesas, crearMesa, unirseAMesa } from './mesas.js';
import { verificarSesion, logout } from './auth.js'; // Importamos logout desde auth.js
import { mostrarMensaje } from './util.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Verificar sesión del usuario
    const usuario = await verificarSesion();
    document.getElementById('nombreUsuario').textContent = usuario.nombre_usuario;

    // Cargar mesas disponibles
    await cargarMesas();

    // Manejar el formulario para crear una nueva mesa
    document.getElementById('formCrearMesa').addEventListener('submit', async (e) => {
      e.preventDefault();

      const nombre = document.getElementById('nombreMesa').value;
      const fichas = parseInt(document.getElementById('fichasApuesta').value);
      const max = parseInt(document.getElementById('maxJugadores').value);

      const { error } = await crearMesa(nombre, fichas, max);
      if (error) {
        mostrarMensaje('Error al crear la mesa: ' + error.message, 'error');
      } else {
        mostrarMensaje('Mesa creada correctamente', 'success');
        await cargarMesas();
        e.target.reset();
      }
    });

    // Manejar el botón de cerrar sesión
    document.getElementById('cerrarSesion').addEventListener('click', () => {
      logout(); // Llamamos a la función logout para cerrar sesión
    });
  } catch (error) {
    mostrarMensaje('Debe iniciar sesión', 'error');
    window.location.href = 'login.html';
  }
});

async function cargarMesas() {
  const lista = document.getElementById('listaMesas');
  lista.innerHTML = '';

  const mesas = await obtenerMesas();
  if (mesas.length === 0) {
    lista.innerHTML = '<p>No hay mesas disponibles.</p>';
    return;
  }

  mesas.forEach((mesa) => {
    const div = document.createElement('div');
    div.className = 'mesa';

    div.innerHTML = `
      <h3>${mesa.nombre_mesa}</h3>
      <p>Fichas: ${mesa.fichas_apuesta} | Máx. Jugadores: ${mesa.max_jugadores}</p>
      <button data-id="${mesa.id}">Unirse</button>
    `;

    div.querySelector('button').addEventListener('click', async () => {
      const { error } = await unirseAMesa(mesa.id);
      if (error) {
        mostrarMensaje('Error al unirse a la mesa', 'error');
      } else {
        window.location.href = `mesa.html?id=${mesa.id}`;
      }
    });

    lista.appendChild(div);
  });
}