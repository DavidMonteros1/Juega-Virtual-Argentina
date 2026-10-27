import { supabase } from '../../js/supabase.js';
import { getUsuarioActual } from '../../js/auth.js';

const symbols = ['🍒', '🍋', '🍇', '🍉', '🍊', '⭐'];
const reels = [
  document.getElementById('reel1'),
  document.getElementById('reel2'),
  document.getElementById('reel3'),
];
const resultText = document.getElementById('resultado');
const balanceText = document.getElementById('saldoActual');
const maximumPrizeText = document.getElementById('premioMaximo');
const prizePoolText = document.getElementById('pozoAcumulado');
const prizePoolStatus = document.getElementById('pool-status');
const playButton = document.getElementById('btnJugar');
const spinButtonLabel = playButton.querySelector('span:last-child');
const machine = document.querySelector('.slots-machine');
const stakeInput = document.getElementById('apuestaInput');
const betHint = document.getElementById('bet-hint');
const betDownButton = document.getElementById('bet-down');
const betUpButton = document.getElementById('bet-up');
let user = null;
let pendingPlay = readPendingPlay();
let currentPreview = null;
let isPlaying = false;
let minimumStake = 1;

const sounds = {
  jackpot: new Audio(new URL('../../assets/sounds/ganar.mp3', import.meta.url).href),
  pair: new Audio(new URL('../../assets/sounds/premio.mp3', import.meta.url).href),
  loss: new Audio(new URL('../../assets/sounds/perder.mp3', import.meta.url).href),
  spin: new Audio(new URL('../../assets/sounds/giro.mp3', import.meta.url).href),
};

document.addEventListener('DOMContentLoaded', initialize);
stakeInput.addEventListener('change', updatePrizePreview);
stakeInput.addEventListener('input', validateStakeInput);
playButton.addEventListener('click', play);
betDownButton.addEventListener('click', () => adjustStake(-1));
betUpButton.addEventListener('click', () => adjustStake(1));

async function initialize() {
  try {
    user = await getUsuarioActual();
    if (!user) {
      window.location.href = '../../login.html';
      return;
    }

    await refreshBalance();
    await loadSlotConfiguration();
    await updatePrizePreview();
  } catch (error) {
    console.error('[slots] No se pudo inicializar la tragamonedas:', error);
    resultText.textContent = 'No se pudo preparar la máquina. Actualiza la página e inténtalo otra vez.';
    prizePoolText.textContent = 'No disponible';
    prizePoolStatus.textContent = 'No se pudo consultar el pozo.';
    maximumPrizeText.textContent = 'No se pudo consultar el premio máximo.';
    playButton.disabled = true;
  }
}

async function loadSlotConfiguration() {
  const { data, error } = await supabase.rpc('jva_get_public_config');
  if (error) {
    throw error;
  }

  const game = data.games?.find((item) => item.key === 'slots');
  const houseShare = Number(game?.house_share_percent);
  if (!Number.isFinite(houseShare) || houseShare <= 0 || houseShare >= 100) {
    throw new Error('No se pudo leer la configuración de la tragamonedas.');
  }

  minimumStake = Math.ceil(100 / houseShare);
  stakeInput.min = String(minimumStake);
  betHint.textContent = `Apuesta mínima: ${formatTokens(minimumStake)} fichas`;
  if (Number(stakeInput.value) < minimumStake) {
    stakeInput.value = String(minimumStake);
  }
}

async function refreshBalance() {
  user = await getUsuarioActual();
  if (!user) {
    window.location.href = '../../login.html';
    throw new Error('La sesión finalizó. Inicia sesión otra vez.');
  }
  balanceText.textContent = `Saldo: ${formatTokens(user.balance_tokens)} fichas`;
}

