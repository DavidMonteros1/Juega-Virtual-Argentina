import { supabase } from './supabase.js';
import { getUsuarioActual } from './auth.js';



// ========================
// SUSCRIPCIONES REALTIME
// ========================

let mesasChannel = null;
let mesasUsuariosChannel = null;

// Suscribirse a cambios en la tabla de mesas
export function suscribirMesasRealtime(onChange) {
  if (mesasChannel) supabase.removeChannel(mesasChannel);
  mesasChannel = supabase
    .channel('mesas-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mesas' },
      payload => {
        console.log('[Realtime][mesas] Cambio detectado:', payload);
        if (onChange) onChange(payload);
      }
    )
    .subscribe();
  console.log('[Realtime][mesas] Suscripción activa');
}

// Suscribirse a cambios en la tabla de mesas_usuarios
export function suscribirMesasUsuariosRealtime(onChange) {
  if (mesasUsuariosChannel) supabase.removeChannel(mesasUsuariosChannel);
  mesasUsuariosChannel = supabase
    .channel('mesas-usuarios-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mesas_usuarios' },
      payload => {
        console.log('[Realtime][mesas_usuarios] Cambio detectado:', payload);
        if (onChange) onChange(payload);
      }
    )
    .subscribe();
  console.log('[Realtime][mesas_usuarios] Suscripción activa');
}

// ========================
// FUNCIONES PRINCIPALES
// ========================

// Obtener todas las mesas (abiertas y jugando)
export async function obtenerMesas() {
  const { data, error } = await supabase
    .from('mesas')
    .select(`
      id, nombre_mesa, fichas_apuesta, max_jugadores, estado, creador_id, 
      creador:usuarios(nombre_usuario),
      jugadores:mesas_usuarios(usuario_id, estado, resultado_manual, usuarios(nombre_usuario))
    `)
    .in('estado', ['abierta', 'jugando'])
    .order('creada_en', { ascending: false });

  if (error) {
    console.error('[obtenerMesas] Error:', error.message);
    return [];
  }
  // Filtrar solo jugadores activos (no los que salieron) para el lobby
  data.forEach(mesa => {
    mesa.jugadores = (mesa.jugadores || []).filter(j => j.estado !== 'salio');
  });
  console.log('[obtenerMesas] Mesas obtenidas:', data);
  return data;
}

// Crear una nueva mesa
export async function crearMesa(nombre_mesa, fichas_apuesta, max_jugadores) {
  const usuario = await getUsuarioActual();
  if (!usuario) {
    console.log('[crearMesa] Usuario no autenticado');
    return { error: 'No autenticado' };
  }
  if (usuario.fichas < fichas_apuesta) {
    console.log('[crearMesa] Fichas insuficientes');
    return { error: 'No tienes suficientes fichas para crear esta mesa.' };
  }

  // Crear la mesa
// Crear la mesa modificado 15/05 12:29
  const { data: mesa, error } = await supabase
    .from('mesas')
    .insert([{
      nombre_mesa,
      fichas_apuesta,
      max_jugadores,
      creador_id: usuario.id,
      estado: 'abierta',
    }])
    .select()
    .single();

  if (error) {
    console.error('[crearMesa] Error al crear la mesa:', error.message);
    return { error };
  }
  console.log('[crearMesa] Mesa creada:', mesa); // ultima original

  // nuevo codigo

// Registrar al creador como jugador en la mesa
const { error: errorUnirse } = await supabase
  .from('mesas_usuarios')
  .insert([{
    mesa_id: mesa.id,
    usuario_id: usuario.id,
    fichas_apostadas: fichas_apuesta,
    estado: 'esperando',
    resultado_manual: null,
    entro_en: new Date().toISOString(),
  }]);

if (errorUnirse) {
  console.error('[crearMesa] Error al unir al creador a la mesa:', errorUnirse.message);
  // Si falla, eliminar la mesa creada
  await supabase.from('mesas').delete().eq('id', mesa.id);
  return { error: 'No se pudo unir al creador a la mesa.' };
}

console.log('[crearMesa] Creador unido a la mesa:', usuario.nombre_usuario);
  // fin nuevo codigo 
  return { data: mesa };
}

