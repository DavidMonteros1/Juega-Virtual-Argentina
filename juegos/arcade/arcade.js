import { getUsuarioActual } from '../../js/auth.js';
import { supabase } from '../../js/supabase.js';

const gameKey = document.body.dataset.gameKey;
const balanceText = document.getElementById('arcade-balance');
const poolText = document.getElementById('arcade-pool');
const poolNote = document.getElementById('arcade-pool-note');
const statusText = document.getElementById('arcade-status');
const resultText = document.getElementById('arcade-result');
const stakeInput = document.getElementById('arcade-stake');
const betHint = document.getElementById('arcade-bet-hint');
const maximumPayoutText = document.getElementById('arcade-max-payout');
const gameView = (name) => document.querySelector(`[data-game-view="${name}"]`);
const gameAction = (name) =>
  document.querySelector(`[data-game-view="${gameKey}"] [data-action="${name}"]`);
const formatter = new Intl.NumberFormat('es-AR');
let user = null;
let gameStatus = null;
let minimumStake = 1;
let currentChoice = 'low';
let activeRound = null;
let busy = false;
let crashPoll = null;
let crashPollInFlight = false;
let crashChartPoints = [];
let stopInstantAnimation = () => {};

const gameSounds = {
  roll: new Audio(new URL('../../assets/sounds/giro-plastico.mp3', import.meta.url).href),
  win: new Audio(new URL('../../assets/sounds/ganar.mp3', import.meta.url).href),
  loss: new Audio(new URL('../../assets/sounds/perder.mp3', import.meta.url).href),
  reveal: new Audio(new URL('../../assets/sounds/cling-caja.mp3', import.meta.url).href),
  entry: new Audio(new URL('../../assets/sounds/opensource-carddrop-pixabay.mp3', import.meta.url).href),
};
const gameArtwork = {
  dice: new URL('../../assets/img/games/brix-dice.png', import.meta.url).href,
  mines: new URL('../../assets/img/games/brix-mines.png', import.meta.url).href,
  crash: new URL('../../assets/img/games/brix-crash.png', import.meta.url).href,
  wheel: new URL('../../assets/img/games/brix-wheel.png', import.meta.url).href,
  jackpot: new URL('../../assets/img/games/brix-jackpot.png', import.meta.url).href,
};

document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
  try {
    user = await getUsuarioActual();
    if (!user) {
      window.location.href = '../../login.html';
      return;
    }
    prepareGameVisuals();
    showGameView();
    await refreshBalance();

    if (gameKey === 'jackpot') {
      await refreshJackpotStatus();
      gameAction('join-jackpot')?.addEventListener('click', joinJackpot);
      return;
    }

    await refreshGameStatus();
    stakeInput.addEventListener('input', updatePayoutPreview);
    gameAction('instant')?.addEventListener('click', playInstant);
    gameAction('start-round')?.addEventListener('click', startRound);
    gameAction('cashout-round')?.addEventListener('click', () => playRoundAction('cashout'));
    document.getElementById('mines-board')?.addEventListener('click', (event) => {
      const cell = event.target.closest('[data-cell]');
      if (cell && !cell.disabled) {
        playRoundAction('reveal', Number(cell.dataset.cell));
      }
    });
    document.getElementById('dice-choice')?.addEventListener('click', selectDiceChoice);
    if (gameKey === 'mines' || gameKey === 'crash') {
      await refreshActiveRound();
    } else {
      updatePayoutPreview();
    }
  } catch (error) {
    console.error(`[arcade:${gameKey}] No se pudo iniciar el juego:`, error);
    statusText.textContent = error.message || 'No se pudo preparar el juego. Inténtalo de nuevo.';
    disableGameActions(true);
  }
}