async function updatePrizePreview() {
  const stake = Number(stakeInput.value);
  if (!Number.isSafeInteger(stake) || stake < minimumStake) {
    currentPreview = null;
    maximumPrizeText.textContent =
      `La apuesta mínima es de ${formatTokens(minimumStake)} fichas.`;
    playButton.disabled = true;
    return null;
  }

  const { data, error } = await supabase.rpc('jva_preview_slot_bet', {
    p_stake_tokens: stake,
  });
  if (error) {
    console.error('[slots] No se pudo consultar el fondo de premios:', error);
    currentPreview = null;
    maximumPrizeText.textContent = presentSlotError(error);
    prizePoolText.textContent = 'No disponible';
    prizePoolStatus.textContent = 'El pozo no pudo actualizarse.';
    playButton.disabled = true;
    return null;
  }

  if (!Number.isSafeInteger(Number(data.available_prize_pool_tokens))) {
    console.error('[slots] La vista previa no incluye el pozo acumulado. Aplica la migración 20261025210000_jva_slot_pool_preview.sql.');
    currentPreview = null;
    prizePoolText.textContent = 'No disponible';
    prizePoolStatus.textContent =
      'No se pueden iniciar jugadas hasta que se actualice la información del pozo.';
    maximumPrizeText.textContent = 'El pozo se está actualizando. Inténtalo más tarde.';
    playButton.disabled = true;
    return null;
  }

  currentPreview = data;
  const maximumPayout = formatTokens(data.maximum_total_payout_tokens);
  const poolAmount = Number(data.available_prize_pool_tokens);
  prizePoolText.textContent = formatTokens(poolAmount);
  prizePoolStatus.textContent = 'Fichas disponibles para cubrir premios';
  maximumPrizeText.textContent =
    `${maximumPayout} fichas con una apuesta de ${formatTokens(stake)} fichas`;
  validateStakeInput();
  playButton.disabled = isPlaying;
  return data;
}

function validateStakeInput() {
  const stake = Number(stakeInput.value);
  const isValid = Number.isSafeInteger(stake) && stake >= minimumStake;
  betHint.textContent = isValid
    ? `Apuesta mínima: ${formatTokens(minimumStake)} fichas`
    : `La apuesta mínima es de ${formatTokens(minimumStake)} fichas`;
  betHint.classList.toggle('invalid', !isValid);
  if (!isValid || currentPreview?.stake_tokens !== stake) {
    currentPreview = null;
    playButton.disabled = true;
  } else if (!isPlaying && prizePoolText.textContent !== 'No disponible') {
    playButton.disabled = !currentPreview;
  }
}

function adjustStake(amount) {
  const currentStake = Number(stakeInput.value);
  const nextStake = Number.isSafeInteger(currentStake) ? currentStake + amount : minimumStake;
  stakeInput.value = String(Math.max(minimumStake, nextStake));
  validateStakeInput();
  updatePrizePreview();
}

async function play() {
  const stake = Number(stakeInput.value);
  if (!Number.isSafeInteger(stake) || stake < minimumStake) {
    resultText.textContent = `La apuesta mínima es de ${formatTokens(minimumStake)} fichas.`;
    return;
  }

  isPlaying = true;
  playButton.disabled = true;
  spinButtonLabel.textContent = 'GIRANDO...';
  resultText.textContent = 'Confirmando la jugada...';
  try {
    if (pendingPlay && pendingPlay.userId !== user.id) {
      pendingPlay = null;
      sessionStorage.removeItem('jva.slots.pending-play');
    }
    if (!pendingPlay) {
      const preview = await updatePrizePreview();
      if (!preview) {
        return;
      }
      pendingPlay = {
        requestId: crypto.randomUUID(),
        userId: user.id,
        stake,
        maximumPayout: preview.maximum_total_payout_tokens,
      };
      sessionStorage.setItem('jva.slots.pending-play', JSON.stringify(pendingPlay));
    }

    const { data, error } = await supabase.rpc('jva_play_slots', {
      p_stake_tokens: pendingPlay.stake,
      p_request_id: pendingPlay.requestId,
      p_expected_maximum_payout: pendingPlay.maximumPayout,
    });
    if (error) {
      if (Number(error.status) >= 400) {
        pendingPlay = null;
        sessionStorage.removeItem('jva.slots.pending-play');
      }
      throw error;
    }

    pendingPlay = null;
    sessionStorage.removeItem('jva.slots.pending-play');
    await animateResult(data.outcome);
    const paid = Number(data.payout_tokens);
    if (data.outcome === 'jackpot') {
      resultText.textContent = `¡Jackpot! Se acreditaron ${paid} fichas.`;
      sounds.jackpot.play().catch((error) => console.warn('[slots] Sonido no disponible:', error));
    } else if (data.outcome === 'pair') {
      resultText.textContent = paid > 0
        ? `¡Ganaste! Se acreditaron ${paid} fichas.`
        : 'Dos iguales, pero esta configuración no asigna pago a ese resultado.';
      if (paid > 0) {
        sounds.pair.play().catch((error) => console.warn('[slots] Sonido no disponible:', error));
      }
    } else {
      resultText.textContent = 'No hubo premio en esta jugada.';
      sounds.loss.play().catch((error) => console.warn('[slots] Sonido no disponible:', error));
    }

    resultText.classList.toggle('win', paid > 0);
    resultText.classList.toggle('lose', paid === 0);
    await refreshBalance();
  } catch (error) {
    console.error('[slots] No se pudo completar la jugada:', error);
    resultText.textContent = presentSlotError(error);
  } finally {
    try {
      await updatePrizePreview();
    } catch (error) {
      console.error('[slots] No se pudo actualizar la vista previa:', error);
      maximumPrizeText.textContent = 'No se pudo actualizar el fondo de premios.';
      currentPreview = null;
    }
    isPlaying = false;
    machine.classList.remove('is-spinning');
    spinButtonLabel.textContent = 'GIRAR';
    playButton.disabled = !currentPreview;
  }
}

