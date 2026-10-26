import { verificarSesion } from './session.js';
import { logout } from './auth.js';
import { supabase } from './supabase.js';

const moduleLinks = {
  slots: {
    title: 'Tragamonedas',
    description: 'Probá tu suerte en cada giro. Apuestas y premios validados por el servidor.',
    href: 'juegos/tragamonedas/index.html',
    icon: '🎰',
    category: 'GIROS Y PREMIOS',
    action: 'Jugar ahora',
  },
  lottery: {
    title: 'Lotería 15 de 25',
    description: 'Elegí tus números, participá del sorteo y consultá tus premios.',
    href: 'juegos/loteria/index.html',
    icon: '🎟️',
    category: 'SORTEO EN VIVO',
    action: 'Ver lotería',
  },
  dice: {
    title: 'Dados',
    description: 'Elegí alto o bajo y resolvé cada jugada al instante.',
    href: 'juegos/dados/index.html',
    icon: '🎲',
    category: 'JUEGO RÁPIDO',
    action: 'Jugar a los dados',
  },
  mines: {
    title: 'Minas',
    description: 'Descubrí casillas seguras y retirate antes de encontrar una mina.',
    href: 'juegos/minas/index.html',
    icon: '💎',
    category: 'RIESGO Y PREMIO',
    action: 'Entrar a Minas',
  },
  crash: {
    title: 'Crash',
    description: 'Mirá crecer el multiplicador y cobrá antes de que la ronda caiga.',
    href: 'juegos/crash/index.html',
    icon: '🚀',
    category: 'TIEMPO REAL',
    action: 'Jugar Crash',
  },
  wheel: {
    title: 'Ruleta de premios',
    description: 'Girá la ruleta y descubrí qué multiplicador entrega el servidor.',
    href: 'juegos/ruleta/index.html',
    icon: '🎡',
    category: 'GIROS Y PREMIOS',
    action: 'Girar la ruleta',
  },
  jackpot: {
    title: 'Jackpot',
    description: 'Sumate al pozo compartido y participá del próximo sorteo.',
    href: 'juegos/jackpot/index.html',
    icon: '🏆',
    category: 'SORTEO COMPARTIDO',
    action: 'Ver Jackpot',
  },
};

const gameArtwork = {
  slots: new URL('../assets/img/games/opensource-slots-unsplash.jpg', import.meta.url).href,
  dice: new URL('../assets/img/games/brix-dice.png', import.meta.url).href,
  mines: new URL('../assets/img/games/brix-mines.png', import.meta.url).href,
  crash: new URL('../assets/img/games/brix-crash.png', import.meta.url).href,
  wheel: new URL('../assets/img/games/opensource-roulette-pexels.jpg', import.meta.url).href,
  jackpot: new URL('../assets/img/games/brix-jackpot.png', import.meta.url).href,
};
const lobbySound = new Audio(new URL('../assets/sounds/cling-caja.mp3', import.meta.url).href);
const lobbySoundToggle = document.getElementById('lobby-sound-toggle');
let lobbySoundsEnabled = false;

document.addEventListener('DOMContentLoaded', initializeLobby);
lobbySoundToggle.addEventListener('click', toggleLobbySounds);

function toggleLobbySounds() {
  lobbySoundsEnabled = !lobbySoundsEnabled;
  lobbySoundToggle.setAttribute('aria-pressed', String(lobbySoundsEnabled));
  lobbySoundToggle.setAttribute(
    'aria-label',
    lobbySoundsEnabled ? 'Desactivar sonidos de interfaz' : 'Activar sonidos de interfaz',
  );
  document.getElementById('lobby-sound-icon').textContent = lobbySoundsEnabled ? '♫' : '♪';
  document.getElementById('lobby-sound-label').textContent =
    lobbySoundsEnabled ? 'Sonido activo' : 'Sonido apagado';
  if (lobbySoundsEnabled) {
    playLobbySound();
  } else {
    lobbySound.pause();
    lobbySound.currentTime = 0;
  }
}

function playLobbySound() {
  if (!lobbySoundsEnabled || (!lobbySound.paused && !lobbySound.ended)) {
    return;
  }
  lobbySound.currentTime = 0;
  lobbySound.play().catch((error) => {
    console.warn('[lobby] No se pudo reproducir el sonido:', error);
  });
}

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
    updateUserSummary(user);
    await showAdminLink(user.id);
    await markActivity();
    await loadAvailableModules(modulesContainer, statusMessage);

    window.addEventListener('focus', async () => {
      try {
        user = await verificarSesion();
        updateUserSummary(user);
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

function updateUserSummary(user) {
  document.getElementById('username-info').textContent = user.username;
  document.getElementById('user-info').textContent = user.username;
  document.getElementById('balance-info').textContent =
    `${new Intl.NumberFormat('es-AR').format(user.balance_tokens)} fichas`;
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
  const activeGamesCount = document.getElementById('active-games-count');

  modules.forEach((module) => {
    const link = moduleLinks[module.key];
    const game = games.get(module.key);
    if (!link || !game?.enabled) {
      return;
    }

    const card = document.createElement('article');
    card.className = `game-card game-card--${module.key}`;
    card.style.setProperty('--card-index', String(visibleCount));
    const cardTop = document.createElement('div');
    cardTop.className = 'game-card-top';
    const category = document.createElement('span');
    category.className = 'game-card-category';
    category.textContent = link.category;
    const icon = document.createElement('span');
    icon.className = 'game-card-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = link.icon;
    cardTop.append(category, icon);

    const scene = document.createElement('div');
    scene.className = 'game-card-scene';
    scene.setAttribute('aria-hidden', 'true');
    const sceneOrbit = document.createElement('span');
    sceneOrbit.className = 'game-card-scene-orbit';
    const sceneSpark = document.createElement('span');
    sceneSpark.className = 'game-card-scene-spark';
    const artworkUrl = gameArtwork[module.key];
    if (artworkUrl) {
      const artwork = document.createElement('img');
      artwork.className = 'game-card-artwork';
      artwork.src = artworkUrl;
      artwork.alt = '';
      artwork.loading = 'lazy';
      artwork.decoding = 'async';
      scene.append(artwork, sceneOrbit, sceneSpark);
    } else {
      const sceneIcon = document.createElement('span');
      sceneIcon.className = 'game-card-scene-icon';
      sceneIcon.textContent = link.icon;
      scene.append(sceneOrbit, sceneSpark, sceneIcon);
    }

    const title = document.createElement('h3');
    title.textContent = link.title;
    title.className = 'game-card-title';
    const description = document.createElement('p');
    description.textContent = link.description;
    description.className = 'game-card-description';
    const playLink = document.createElement('a');
    playLink.href = link.href;
    playLink.className = 'game-card-link';
    playLink.addEventListener('pointerenter', playLobbySound);
    playLink.addEventListener('focus', playLobbySound);
    playLink.append(document.createTextNode(link.action));
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    playLink.appendChild(arrow);
    card.append(cardTop, scene, title, description, playLink);
    container.appendChild(card);
    visibleCount += 1;
  });

  activeGamesCount.textContent = String(visibleCount);
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
