import { supabase } from './supabase.js';
import { getUsuarioActual } from './auth.js';
import { mostrarMensaje } from './util.js';

let canalChat = null;
let usuariosConectados = [];

/**
 * Inicializar el chat global y el panel de usuarios activos.
 * @param {string} paginaActual - Nombre de la página actual (e.g., 'lobby', 'mesa').
 */
export async function inicializarChatGlobal(paginaActual) {
  const usuario = await getUsuarioActual();
  if (!usuario) {
    mostrarMensaje('Debes iniciar sesión para usar el chat global.', 'error');
    return;
  }

  // Actualizar la actividad del usuario con la página actual
  actualizarActividadUsuario(paginaActual);

  // Configurar el canal de chat global
  inicializarCanalChat(usuario);

  // Cargar mensajes previos del chat
  await cargarMensajesPrevios();

  // Cargar usuarios conectados
  await cargarUsuariosConectados();

  // Escuchar cambios en usuarios conectados en tiempo real
  supabase
    .channel('usuarios-conectados')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'usuarios' },
      () => cargarUsuariosConectados()
    )
    .subscribe();
}


/**
 * Cargar mensajes previos del chat y renderizarlos.
 */
async function cargarMensajesPrevios() {
  const chatBox = document.getElementById('chat-box');
  if (!chatBox) {
    console.error('[ChatGlobal] Elemento del DOM no encontrado: #chat-box');
    return;
  }

  try {
    const mensajes = await obtenerMensajesAnteriores();
    if (mensajes.length === 0) {
      console.log('[ChatGlobal] No hay mensajes previos en el chat.');
      return;
    }

    mensajes.forEach((mensaje) => renderizarMensajeChat(mensaje));
    console.log('[ChatGlobal] Mensajes previos cargados:', mensajes);
  } catch (error) {
    console.error('[ChatGlobal] Error al cargar mensajes previos:', error);
  }
}







/**
 * Actualizar la actividad del usuario en la base de datos.
 * @param {string} paginaActual - Nombre de la página actual.
 */
async function actualizarActividadUsuario(paginaActual) {
  const usuario = await getUsuarioActual();
  if (!usuario) return;

  await supabase
    .from('usuarios')
    .update({
      ultima_actividad: new Date().toISOString(),
      pagina_actual: paginaActual,
    })
    .eq('id', usuario.id);
}

/**
 * Inicializar el canal de chat global.
 * @param {Object} usuario - Datos del usuario actual.
 */
function inicializarCanalChat(usuario) {
  const chatBox = document.getElementById('chat-box');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');

  if (!chatBox || !chatForm || !chatInput) {
    console.error('[ChatGlobal] Elementos del DOM no encontrados.');
    return;
  }

  // Escuchar nuevos mensajes en tiempo real
  canalChat = supabase
    .channel('chat_global')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mensajes_chat' },
      (payload) => {
        const mensaje = payload.new;
        renderizarMensajeChat(mensaje);
      }
    )
    .subscribe();

  // Enviar mensaje
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = chatInput.value.trim();
    if (!texto || texto.length > 200) return;

    const { error } = await supabase.from('mensajes_chat').insert([
      {
        usuario_id: usuario.id,
        nombre_usuario: usuario.nombre_usuario,
        mensaje: texto,
      },
    ]);

    if (error) {
      mostrarMensaje('Error al enviar mensaje.', 'error');
      return;
    }

    chatInput.value = '';
  });
}

/**
 * Cargar usuarios conectados y renderizar el panel.
 */
async function cargarUsuariosConectados() {
  const usuariosPanel = document.getElementById('usuarios-conectados-panel');
  if (!usuariosPanel) {
    console.error('[ChatGlobal] Elemento del DOM no encontrado: #usuarios-conectados-panel');
    return;
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('nombre_usuario, pagina_actual')
    .eq('conectado', true)
    .gte('ultima_actividad', new Date(Date.now() - 15 * 60 * 1000).toISOString());

  if (error) {
    console.error('[ChatGlobal] Error al cargar usuarios conectados:', error);
    return;
  }

  usuariosConectados = data;
  renderizarUsuariosConectados(usuariosPanel);
}

/**
 * Renderizar los usuarios conectados en el panel.
 * @param {HTMLElement} usuariosPanel - Contenedor del panel de usuarios conectados.
 */
function renderizarUsuariosConectados(usuariosPanel) {
  usuariosPanel.replaceChildren();
  usuariosConectados.forEach((usuario) => {
    const span = document.createElement('span');
    span.style.cursor = 'pointer';
    const username = document.createElement('b');
    username.textContent = usuario.nombre_usuario;
    span.append('🟢 ', username, ` (${usuario.pagina_actual || 'Desconocido'}) | `);
    usuariosPanel.appendChild(span);
  });
}

/**
 * Renderizar un mensaje en el chat.
 * @param {Object} mensaje - Datos del mensaje.
 */
function renderizarMensajeChat(mensaje) {
  const chatBox = document.getElementById('chat-box');
  if (!chatBox) return;

  const div = document.createElement('div');
  const time = document.createElement('span');
  time.style.color = '#888';
  time.textContent = `[${new Date(mensaje.creado_en).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })}]`;
  const username = document.createElement('b');
  username.textContent = `${mensaje.nombre_usuario}:`;
  const text = document.createElement('span');
  text.textContent = mensaje.mensaje;
  div.append(time, document.createTextNode(' '), username, document.createTextNode(' '), text);
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Obtener mensajes anteriores (últimos 50).
 */
export async function obtenerMensajesAnteriores() {
  const { data, error } = await supabase
    .from('mensajes_chat')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[ChatGlobal] Error al obtener mensajes anteriores:', error);
    return [];
  }

  return data.reverse(); // Mostrar los más antiguos arriba
}

/**
 * Cerrar el canal del chat.
 */
export function cerrarChat() {
  if (canalChat) {
    supabase.removeChannel(canalChat);
    canalChat = null;
  }
}