async function animateResult(outcome) {
  machine.classList.add('is-spinning');
  resultText.textContent = 'Girando...';
  resultText.classList.remove('win', 'lose');
  sounds.spin.currentTime = 0;
  sounds.spin.play().catch((error) => console.warn('[slots] Sonido no disponible:', error));

  for (let index = 0; index < 20; index += 1) {
    reels.forEach((reel) => {
      reel.textContent = randomSymbol();
    });
    await sleep(50 + index * 5);
  }

  sounds.spin.pause();
  sounds.spin.currentTime = 0;
  machine.classList.remove('is-spinning');
  const finalSymbols = getDisplaySymbols(outcome);
  reels.forEach((reel, index) => {
    reel.textContent = finalSymbols[index];
    reel.classList.toggle('win', outcome !== 'loss');
    reel.classList.toggle('lose', outcome === 'loss');
  });
}

function getDisplaySymbols(outcome) {
  const first = randomSymbol();
  if (outcome === 'jackpot') {
    return [first, first, first];
  }
  if (outcome === 'pair') {
    const otherSymbols = symbols.filter((symbol) => symbol !== first);
    return [first, first, otherSymbols[Math.floor(Math.random() * otherSymbols.length)]];
  }

  const distinctSymbols = [...symbols];
  for (let index = distinctSymbols.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [distinctSymbols[index], distinctSymbols[swapIndex]] =
      [distinctSymbols[swapIndex], distinctSymbols[index]];
  }
  return distinctSymbols.slice(0, 3);
}

function randomSymbol() {
  return symbols[Math.floor(Math.random() * symbols.length)];
}

function sleep(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function formatTokens(value) {
  return new Intl.NumberFormat('es-AR').format(value);
}

function presentSlotError(error) {
  const message = error?.message || '';
  if (message.includes('demasiado baja para aplicar la comisión')) {
    return `La apuesta mínima es de ${formatTokens(minimumStake)} fichas.`;
  }
  if (message.includes('La apuesta mínima es de')) {
    return message;
  }
  if (message.includes('No tienes suficientes fichas')) {
    return 'No tienes fichas suficientes para esa apuesta.';
  }
  if (message.includes('fondo de premios no puede respaldar')) {
    return 'El pozo no puede cubrir esta jugada. Prueba con una apuesta menor.';
  }
  if (message.includes('está pausada')) {
    return 'La tragamonedas está temporalmente fuera de servicio.';
  }
  return 'No se pudo completar la jugada. Inténtalo nuevamente.';
}

function readPendingPlay() {
  const storedPlay = sessionStorage.getItem('jva.slots.pending-play');
  if (!storedPlay) {
    return null;
  }
  try {
    const pending = JSON.parse(storedPlay);
    if (
      typeof pending.requestId === 'string'
      && typeof pending.userId === 'string'
      && Number.isSafeInteger(pending.stake)
      && Number.isSafeInteger(pending.maximumPayout)
    ) {
      return pending;
    }
  } catch (error) {
    console.warn('[slots] Se descartó una jugada pendiente inválida:', error);
  }
  sessionStorage.removeItem('jva.slots.pending-play');
  return null;
}
