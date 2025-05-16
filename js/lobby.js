import { obtenerMesas, crearMesa, unirseAMesa, suscribirMesasRealtime, suscribirMesasUsuariosRealtime } from './mesas.js';
import { verificarSesion } from './session.js';
import { logout } from './auth.js';
import { supabase } from './supabase.js';
import { inicializarChatGlobal } from './chatGlobal.js'; // Nueva importación

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Lobby] Archivo lobby.js cargado correctamente.');

  let usuario = null;

  try {
    console.log('[Lobby] Verificando sesión del usuario...');
    usuario = await verificarSesion();

    if (!usuario) {
      manejarError('No se pudo obtener el usuario desde verificarSesion.');
      window.location.href = 'login.html';
      return;
    }

    // === INICIO CÓDIGO AGREGADO: DETECCIÓN DE ACTIVIDAD ===
    let actividadTimeoutUpdate = null;
    function actualizarUltimaActividad() {
      clearTimeout(actividadTimeoutUpdate);
      actividadTimeoutUpdate = setTimeout(async () => {
        // Usar el usuario ya obtenido para evitar múltiples llamadas
        if (usuario) {
          await supabase
            .from('usuarios')
            .update({ ultima_actividad: new Date().toISOString() })
            .eq('id', usuario.id);
        }
      }, 1000); // Actualiza como máximo 1 vez por segundo
    }
    ['click', 'keydown', 'mousemove', 'touchstart', 'focus'].forEach(evt =>
      window.addEventListener(evt, actualizarUltimaActividad)
    );
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) actualizarUltimaActividad();
    });
    // === FIN CÓDIGO AGREGADO ===

    console.log('[Lobby] Usuario obtenido desde verificarSesion:', usuario);

    const userInfo = document.getElementById('user-info');
    if (!userInfo) {
      console.error('[Lobby] Error: No se encontró el elemento #user-info en el DOM.');
      return;
    }

    userInfo.textContent = `Bienvenido, ${usuario.nombre_usuario} | Fichas: ${usuario.fichas}`;

    console.log('[Lobby] Cargando mesas disponibles...');
    await cargarMesas();

    // Suscribirse a cambios en tiempo real en la tabla de mesas
    suscribirMesasRealtime(async (payload) => {
      console.log('[Lobby][Realtime] Cambio detectado en la tabla mesas:', payload);
      await cargarMesas(); // Recargar la lista de mesas
    });

    // Configurar canal Realtime para escuchar cambios en las fichas del usuario
    supabase
      .channel('usuarios-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'usuarios', filter: `nombre_usuario=eq.${usuario.nombre_usuario}` },
        (payload) => {
          console.log('[Lobby][Realtime] Evento Realtime recibido para el usuario:', payload);

          if (payload.new) {
            const nuevasFichas = payload.new.fichas;
            userInfo.textContent = `Bienvenido, ${payload.new.nombre_usuario} | Fichas: ${nuevasFichas}`;
          } else {
            console.error('[Lobby][Realtime] Error: El payload del evento Realtime no contiene datos nuevos.');
          }
        }
      )
      .subscribe();

    console.log('[Lobby] Canales Realtime configurados correctamente.');
// inicio codigo utilizado
    document.getElementById('crear-mesa-btn').addEventListener('click', async () => {
      console.log('[Lobby] Botón "Crear Mesa" presionado.');
      const nombre = prompt("Nombre de la nueva mesa:");
      const apuesta = parseInt(prompt("Cantidad de fichas por jugador:"));
      const maxJugadores = parseInt(prompt("Máximo de jugadores en la mesa:"));

      console.log('[Lobby] Datos ingresados para crear mesa:', { nombre, apuesta, maxJugadores });

      if (nombre && apuesta > 0 && maxJugadores > 1) {
        const { data: mesa, error } = await crearMesa(nombre, apuesta, maxJugadores);
        if (error) {
          console.error('[Lobby] Error al crear la mesa:', error);
          alert(error);
        } else {
          console.log('[Lobby] Mesa creada correctamente:', mesa); 
          // Ya no es necesario unirse manualmente, el creador ya está registrado en la mesa
          alert('Mesa creada correctamente. Redirigiendo a la mesa...');
          window.location.href = `juegos/mesa.html?id=${mesa.id}`;
        }
      } else {
        console.warn('[Lobby] Datos inválidos para crear la mesa.');
        alert("Datos inválidos para crear la mesa.");
      }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
      console.log('[Lobby] Botón "Cerrar Sesión" presionado.');
      logout();
    });

    // Inicializar el chat global
    await inicializarChatGlobal('lobby'); // Nueva implementación del chat global

  } catch (error) {
    console.error('[Lobby] Error en la inicialización del lobby:', error.message);
    window.location.href = 'login.html';
  }
});

async function cargarMesas() {
  console.log('[Lobby] Iniciando carga de mesas...');
  const mesasContainer = document.getElementById('mesas-container');

  if (!mesasContainer) {
    console.error('[Lobby] Error: No se encontró el elemento #mesas-container en el DOM.');
    return;
  }

  mesasContainer.innerHTML = '';

  try {
    const mesas = await obtenerMesas();
    console.log('[Lobby] Mesas obtenidas desde la base de datos:', mesas);

    if (mesas.length === 0) {
      mesasContainer.innerHTML = '<p>No hay mesas disponibles.</p>';
      console.log('[Lobby] No hay mesas disponibles.');
      return;
    }

    mesas.forEach((mesa) => {
      const jugadoresActuales = mesa.jugadores ? mesa.jugadores.length : 0;

       // Obtener los nombres de los jugadores registrados
      const nombresJugadores = mesa.jugadores
        ? mesa.jugadores.map(j => j.usuarios.nombre_usuario).join(' | ')
        : 'esperando más jugadores...';
      //

      const div = document.createElement('div');
      div.className = 'mesa';

      div.innerHTML = `
        <strong>Nombre de mesa: ${mesa.nombre_mesa}</strong><br/>
        Creador: ${mesa.creador?.nombre_usuario || 'Desconocido'}<br/>
        Apuesta: ${mesa.fichas_apuesta} fichas<br/>
        Jugadores: ${jugadoresActuales}/${mesa.max_jugadores} | ${nombresJugadores}<br/>
        Estado: ${mesa.estado}<br/>
        <button data-id="${mesa.id}">Unirse</button>
      `;

      div.querySelector('button').addEventListener('click', async () => {
        console.log('[Lobby] Botón "Unirse" presionado para la mesa:', mesa.id);

        const { error } = await unirseAMesa(mesa.id);
        if (error) {
          manejarError('Error al unirse a la mesa.', error);
          alert(error);

          if (error === 'La mesa está llena.') {
            console.log('[Lobby] La mesa está llena. Recargando mesas...');
            cargarMesas(); // Actualizar el lobby si la mesa está llena
          }
        } else {
          console.log('[Lobby] Unido a la mesa correctamente:', mesa.id);
          alert('Te has unido a la mesa.');
          // Redirigir al usuario a la página de la mesa
          window.location.href = `juegos/mesa.html?id=${mesa.id}`;
        }
      });

      mesasContainer.appendChild(div);
    });
  } catch (error) {
    manejarError('Error al cargar las mesas.', error);
    mesasContainer.innerHTML = '<p>Error al cargar las mesas.</p>';
  }
}