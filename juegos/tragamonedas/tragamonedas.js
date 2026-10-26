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
const playButton = document.getElementById('btnJugar');
const stakeInput = document.getElementById('apuestaInput');
let user = null;
let pendingPlay = readPendingPlay();
let currentPreview = null;
let isPlaying = false;

const sounds = {
  jackpot: new Audio('../../assets/sounds/ganar.mp3'),
  pair: new Audio('../../assets/sounds/premio.mp3'),
  loss: new Audio('../../assets/sounds/perder.mp3'),
  spin: new Audio('../../assets/sounds/giro.mp3'),
};

document.addEventListener('DOMContentLoaded', initialize);
stakeInput.addEventListener('change', updatePrizePreview);
playButton.addEventListener('click', play);

async function initialize() {
  try {
    user = await getUsuarioActual();
    if (!user) {
      window.location.href = '../../login.html';
      return;
    }

    await refreshBalance();
    await updatePrizePreview();
  } catch (error) {
    console.error('[slots] No se pudo inicializar la tragamonedas:', error);
    resultText.textContent = 'No se pudo cargar la tragamonedas. Inténtalo nuevamente.';
    maximumPrizeText.textContent = error.message;
  }
}

async function refreshBalance() {
  user = await getUsuarioActual();
  if (!user) {
    window.location.href = '../../login.html';
    throw new Error('La sesión finalizó. Inicia sesión otra vez.');
  }
  balanceText.textContent = `Saldo: ${user.balance_tokens} fichas`;
}

async function updatePrizePreview() {
  const stake = Number(stakeInput.value);
  if (!Number.isSafeInteger(stake) || stake <= 0) {
    currentPreview = null;
    maximumPrizeText.textContent = 'Ingresa una apuesta válida para consultar el premio máximo.';
    playButton.disabled = true;
    return null;
  }

  const { data, error } = await supabase.rpc('jva_preview_slot_bet', {
    p_stake_tokens: stake,
  });
  if (error) {
    console.error('[slots] No se pudo consultar el fondo de premios:', error);
    currentPreview = null;
    maximumPrizeText.textContent = error.message;
    playButton.disabled = true;
    return null;
  }

  currentPreview = data;
  const maximumPayout = formatTokens(data.maximum_total_payout_tokens);
  const poolAmount = Number(data.available_prize_pool_tokens);
  maximumPrizeText.textContent = Number.isSafeInteger(poolAmount)
    ? `Pozo acumulado disponible: ${formatTokens(poolAmount)} fichas. ` +
      `Premio máximo posible con esta apuesta de ${formatTokens(stake)} fichas: ` +
      `${maximumPayout} fichas. El premio máximo depende de tu apuesta y del pozo.`
    : `Premio máximo posible con esta apuesta de ${formatTokens(stake)} fichas: ` +
      `${maximumPayout} fichas. El pozo acumulado todavía no está disponible; ` +
      `avisa al organizador para actualizar la base de datos.`;
  playButton.disabled = isPlaying;
  return data;
}

async function play() {
  const stake = Number(stakeInput.value);
  if (!Number.isSafeInteger(stake) || stake <= 0) {
    resultText.textContent = 'Ingresa una apuesta válida.';
    return;
  }

  isPlaying = true;
  playButton.disabled = true;
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
    resultText.textContent = error.message || 'No se pudo completar la jugada.';
  } finally {
    try {
      await updatePrizePreview();
    } catch (error) {
      console.error('[slots] No se pudo actualizar la vista previa:', error);
      maximumPrizeText.textContent = 'No se pudo actualizar el fondo de premios.';
      currentPreview = null;
    }
    isPlaying = false;
    playButton.disabled = !currentPreview;
  }
}

async function animateResult(outcome) {
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