function prepareGameVisuals() {
  const artworkUrl = gameArtwork[gameKey];
  if (artworkUrl) {
    const stage = document.querySelector('.arcade-stage');
    const artwork = document.createElement('img');
    artwork.className = 'arcade-artwork';
    artwork.src = artworkUrl;
    artwork.alt = '';
    artwork.setAttribute('aria-hidden', 'true');
    artwork.decoding = 'async';
    stage.prepend(artwork);
  }

  if (gameKey === 'dice') {
    const actions = gameView('dice');
    const display = document.createElement('div');
    display.className = 'dice-arena';
    display.setAttribute('aria-hidden', 'true');
    display.innerHTML =
      '<span class="dice-face">⚄</span><span id="dice-roll-value" class="dice-roll-value">?</span>';
    actions.insertBefore(display, actions.querySelector('[data-action="instant"]'));
  }

  if (gameKey === 'crash') {
    const actions = gameView('crash');
    const chart = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chart.setAttribute('class', 'crash-chart');
    chart.setAttribute('viewBox', '0 0 100 52');
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', 'Gráfico de crecimiento del multiplicador');
    chart.innerHTML =
      '<defs><linearGradient id="crash-fill" x1="0" x2="0" y1="0" y2="1">' +
      '<stop offset="0%" stop-color="currentColor" stop-opacity=".35"/>' +
      '<stop offset="100%" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>' +
      '<path class="crash-chart-area"></path><path class="crash-chart-line"></path>' +
      '<text class="crash-rocket" x="5" y="46">🚀</text>';
    actions.insertBefore(chart, document.getElementById('crash-multiplier'));
  }
}

function showGameView() {
  document.querySelectorAll('[data-game-view]').forEach((element) => {
    const visible = element.dataset.gameView.split(',').includes(gameKey);
    element.hidden = !visible;
  });
}

async function refreshBalance() {
  user = await getUsuarioActual();
  if (!user) {
    window.location.href = '../../login.html';
    throw new Error('La sesión finalizó. Inicia sesión otra vez.');
  }
  balanceText.textContent = `Saldo: ${formatTokens(user.balance_tokens)} fichas`;
}

async function refreshGameStatus() {
  const { data, error } = await supabase.rpc('jva_get_arcade_status', {
    p_game_key: gameKey,
  });
  if (error) {
    throw error;
  }
  gameStatus = data;
  if (!data.enabled) {
    statusText.textContent = 'Este juego está pausado por la administración.';
    disableGameActions(true);
    return;
  }
  minimumStake = Number(data.minimum_stake_tokens);
  stakeInput.min = String(minimumStake);
  betHint.textContent = `Apuesta mínima: ${formatTokens(minimumStake)} fichas`;
  if (Number(stakeInput.value) < minimumStake) {
    stakeInput.value = String(minimumStake);
  }
  poolText.textContent = formatTokens(data.available_prize_pool_tokens);
  poolNote.textContent = 'Fichas disponibles para cubrir premios';
  statusText.textContent = 'Elige tu apuesta. El resultado se confirma en el servidor.';
  updatePayoutPreview();
}

async function refreshJackpotStatus() {
  const { data, error } = await supabase.rpc('jva_get_jackpot_status');
  if (error) {
    throw error;
  }
  poolText.textContent = formatTokens(data.prize_pool_tokens);
  poolNote.textContent = 'Pozo acumulado para el ganador del sorteo';
  const entryPrice = Number(data.entry_price_tokens);
  const minimumEntryPrice = Number(data.minimum_entry_price_tokens);
  const drawInfo = document.getElementById('jackpot-draw-info');
  const entryInfo = document.getElementById('jackpot-entry-info');
  const joinButton = gameAction('join-jackpot');
  if (!data.enabled) {
    drawInfo.textContent = 'El Jackpot está pausado por la administración.';
    entryInfo.textContent = '';
    joinButton.disabled = true;
    return data;
  }
  if (!data.draw_id) {
    drawInfo.textContent = 'El organizador todavía no abrió el próximo sorteo.';
    entryInfo.textContent =
      `Entrada: ${formatTokens(entryPrice)} fichas. El sorteo se abre manualmente desde administración.`;
    joinButton.disabled = true;
    return data;
  }
  const entries = Number(data.entries_count);
  drawInfo.textContent =
    `Sorteo #${data.draw_number} abierto · ${formatTokens(entries)} entradas en total · ` +
    `tu cuenta tiene ${formatTokens(data.my_entries_count)}.`;
  entryInfo.textContent =
    `Cada entrada cuesta ${formatTokens(entryPrice)} fichas. ` +
    (entryPrice < minimumEntryPrice
      ? `El mínimo para cubrir la comisión es ${formatTokens(minimumEntryPrice)} fichas. `
      : '') +
    `El intervalo previsto es de ${formatTokens(data.draw_interval_hours)} horas; ` +
    'la apertura y el sorteo los realiza administración.';
  joinButton.disabled = busy || !data.enabled || user.balance_tokens < entryPrice;
  statusText.textContent = user.balance_tokens < entryPrice
    ? `Necesitas ${formatTokens(entryPrice)} fichas para comprar una entrada.`
    : 'El sorteo está abierto. Puedes comprar una entrada.';
  return data;
}

