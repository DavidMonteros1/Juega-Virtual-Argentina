import { obtenerMesas, crearMesa, unirseAMesa } from './mesas.js';
import { verificarSesion, logout } from './auth.js';
import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const usuario = await verificarSesion();
    const userInfo = document.getElementById('user-info');
    userInfo.textContent = `Bienvenido, ${usuario.nombre_usuario} | Fichas: ${usuario.fichas}`;

    cargarMesas();

    // Configurar canal de escucha para actualizaciones en tiempo real de las mesas
    supabase
      .channel('mesas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mesas' },
        (payload) => {
          console.log('Cambio detectado en mesas:', payload);
          cargarMesas(); // Actualizar las mesas dinámicamente
        }
      )
      .subscribe();

    // Configurar canal de escucha para actualizaciones en tiempo real de las fichas del usuario
    supabase
      .channel('usuarios-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'usuarios', filter: `id=eq.${usuario.id}` },
        (payload) => {
          const nuevasFichas = payload.new.fichas; // Obtener el nuevo valor de las fichas
          userInfo.textContent = `Bienvenido, ${usuario.nombre_usuario} | Fichas: ${nuevasFichas}`;
          console.log('Fichas actualizadas en tiempo real:', nuevasFichas);
        }
      )
      .subscribe();

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
          // Redirigir al usuario a la página de la mesa
          window.location.href = `juegos/mesa.html?id=${mesa.id}`;
        }
      });

      mesasContainer.appendChild(div);
    });
  } catch (error) {
    console.error('Error al cargar mesas:', error.message);
    mesasContainer.innerHTML = '<p>Error al cargar las mesas.</p>';
  }
}