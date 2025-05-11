import { obtenerMesas, crearMesa, unirseAMesa } from './mesas.js';
import { verificarSesion, logout } from './auth.js';
import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM completamente cargado. Iniciando lobby.js...');

  try {
    console.log('Verificando sesión del usuario...');
    const usuario = await verificarSesion();

    if (!usuario) {
      console.error('Error: No se pudo obtener el usuario desde verificarSesion.');
      window.location.href = 'login.html';
      return;
    }

    console.log('Usuario obtenido desde verificarSesion:', usuario);

    const userInfo = document.getElementById('user-info');
    if (!userInfo) {
      console.error('Error: No se encontró el elemento #user-info en el DOM.');
      return;
    }

    console.log('Elemento #user-info encontrado en el DOM.');
    userInfo.textContent = `Bienvenido, ${usuario.nombre_usuario} | Fichas: ${usuario.fichas}`;

    console.log('Cargando mesas disponibles...');
    await cargarMesas();

    console.log('Configurando canal Realtime para mesas...');
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

    console.log('Configurando canal Realtime para las fichas del usuario...');
    console.log('UUID del usuario:', usuario.id);

    supabase
      .channel('usuarios-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'usuarios', filter: `id=eq.${usuario.id}` },
        (payload) => {
          console.log('Evento Realtime recibido para el usuario:', payload);

          if (payload.new) {
            const nuevasFichas = payload.new.fichas;
            console.log('Nuevas fichas obtenidas del evento Realtime:', nuevasFichas);

            userInfo.textContent = `Bienvenido, ${usuario.nombre_usuario} | Fichas: ${nuevasFichas}`;
          } else {
            console.error('Error: El payload del evento Realtime no contiene datos nuevos.');
          }
        }
      )
      .subscribe();

    console.log('Canales Realtime configurados correctamente.');

    document.getElementById('crear-mesa-btn').addEventListener('click', async () => {
      console.log('Botón "Crear Mesa" presionado.');
      const nombre = prompt("Nombre de la nueva mesa:");
      const apuesta = parseInt(prompt("Cantidad de fichas por jugador:"));
      const maxJugadores = parseInt(prompt("Máximo de jugadores en la mesa:"));

      console.log('Datos ingresados para crear mesa:', { nombre, apuesta, maxJugadores });

      if (nombre && apuesta > 0 && maxJugadores > 1) {
        const { data: mesa, error } = await crearMesa(nombre, apuesta, maxJugadores);
        if (error) {
          console.error('Error al crear la mesa:', error);
          alert(error);
        } else {
          console.log('Mesa creada correctamente:', mesa);
          alert('Mesa creada correctamente.');
        }
      } else {
        console.warn('Datos inválidos para crear la mesa.');
        alert("Datos inválidos para crear la mesa.");
      }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
      console.log('Botón "Cerrar Sesión" presionado.');
      logout();
    });
  } catch (error) {
    console.error('Error en la inicialización del lobby:', error.message);
    window.location.href = 'login.html';
  }
});

async function cargarMesas() {
  console.log('Iniciando carga de mesas...');
  const mesasContainer = document.getElementById('mesas-container');

  if (!mesasContainer) {
    console.error('Error: No se encontró el elemento #mesas-container en el DOM.');
    return;
  }

  mesasContainer.innerHTML = '';

  try {
    const mesas = await obtenerMesas();
    console.log('Mesas obtenidas desde la base de datos:', mesas);

    if (mesas.length === 0) {
      mesasContainer.innerHTML = '<p>No hay mesas disponibles.</p>';
      console.log('No hay mesas disponibles.');
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
        console.log('Botón "Unirse" presionado para la mesa:', mesa.id);

        const { error } = await unirseAMesa(mesa.id);
        if (error) {
          console.error('Error al unirse a la mesa:', error);
          alert(error);

          if (error === 'La mesa está llena.') {
            console.log('La mesa está llena. Recargando mesas...');
            cargarMesas(); // Actualizar el lobby si la mesa está llena
          }
        } else {
          console.log('Unido a la mesa correctamente:', mesa.id);
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