// Unirse a una mesa (descuenta fichas siempre, incluido el creador)
export async function unirseAMesa(mesaId) {
  const usuario = await getUsuarioActual();
  if (!usuario) {
    console.log('[unirseAMesa] Usuario no autenticado');
    return { error: 'No autenticado' };
  }

  // Obtener info de la mesa y jugadores actuales
  const { data: mesa, error: errorMesa } = await supabase
    .from('mesas')
    .select('id, fichas_apuesta, max_jugadores, estado, jugadores:mesas_usuarios(usuario_id, estado)')
    .eq('id', mesaId)
    .single();

  if (errorMesa || !mesa) {
    console.log('[unirseAMesa] No se pudo obtener la mesa');
    return { error: 'No se pudo obtener la información de la mesa.' };
  }

  // Verificar si el usuario ya está registrado en la mesa 15/05 16:03
const jugadorExistente = mesa.jugadores.find(j => j.usuario_id === usuario.id);
if (jugadorExistente) {
  if (jugadorExistente.estado === 'esperando') {
    console.log('[unirseAMesa] Usuario ya está en la mesa con estado "esperando". Permitiendo reingreso.');
    return { success: true }; // Permitir reingreso si está en estado "esperando"
  } else {
    console.log('[unirseAMesa] Usuario ya está en la mesa con estado:', jugadorExistente.estado);
    return { error: 'No puedes ingresar porque ya diste una respuesta en esta mesa.' };
  }
}

  // Verificar el estado de la mesa
  if (mesa.estado !== 'abierta' && mesa.estado !== 'jugando') {
    console.log('[unirseAMesa] La mesa no está disponible');
    return { error: 'La mesa no está disponible.' };
  }

  // Solo contar jugadores activos para el cupo
  const jugadoresActivos = mesa.jugadores.filter(j => j.estado !== 'salio');
  if (jugadoresActivos.length >= mesa.max_jugadores) {
    console.log('[unirseAMesa] Mesa llena');
    return { error: 'La mesa está llena.' };
  }

  // Descontar fichas SIEMPRE al unirse (incluido el creador)
  if (usuario.fichas < mesa.fichas_apuesta) {
    console.log('[unirseAMesa] Fichas insuficientes');
    return { error: 'No tienes suficientes fichas para unirte.' };
  }
  const nuevasFichas = usuario.fichas - mesa.fichas_apuesta;
  const { error: errorFichas } = await supabase
    .from('usuarios')
    .update({ fichas: nuevasFichas })
    .eq('id', usuario.id);
  if (errorFichas) {
    console.log('[unirseAMesa] Error al descontar fichas:', errorFichas.message);
    return { error: 'No se pudo descontar fichas.' };
  }

  // Registrar movimiento de fichas
  await supabase.from('movimientos_fichas').insert([{
    usuario_id: usuario.id,
    cantidad: -mesa.fichas_apuesta,
    motivo: 'apuesta mesa',
    creado_en: new Date().toISOString()
  }]);

  // Unirse a la mesa
  const { error } = await supabase
    .from('mesas_usuarios')
    .insert([{
      mesa_id: mesaId,
      usuario_id: usuario.id,
      fichas_apostadas: mesa.fichas_apuesta,
      estado: 'esperando',
      resultado_manual: null,
      entro_en: new Date().toISOString()
    }]);
  if (error) {
    console.log('[unirseAMesa] Error al unirse:', error.message);
    return { error: 'No se pudo unir a la mesa.' };
  }
  console.log('[unirseAMesa] Usuario unido a la mesa:', usuario.nombre_usuario);

  // Si la mesa se llena (solo jugadores activos), pasar a estado "jugando"
  const { data: jugadores } = await supabase
    .from('mesas_usuarios')
    .select('usuario_id, estado')
    .eq('mesa_id', mesaId);
  const jugadoresActivosDespues = jugadores.filter(j => j.estado !== 'salio');
  if (jugadoresActivosDespues.length === mesa.max_jugadores) {
    await supabase.from('mesas').update({ estado: 'jugando' }).eq('id', mesaId);
    console.log('[unirseAMesa] Mesa llena, cambiando a estado "jugando"');
  }

  return { success: true };
}