function updatePayoutPreview() {
  if (!gameStatus?.enabled) {
    return;
  }
  const stake = Number(stakeInput.value);
  if (!Number.isSafeInteger(stake) || stake < minimumStake || stake > 1000000) {
    maximumPayoutText.textContent = `La apuesta mínima es de ${formatTokens(minimumStake)} fichas.`;
    gameAction('instant') && (gameAction('instant').disabled = true);
    gameAction('start-round') && (gameAction('start-round').disabled = true);
    return;
  }
  const commission = Math.floor(stake * Number(gameStatus.house_share_percent) / 100);
  const contribution = stake - commission;
  const maximumMultiplier = getMaximumMultiplier();
  const theoreticalMaximum = Math.floor(stake * maximumMultiplier);
  const coveredMaximum = Math.min(
    theoreticalMaximum,
    Number(gameStatus.available_prize_pool_tokens) + contribution,
  );
  maximumPayoutText.textContent =
    `Premio máximo estimado: ${formatTokens(coveredMaximum)} fichas. ` +
    'La cifra final depende del pozo disponible al confirmar.';
  const button = gameAction('instant') || gameAction('start-round');
  if (button) {
    button.disabled = busy || coveredMaximum <= 0 || user.balance_tokens < stake;
  }
  betHint.textContent = user.balance_tokens < stake
    ? `Tu saldo actual es de ${formatTokens(user.balance_tokens)} fichas.`
    : `Apuesta mínima: ${formatTokens(minimumStake)} fichas`;
}

function getMaximumMultiplier() {
  const settings = gameStatus.settings;
  if (gameKey === 'dice') {
    return Number(settings.win_multiplier);
  }
  if (gameKey === 'mines' || gameKey === 'crash') {
    return Number(settings.max_multiplier);
  }
  return Math.max(...settings.multipliers.map(Number));
}

function selectDiceChoice(event) {
  const button = event.target.closest('[data-choice]');
  if (!button || busy) {
    return;
  }
  currentChoice = button.dataset.choice;
  document.querySelectorAll('[data-choice]').forEach((option) => {
    option.setAttribute('aria-pressed', String(option === button));
  });
}

