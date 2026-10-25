import { verificarSesion } from './session.js';
import { logout } from './auth.js';
import { supabase } from './supabase.js';

const moduleLinks = {
  slots: {
    title: 'Tragamonedas',
    description: 'Juega con apuestas y premios validados por el servidor.',
    href: 'juegos/tragamonedas/index.html',
  },
  lottery: {
    title: 'Lotería 15 de 25',
    description: 'Compra cartones y consulta tus premios del sorteo.',
    href: 'juegos/loteria/index.html',
  },
};

document.addEventListener('DOMContentLoaded', initializeLobby);

async function initializeLobby() {
  const userInfo = document.getElementById('user-info');
  const modulesContainer = document.getElementById('modules-container');
  const statusMessage = document.getElementById('lobby-status');
  const logoutButton = document.getElementById('logout-btn');

  logoutButton.addEventListener('click', async () => {
    try {
      await logout();
    } catch (error) {
      console.error('[lobby] No se pudo cerrar la sesión:', error);
      statusMessage.textContent = 'No se pudo cerrar la sesión. Inténtalo nuevamente.';
    }
  });

  try {
    let user = await verificarSesion();
    userInfo.textContent = `Bienvenido, ${user.username} | Fichas: ${user.balance_tokens}`;
    await showAdminLink(user.id);
    await markActivity();
    await loadAvailableModules(modulesContainer, statusMessage);

    window.addEventListener('focus', async () => {
      try {
        user = await verificarSesion();
        userInfo.textContent = `Bienvenido, ${user.username} | Fichas: ${user.balance_tokens}`;
      } catch (error) {
        console.error('[lobby] No se pudo actualizar el perfil:', error);
        statusMessage.textContent = 'No se pudo actualizar tu saldo. Recarga la página.';
      }
    });
  } catch (error) {
    console.error('[lobby] No se pudo iniciar el lobby:', error);
    if (error.message !== 'No hay una sesión activa.') {
      statusMessage.textContent = error.message?.includes('bloqueada por administración')
        ? error.message
        : 'No se pudo cargar la cuenta. Inténtalo nuevamente.';
    }
  }
}

async function showAdminLink(userId) {
  const { data, error } = await supabase
    .from('jva_user_roles')
    .select('role')
    .eq('user_id', userId);
  if (error) {
    throw error;
  }
  document.getElementById('admin-link').hidden = !data.length;
}

async function loadAvailableModules(container, statusMessage) {
  const { data, error } = await supabase.rpc('jva_get_public_config');
  if (error) {
    throw error;
  }

  container.replaceChildren();
  const games = new Map((data.games || []).map((game) => [game.key, game]));
  const modules = (data.modules || []).filter((module) => module.visible);
  let visibleCount = 0;

  modules.forEach((module) => {
    const link = moduleLinks[module.key];
    const game = games.get(module.key);
    if (!link || !game?.enabled) {
      return;
    }

    const card = document.createElement('article');
    card.className = 'mesa';
    const title = document.createElement('h2');
    title.textContent = link.title;
    const description = document.createElement('p');
    description.textContent = link.description;
    const playLink = document.createElement('a');
    playLink.href = link.href;
    playLink.textContent = 'Abrir juego';
    card.append(title, description, playLink);
    container.appendChild(card);
    visibleCount += 1;
  });

  statusMessage.textContent = visibleCount
    ? ''
    : 'No hay juegos habilitados todavía. La administración debe revisar y activar cada módulo.';
}

async function markActivity() {
  const { error } = await supabase.rpc('jva_ping_activity', {
    p_current_page: 'lobby',
  });
  if (error) {
    throw error;
  }
}