// Obtener detalles de una mesa y sus jugadores
export async function obtenerDetallesMesa(mesaId) {
  const { data, error } = await supabase
    .from('mesas')
    .select(`
      id, nombre_mesa, fichas_apuesta, max_jugadores, estado, creador_id, 
      jugadores:mesas_usuarios(usuario_id, estado, resultado_manual, usuarios(nombre_usuario))
    `)
    .eq('id', mesaId)
    .single();

  if (error) {
    console.error('[obtenerDetallesMesa] Error:', error.message);
    throw new Error('No se pudo obtener los detalles de la mesa.');
  }
  console.log('[obtenerDetallesMesa] Detalles:', data);
  return data;
}

// Enviar resultado del jugador (gane, perdi, empate)
export async function enviarResultadoJugador(mesaId, resultado) {
  const usuario = await getUsuarioActual();
  if (!usuario) {
    console.log('[enviarResultadoJugador] Usuario no autenticado');
    return { error: 'No autenticado' };
  }

  // Validar que no haya más de un "gane"
  if (resultado === 'gane') {
    const { data: jugadores } = await supabase
      .from('mesas_usuarios')
      .select('resultado_manual')
      .eq('mesa_id', mesaId);
    if (jugadores && jugadores.some(j => j.resultado_manual === 'gane')) {
      console.log('[enviarResultadoJugador] Ya existe un ganador');
      return { error: 'Ya existe un ganador en esta mesa.' };
    }
  }

  // Actualizar resultado
  const { error } = await supabase
    .from('mesas_usuarios')
    .update({ resultado_manual: resultado })
    .eq('mesa_id', mesaId)
    .eq('usuario_id', usuario.id);

  if (error) {
    console.error('[enviarResultadoJugador] Error:', error.message);
    return { error: 'No se pudo enviar el resultado.' };
  }
  console.log(`[enviarResultadoJugador] Resultado "${resultado}" enviado por ${usuario.nombre_usuario}`);

  // Procesar lógica de cierre si todos enviaron resultado
  await procesarCierreMesaSiCorresponde(mesaId);

  return { success: true };
}

// Salir o abandonar una mesa (cuenta como "perdi", sin reintegro, EXCEPTO si el creador sale antes de que otro jugador entre)
export async function salirDeMesa(mesaId) {
  const usuario = await getUsuarioActual();
  if (!usuario) {
    console.log('[salirDeMesa] Usuario no autenticado');
    return { error: 'No autenticado' };
  }

  // Obtener info de la mesa y jugadores actuales
  const { data: mesa, error: errorMesa } = await supabase
    .from('mesas')
    .select('id, fichas_apuesta, creador_id, estado, jugadores:mesas_usuarios(usuario_id, estado)')
    .eq('id', mesaId)
    .single();

  if (errorMesa || !mesa) {
    console.error('[salirDeMesa] No se pudo obtener la mesa');
    return { error: 'No se pudo obtener la información de la mesa.' };
  }

  // Verificar si el usuario es el creador y es el único jugador activo en la mesa (nadie más entró)
  const jugadoresActivos = (mesa.jugadores || []).filter(j => j.estado !== 'salio');
  if (
    usuario.id === mesa.creador_id &&
    jugadoresActivos.length === 1 &&
    jugadoresActivos[0].usuario_id === usuario.id &&
    mesa.estado === 'abierta'
  ) {
    // Devolver fichas al creador
    const { data: user } = await supabase.from('usuarios').select('fichas').eq('id', usuario.id).single();
    const nuevasFichas = (user?.fichas || 0) + (mesa.fichas_apuesta || 0);
    await supabase.from('usuarios').update({ fichas: nuevasFichas }).eq('id', usuario.id);
    await supabase.from('movimientos_fichas').insert([{
      usuario_id: usuario.id,
      cantidad: mesa.fichas_apuesta,
      motivo: 'devolucion creador mesa',
      creado_en: new Date().toISOString()
    }]);
    // Eliminar la mesa y sus registros de mesas_usuarios
    await supabase.from('mesas_usuarios').delete().eq('mesa_id', mesaId);
    await supabase.from('mesas').delete().eq('id', mesaId);
    console.log('[salirDeMesa] Creador salió solo, mesa eliminada y fichas devueltas');
    return { success: true, devolucion: true };
  }

  // Caso normal: actualizar resultado a "perdi" y estado a "salio"
  const { error } = await supabase
    .from('mesas_usuarios')
    .update({ resultado_manual: 'perdi', estado: 'salio', salio_en: new Date().toISOString() })
    .eq('mesa_id', mesaId)
    .eq('usuario_id', usuario.id);

  if (error) {
    console.error('[salirDeMesa] Error:', error.message);
    return { error: 'No se pudo salir de la mesa.' };
  }
  console.log('[salirDeMesa] Usuario abandonó la mesa:', usuario.nombre_usuario);

  // Procesar lógica de cierre si todos enviaron resultado
  await procesarCierreMesaSiCorresponde(mesaId);

  return { success: true };
}