async function playInstant() {
  if (busy || !gameStatus?.enabled) {
    return;
  }
  const stake = Number(stakeInput.value);
  if (!Number.isSafeInteger(stake) || stake < minimumStake || stake > 1000000) {
    statusText.textContent = `La apuesta mínima es de ${formatTokens(minimumStake)} fichas.`;
    return;
  }
  const pendingKey = `jva.arcade.pending-play:${gameKey}:${user.id}`;
  const requestedChoice = gameKey === 'dice' ? currentChoice : 'spin';
  let pending = readPending(pendingKey);
  if (pending && (pending.stake !== stake || pending.choice !== requestedChoice)) {
    statusText.textContent =
      'Hay una jugada pendiente de respuesta. Reintenta con la misma apuesta y opción.';
    stakeInput.value = String(pending.stake);
    currentChoice = pending.choice;
    updatePayoutPreview();
    return;
  }
  if (!pending) {
    pending = {
      requestId: crypto.randomUUID(),
      stake,
      choice: gameKey === 'dice' ? currentChoice : 'spin',
    };
    sessionStorage.setItem(pendingKey, JSON.stringify(pending));
  }
  busy = true;
  updatePayoutPreview();
  statusText.textContent = 'Confirmando tu jugada...';
  const button = gameAction('instant');
  const wheel = document.querySelector('.arcade-wheel');
  stopInstantAnimation = startInstantAnimation(wheel);
  button.disabled = true;
  try {
    const { data, error } = await supabase.rpc('jva_play_instant_arcade', {
      p_game_key: gameKey,
      p_stake_tokens: pending.stake,
      p_choice: pending.choice,
      p_request_id: pending.requestId,
    });
    if (error) {
      if (Number(error.status) >= 400) {
        sessionStorage.removeItem(pendingKey);
      }
      throw error;
    }
    sessionStorage.removeItem(pendingKey);
    await finishInstantAnimation(data, wheel);
    const payout = Number(data.payout_tokens || 0);
    const multiplier = Number(data.multiplier || 0);
    resultText.classList.toggle('arcade-result--win', payout > 0);
    resultText.classList.toggle('arcade-result--loss', payout <= 0);
    const resultDetails = gameKey === 'dice'
      ? `Resultado del dado: ${data.roll}. `
      : `Segmento ${data.segment}. `;
    resultText.textContent = payout > 0
      ? `${resultDetails}¡Ganaste ${formatTokens(payout)} fichas` +
        `${multiplier ? ` (${multiplier.toFixed(2)}×)` : ''}!`
      : `${resultDetails}Esta vez no hubo premio. Probá de nuevo cuando quieras.`;
    statusText.textContent = payout > 0 ? 'Premio acreditado en tu saldo.' : 'Jugada finalizada.';
    playGameSound(payout > 0 ? 'win' : 'loss');
    await refreshAfterCommittedAction();
  } catch (error) {
    console.error(`[arcade:${gameKey}] No se pudo completar la jugada:`, error);
    statusText.textContent = error.message || 'No se pudo confirmar la jugada. Puedes reintentar.';
  } finally {
    busy = false;
    stopInstantAnimation();
    updatePayoutPreview();
  }
}

function startInstantAnimation(wheel) {
  const diceFace = document.querySelector('.dice-face');
  const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  if (gameKey === 'dice') {
    document.getElementById('dice-roll-value').textContent = '...';
  }
  if (wheel) {
    wheel.style.transform = '';
    wheel.classList.add('is-spinning');
  }
  playGameSound('roll');
  const interval = gameKey === 'dice'
    ? window.setInterval(() => {
      diceFace.textContent = diceFaces[Math.floor(Math.random() * diceFaces.length)];
    }, 90)
    : null;
  return () => {
    if (interval !== null) {
      window.clearInterval(interval);
    }
    wheel?.classList.remove('is-spinning');
  };
}

async function finishInstantAnimation(data, wheel) {
  stopInstantAnimation();
  if (gameKey === 'dice') {
    const diceFace = document.querySelector('.dice-face');
    const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    diceFace.textContent = diceFaces[Math.floor(Math.random() * diceFaces.length)];
    await wait(450);
    document.getElementById('dice-roll-value').textContent = String(data.roll);
  }
  if (wheel) {
    const segmentCount = Number(gameStatus.settings.multipliers.length);
    const segment = Number(data.segment);
    const position = ((segment - 1) % segmentCount) * (360 / segmentCount);
    wheel.style.transform = `rotate(${1440 - position}deg)`;
    wheel.querySelector('span').textContent = `${Number(data.multiplier || 0).toFixed(2)}×`;
    await wait(900);
  }
}

