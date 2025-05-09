import { obtenerMesas, crearMesa, unirseAMesa } from './mesas.js';
import { verificarSesion, logout } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const usuario = await verificarSesion();
    document.getElementById('nombreUsuario').textContent = usuario.nombre_usuario;

    cargarMesas();

    document.getElementById('crear-mesa-btn').addEventListener('click', async () => {
      const nombre = prompt("Nombre de la nueva mesa:");
      const apuesta = parseInt(prompt("Cantidad de fichas por jugador:"));
      const maxJugadores = parseInt(prompt("Máximo de jugadores en la mesa:"));

      if (nombre && apuesta > 0 && maxJugadores > 1) {
        const { data: mesa, error } = await crearMesa(nombre, apuesta, maxJugadores);
        if (error) {
          alert(error);
        } else {
          alert('Mesa creada correctamente.');
          cargarMesas(); // Actualizar el lobby
        }
      } else {
        alert("Datos inválidos para crear la mesa.");
      }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
      logout();
    });
  } catch (error) {
    console.error('Debe iniciar sesión:', error.message);
    window.location.href = 'login.html';
  }
});

async function cargarMesas() {
  const mesasContainer = document.getElementById('mesas-container');
  mesasContainer.innerHTML = '';

  try {
    const mesas = await obtenerMesas();
    if (mesas.length === 0) {
      mesasContainer.innerHTML = '<p>No hay mesas disponibles.</p>';
      return;
    }

    mesas.forEach((mesa) => {
      const jugadoresActuales = mesa.jugadores ? mesa.jugadores.length : 0;

      const div = document.createElement('div');
      div.className = 'mesa';

      div.innerHTML = `
        <strong>Nombre de mesa: ${mesa.nombre_mesa}</strong><br/>
        Creador: ${mesa.creador?.nombre_usuario || 'Desconocido'}<br/>
        Apuesta: ${mesa.fichas_apuesta} fichas<br/>
        Jugadores: ${jugadoresActuales}/${mesa.max_jugadores}<br/>
        Estado: ${mesa.estado}<br/>
        <button data-id="${mesa.id}">Unirse</button>
      `;

      div.querySelector('button').addEventListener('click', async () => {
        const { error } = await unirseAMesa(mesa.id);
        if (error) {
          alert(error);
          if (error === 'La mesa está llena.') {
            cargarMesas(); // Actualizar el lobby si la mesa está llena
          }
        } else {
          alert('Te has unido a la mesa.');
          cargarMesas(); // Actualizar el lobby después de unirse
        }
      });

      mesasContainer.appendChild(div);
    });
  } catch (error) {
    console.error('Error al cargar mesas:', error.message);
    mesasContainer.innerHTML = '<p>Error al cargar las mesas.</p>';
  }
}

// Actualizar el lobby dinámicamente cada 5 segundos
setInterval(cargarMesas, 5000);