// Procesar cierre de mesa si todos los jugadores enviaron resultado
async function procesarCierreMesaSiCorresponde(mesaId) {
  // Obtener jugadores y sus resultados
  const { data: jugadores, error } = await supabase
    .from('mesas_usuarios')
    .select('usuario_id, resultado_manual, fichas_apostadas, estado')
    .eq('mesa_id', mesaId);

  if (error || !jugadores || jugadores.length === 0) {
    console.log('[procesarCierreMesaSiCorresponde] No hay jugadores');
    return;
  }

  // Solo considerar jugadores activos o que hayan salido
  const jugadoresValidos = jugadores.filter(j => ['esperando', 'jugando', 'salio'].includes(j.estado));
  if (jugadoresValidos.some(j => !j.resultado_manual)) {
    // Aún faltan resultados
    return;
  }

  // Lógica de cierre
  const hayGanador = jugadoresValidos.filter(j => j.resultado_manual === 'gane');
  const todosPerdi = jugadoresValidos.every(j => j.resultado_manual === 'perdi');
  const todosEmpate = jugadoresValidos.every(j => j.resultado_manual === 'empate');
  const mesaInfo = await supabase.from('mesas').select('*').eq('id', mesaId).single();
  const pozo = jugadoresValidos.length * (mesaInfo.data ? mesaInfo.data.fichas_apuesta : 0);

  if (hayGanador.length === 1) {
    // Un solo ganador: repartir pozo
    const ganadorId = hayGanador[0].usuario_id;
    // Obtener fichas actuales del ganador
    const { data: ganador } = await supabase.from('usuarios').select('fichas').eq('id', ganadorId).single();
    const nuevasFichas = (ganador?.fichas || 0) + pozo;
    await supabase.from('usuarios').update({ fichas: nuevasFichas }).eq('id', ganadorId);
    await supabase.from('movimientos_fichas').insert([{
      usuario_id: ganadorId,
      cantidad: pozo,
      motivo: 'premio mesa',
      creado_en: new Date().toISOString()
    }]);
    console.log(`[procesarCierreMesaSiCorresponde] Ganador: ${ganadorId}, pozo: ${pozo}`);
    await registrarHistorialMesa(mesaId, ganadorId, 'ganador');
  } else if (todosPerdi || todosEmpate) {
    // Empate o todos perdieron: reintegrar fichas
    for (const jugador of jugadoresValidos) {
      // Obtener fichas actuales del jugador
      const { data: user } = await supabase.from('usuarios').select('fichas').eq('id', jugador.usuario_id).single();
      const nuevasFichas = (user?.fichas || 0) + (jugador.fichas_apostadas || 0);
      await supabase.from('usuarios').update({ fichas: nuevasFichas }).eq('id', jugador.usuario_id);
      await supabase.from('movimientos_fichas').insert([{
        usuario_id: jugador.usuario_id,
        cantidad: jugador.fichas_apostadas,
        motivo: 'reintegro mesa',
        creado_en: new Date().toISOString()
      }]);
    }
    console.log('[procesarCierreMesaSiCorresponde] Empate o reintegro a todos');
    await registrarHistorialMesa(mesaId, null, 'empate');
  }

  // Cerrar la mesa y limpiar
  await supabase.from('mesas').update({ estado: 'cerrada', cerrada_en: new Date().toISOString() }).eq('id', mesaId);
  console.log('[procesarCierreMesaSiCorresponde] Mesa cerrada:', mesaId);

  // Opcional: eliminar registros de mesas_usuarios o marcarlos como finalizados
}

// Registrar historial de la mesa
async function registrarHistorialMesa(mesaId, ganadorId, resultado) {
  await supabase.from('historial_mesas').insert([{
    mesa_id: mesaId,
    ganador_id: ganadorId,
    resultado,
    creado_en: new Date().toISOString()
  }]);
  console.log('[registrarHistorialMesa] Historial registrado:', { mesaId, ganadorId, resultado });
}