function playGameSound(soundName) {
  const sound = gameSounds[soundName];
  if (!sound) {
    return;
  }
  sound.currentTime = 0;
  sound.play().catch((error) => {
    console.warn(`[arcade:${gameKey}] No se pudo reproducir el sonido:`, error);
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function startRound() {
  if (busy || activeRound || !gameStatus?.enabled) {
    return;
  }
  const stake = Number(stakeInput.value);
  if (!Number.isSafeInteger(stake) || stake < minimumStake || stake > 1000000) {
    statusText.textContent = `La apuesta mínima es de ${formatTokens(minimumStake)} fichas.`;
    return;
  }
  const pendingKey = `jva.arcade.pending-start:${gameKey}:${user.id}`;
  let pending = readPending(pendingKey);
  if (pending && pending.stake !== stake) {
    statusText.textContent =
      'Hay una partida pendiente de confirmar. Reintenta con la misma apuesta.';
    stakeInput.value = String(pending.stake);
    updatePayoutPreview();
    return;
  }
  if (!pending) {
    pending = { requestId: crypto.randomUUID(), stake };
    sessionStorage.setItem(pendingKey, JSON.stringify(pending));
  }
  busy = true;
  updatePayoutPreview();
  statusText.textContent = 'Preparando la partida...';
  try {
    const { data, error } = await supabase.rpc('jva_start_arcade_round', {
      p_game_key: gameKey,
      p_stake_tokens: pending.stake,
      p_request_id: pending.requestId,
    });
    if (error) {
      if (Number(error.status) >= 400) {
        sessionStorage.removeItem(pendingKey);
      }
      throw error;
    }
    sessionStorage.removeItem(pendingKey);
    crashChartPoints = [];
    drawCrashChart(1);
    resultText.classList.remove('arcade-result--win', 'arcade-result--loss');
    resultText.textContent =
      `Partida iniciada. Premio máximo reservado: ` +
      `${formatTokens(data.maximum_payout_tokens)} fichas.`;
    applyRoundState(data);
    await refreshAfterCommittedAction();
  } catch (error) {
    console.error(`[arcade:${gameKey}] No se pudo iniciar la partida:`, error);
    statusText.textContent = error.message || 'No se pudo iniciar la partida. Puedes reintentar.';
    try {
      await refreshActiveRound();
      if (activeRound) {
        resultText.textContent =
          `Partida recuperada. Premio máximo reservado: ` +
          `${formatTokens(activeRound.maximum_payout_tokens)} fichas.`;
      }
    } catch (recoveryError) {
      console.error(`[arcade:${gameKey}] No se pudo recuperar la partida activa:`, recoveryError);
      statusText.textContent =
        'No se pudo confirmar ni recuperar la partida. Recarga la página antes de volver a intentarlo.';
    }
  } finally {
    busy = false;
    updateRoundControls();
  }
}

async function refreshActiveRound() {
  const { data, error } = await supabase.rpc('jva_get_my_arcade_round', {
    p_game_key: gameKey,
  });
  if (error) {
    throw error;
  }
  if (data) {
    applyRoundState(data);
    sessionStorage.removeItem(`jva.arcade.pending-start:${gameKey}:${user.id}`);
  } else {
    activeRound = null;
    renderMineBoard(null);
    updateRoundControls();
  }
}

async function playRoundAction(action, cell = null) {
  if (busy || !activeRound) {
    return;
  }
  const round = activeRound;
  const pendingKey = `jva.arcade.pending-action:${gameKey}:${user.id}:${round.round_id}`;
  let pending = readPending(pendingKey);
  if (pending && (pending.action !== action || pending.cell !== cell)) {
    statusText.textContent = 'Reintentando la acción anterior para confirmar el resultado...';
  } else if (!pending) {
    pending = { requestId: crypto.randomUUID(), action, cell, roundId: round.round_id };
    sessionStorage.setItem(pendingKey, JSON.stringify(pending));
  }
  busy = true;
  updateRoundControls();
  statusText.textContent = 'Confirmando la acción...';
  try {
    const { data, error } = await supabase.rpc('jva_play_arcade_action', {
      p_round_id: pending.roundId,
      p_action: pending.action,
      p_cell: pending.cell,
      p_request_id: pending.requestId,
    });
    if (error) {
      if (Number(error.status) >= 400) {
        sessionStorage.removeItem(pendingKey);
      }
      throw error;
    }
    sessionStorage.removeItem(pendingKey);
    if (data.status === 'active' && data.hit_mine === false) {
      resultText.classList.add('arcade-result--win');
      resultText.classList.remove('arcade-result--loss');
      playGameSound('reveal');
      resultText.textContent =
        `Casilla segura. Si cobras ahora, recibes ${formatTokens(data.cashout_tokens)} fichas.`;
    } else if (data.status === 'cashed_out') {
      resultText.classList.add('arcade-result--win');
      resultText.classList.remove('arcade-result--loss');
      playGameSound('win');
      resultText.textContent = `Premio acreditado: ${formatTokens(data.payout_tokens)} fichas.`;
    } else if (data.status === 'crashed') {
      resultText.classList.add('arcade-result--loss');
      resultText.classList.remove('arcade-result--win');
      playGameSound('loss');
      resultText.textContent =
        `La ronda cayó en ${Number(data.crash_multiplier).toFixed(2)}×. La apuesta se perdió.`;
    } else if (data.status === 'lost') {
      resultText.classList.add('arcade-result--loss');
      resultText.classList.remove('arcade-result--win');
      playGameSound('loss');
      resultText.textContent = 'Encontraste una mina. La apuesta de esta partida se perdió.';
    } else if (data.status === 'expired') {
      resultText.textContent = 'La partida venció y se cerró sin premio.';
    }
    applyRoundState(data);
    if (data.status !== 'active') {
      await refreshAfterCommittedAction();
    }
  } catch (error) {
    console.error(`[arcade:${gameKey}] No se pudo confirmar la acción:`, error);
    statusText.textContent = error.message || 'No se pudo confirmar la acción. Puedes reintentar.';
  } finally {
    busy = false;
    updateRoundControls();
  }
}

function applyRoundState(data) {
  if (data.status === 'active') {
    activeRound = data;
    statusText.textContent = gameKey === 'crash'
      ? 'La ronda está en marcha. Cobra antes de que caiga.'
      : 'Descubre casillas seguras y cobra cuando quieras.';
    if (gameKey === 'mines') {
      renderMineBoard(data);
    } else {
      renderCrashMultiplier(data.current_multiplier);
      startCrashPolling();
    }
    if (data.status === 'crashed' || data.status === 'lost' || data.status === 'expired') {
      resultText.classList.add('arcade-result--loss');
      resultText.classList.remove('arcade-result--win');
    } else if (data.status === 'cashed_out') {
      resultText.classList.add('arcade-result--win');
      resultText.classList.remove('arcade-result--loss');
    }
  } else {
    activeRound = null;
    stopCrashPolling();
    if (gameKey === 'mines') {
      renderMineBoard(data);
    } else if (data.crash_multiplier) {
      renderCrashMultiplier(data.crash_multiplier);
    }
    if (data.status === 'crashed') {
      resultText.textContent =
        `La ronda cayó en ${Number(data.crash_multiplier).toFixed(2)}×. La apuesta se perdió.`;
    } else if (data.status === 'lost') {
      resultText.textContent = 'Encontraste una mina. La apuesta de esta partida se perdió.';
    } else if (data.status === 'cashed_out') {
      resultText.textContent = `Premio acreditado: ${formatTokens(data.payout_tokens)} fichas.`;
    } else if (data.status === 'expired') {
      resultText.textContent = 'La partida venció y se cerró sin premio.';
    }
    if (data.status) {
      statusText.textContent = 'La partida terminó.';
    }
  }
  updateRoundControls();
}

function renderMineBoard(round) {
  const board = document.getElementById('mines-board');
  if (!board) {
    return;
  }
  const roundId = round?.round_id || 'idle';
  if (board.dataset.roundId !== roundId) {
    board.replaceChildren();
    board.dataset.roundId = roundId;
  }
  const revealed = new Set(round?.revealed || []);
  const mines = new Set(round?.mine_positions || []);
  for (let cell = 0; cell < 25; cell += 1) {
    let button = board.children[cell];
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'mine-cell';
      button.dataset.cell = String(cell);
      button.style.setProperty('--cell-index', String(cell));
      board.appendChild(button);
    }
    const isMine = mines.has(cell);
    const isRevealed = revealed.has(cell);
    button.textContent = isMine ? '✹' : isRevealed ? '◆' : '·';
    button.setAttribute(
      'aria-label',
      isMine ? `Mina ${cell + 1}` : isRevealed ? `Casilla segura ${cell + 1}` : `Descubrir casilla ${cell + 1}`,
    );
    button.classList.toggle('mine-cell--mine', isMine);
    button.classList.toggle('mine-cell--safe', isRevealed && !isMine);
    button.disabled = !activeRound || isRevealed || busy;
  }
}

function renderCrashMultiplier(value) {
  const multiplier = Number(value);
  const safeMultiplier = Number.isFinite(multiplier) ? multiplier : 1;
  document.getElementById('crash-multiplier').textContent = `${safeMultiplier.toFixed(2)}×`;
  crashChartPoints.push(safeMultiplier);
  if (crashChartPoints.length > 32) {
    crashChartPoints.shift();
  }
  drawCrashChart(safeMultiplier);
}

function drawCrashChart(multiplier) {
  const chart = document.querySelector('.crash-chart');
  if (!chart) {
    return;
  }
  const points = crashChartPoints.length ? crashChartPoints : [multiplier];
  const maxValue = Math.max(2, ...points);
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? 5 : 5 + (index / (points.length - 1)) * 90;
    const y = 46 - (Math.log(Math.max(point, 1)) / Math.log(maxValue)) * 38;
    return [x, y];
  });
  const path = coordinates.map(([x, y], index) =>
    `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  chart.querySelector('.crash-chart-line').setAttribute('d', path);
  chart.querySelector('.crash-chart-area').setAttribute('d', `${path} L 95 50 L 5 50 Z`);
  const rocket = chart.querySelector('.crash-rocket');
  const [rocketX, rocketY] = coordinates[coordinates.length - 1];
  rocket.setAttribute('x', String(Math.max(5, rocketX - 3)));
  rocket.setAttribute('y', String(Math.max(10, rocketY + 5)));
}

function startCrashPolling() {
  if (gameKey !== 'crash' || crashPoll) {
    return;
  }
  crashPoll = window.setInterval(async () => {
    if (crashPollInFlight || busy) {
      return;
    }
    crashPollInFlight = true;
    try {
      const { data, error } = await supabase.rpc('jva_get_my_arcade_round', {
        p_game_key: 'crash',
      });
      if (error) {
        throw error;
      }
      if (data) {
        applyRoundState(data);
        if (data.status !== 'active') {
          resultText.textContent = data.status === 'crashed'
            ? `La ronda cayó en ${Number(data.crash_multiplier).toFixed(2)}×. La apuesta se perdió.`
            : 'La partida terminó sin premio.';
          await refreshAfterCommittedAction();
        }
      } else if (activeRound) {
        activeRound = null;
        stopCrashPolling();
        statusText.textContent = 'La partida venció y se cerró.';
        await refreshBalance();
        updateRoundControls();
      }
    } catch (error) {
      console.error('[arcade:crash] No se pudo actualizar la ronda:', error);
      statusText.textContent = 'No se pudo actualizar Crash. Intentando reconectar...';
    } finally {
      crashPollInFlight = false;
    }
  }, 1000);
}

function stopCrashPolling() {
  if (crashPoll) {
    window.clearInterval(crashPoll);
    crashPoll = null;
  }
}

function updateRoundControls() {
  const startButton = gameAction('start-round');
  const cashoutButton = gameAction('cashout-round');
  if (startButton) {
    startButton.hidden = Boolean(activeRound);
    startButton.disabled = busy || !gameStatus?.enabled;
  }
  if (cashoutButton) {
    cashoutButton.hidden = !activeRound;
    cashoutButton.disabled = busy;
  }
  if (stakeInput) {
    stakeInput.disabled = Boolean(activeRound) || busy;
  }
  if (gameKey === 'mines') {
    renderMineBoard(activeRound);
  }
  if (!activeRound && stakeInput) {
    updatePayoutPreview();
  }
}

async function joinJackpot() {
  if (busy) {
    return;
  }
  const button = gameAction('join-jackpot');
  const pendingKey = `jva.jackpot.pending-entry:${user.id}`;
  let pending = readPending(pendingKey);
  let confirmedEntry = null;
  if (!pending) {
    pending = { requestId: crypto.randomUUID() };
    sessionStorage.setItem(pendingKey, JSON.stringify(pending));
  }
  busy = true;
  button.disabled = true;
  statusText.textContent = 'Registrando tu entrada...';
  let entryConfirmed = false;
  try {
    const { data, error } = await supabase.rpc('jva_join_jackpot', {
      p_request_id: pending.requestId,
    });
    if (error) {
      if (Number(error.status) >= 400) {
        sessionStorage.removeItem(pendingKey);
      }
      throw error;
    }
    sessionStorage.removeItem(pendingKey);
    entryConfirmed = true;
    confirmedEntry = data;
    resultText.classList.add('arcade-result--win');
    resultText.classList.remove('arcade-result--loss');
    playGameSound('entry');
    resultText.textContent =
      `Entrada confirmada para el sorteo #${data.draw_number}. ` +
      `Pozo actual: ${formatTokens(data.prize_pool_tokens)} fichas.`;
    statusText.textContent = 'Tu entrada quedó registrada.';
    await refreshAfterCommittedAction();
  } catch (error) {
    console.error('[arcade:jackpot] No se pudo registrar la entrada:', error);
    statusText.textContent = error.message || 'No se pudo comprar la entrada. Puedes reintentar.';
  } finally {
    busy = false;
  }
  if (entryConfirmed) {
    try {
      const latestStatus = await refreshJackpotStatus();
      resultText.textContent =
        `Entrada confirmada para el sorteo #${latestStatus.draw_number || confirmedEntry.draw_number}. ` +
        `Pozo consultado: ${formatTokens(latestStatus.prize_pool_tokens)} fichas.`;
    } catch (error) {
      console.error('[arcade:jackpot] La entrada quedó registrada, pero no se pudo actualizar el estado:', error);
      statusText.textContent =
        'Tu entrada quedó registrada, pero no se pudo actualizar el pozo. Recarga la página para verificarlo.';
      button.disabled = false;
    }
  } else {
    button.disabled = false;
  }
}

function disableGameActions(disabled) {
  document.querySelectorAll('.arcade-stage button').forEach((button) => {
    button.disabled = disabled;
  });
}

async function refreshAfterCommittedAction() {
  try {
    await refreshBalance();
    if (gameKey !== 'jackpot') {
      await refreshGameStatus();
    }
  } catch (error) {
    console.error(`[arcade:${gameKey}] La acción se registró, pero no se pudo actualizar la pantalla:`, error);
    statusText.textContent =
      'La jugada se registró, pero no se pudo actualizar el saldo. Recarga la página para verificarlo.';
  }
}

function readPending(key) {
  const stored = sessionStorage.getItem(key);
  if (!stored) {
    return null;
  }
  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error('[arcade] Se descartó una solicitud local incompleta:', error);
    sessionStorage.removeItem(key);
    return null;
  }
}

function formatTokens(amount) {
  return formatter.format(Number(amount || 0));
}
