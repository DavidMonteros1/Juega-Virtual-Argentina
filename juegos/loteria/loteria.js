import { supabase } from '../../js/supabase.js';
import { getUsuarioActual } from '../../js/auth.js';

const status = document.getElementById('lottery-status');
const drawInfo = document.getElementById('draw-info');
const previewContainer = document.getElementById('prize-preview');
const ticketResult = document.getElementById('ticket-result');
const historyContainer = document.getElementById('ticket-history');
const buyButton = document.getElementById('buy-ticket');
const accountInfo = document.getElementById('account-info');
const lotterySounds = {
  ticket: new Audio(new URL('../../assets/sounds/premio-simple.mp3', import.meta.url).href),
  prize: new Audio(new URL('../../assets/sounds/ganar.mp3', import.meta.url).href),
};
let user = null;
let currentPreview = null;
let pendingSale = readPendingSale();

document.addEventListener('DOMContentLoaded', initialize);
buyButton.addEventListener('click', buyTicket);

async function initialize() {
  try {
    user = await getUsuarioActual();
    if (!user) {
      window.location.href = '../../login.html';
      return;
    }

    await refreshAccount();
    await refreshPreview();
    await refreshHistory();
    await markActivity();
  } catch (error) {
    console.error('[lottery] No se pudo cargar la lotería:', error);
    status.textContent = error.message || 'No se pudo cargar la lotería.';
  }
}

async function refreshAccount() {
  user = await getUsuarioActual();
  if (!user) {
    window.location.href = '../../login.html';
    throw new Error('La sesión finalizó. Inicia sesión otra vez.');
  }
  accountInfo.textContent = `Fichas disponibles: ${formatTokens(user.balance_tokens)}`;
}

async function refreshPreview() {
  buyButton.disabled = true;
  currentPreview = null;
  const { data, error } = await supabase.rpc('jva_preview_lottery_ticket');
  if (error) {
    console.error('[lottery] No se pudo consultar el sorteo y el pozo:', error);
    drawInfo.textContent = '';
    previewContainer.replaceChildren();
    status.textContent = error.message;
    return;
  }

  currentPreview = data;
  status.textContent = '';
  drawInfo.textContent =
    `Sorteo #${data.draw_number} · Cartón: ${formatTokens(data.price_tokens)} fichas`;
  renderPrizePreview(data.prize_preview_tokens);
  buyButton.disabled = false;
}

function renderPrizePreview(prizes) {
  const heading = document.createElement('h3');
  heading.textContent = 'Escala de premios vigente al confirmar';
  const list = document.createElement('ul');
  [15, 14, 13, 12, 11].forEach((hits) => {
    const item = document.createElement('li');
    item.textContent = `${hits} aciertos: ${formatTokens(prizes[String(hits)] || 0)} fichas`;
    list.appendChild(item);
  });
  previewContainer.replaceChildren(heading, list);
}

async function buyTicket() {
  if (!currentPreview) {
    return;
  }

  buyButton.disabled = true;
  status.textContent = 'Confirmando la compra...';
  let ticket;
  try {
    const refreshed = await supabase.rpc('jva_preview_lottery_ticket');
    if (refreshed.error) {
      throw refreshed.error;
    }
    currentPreview = refreshed.data;
    renderPrizePreview(currentPreview.prize_preview_tokens);

    if (pendingSale && pendingSale.userId !== user.id) {
      pendingSale = null;
      sessionStorage.removeItem('jva.lottery.pending-sale');
    }
    if (!pendingSale) {
      pendingSale = {
        requestId: crypto.randomUUID(),
        userId: user.id,
        drawId: currentPreview.draw_id,
        prizePreview: currentPreview.prize_preview_tokens,
      };
      sessionStorage.setItem('jva.lottery.pending-sale', JSON.stringify(pendingSale));
    }

    const { data, error } = await supabase.rpc('jva_issue_lottery_ticket', {
      p_buyer_id: user.id,
      p_request_id: pendingSale.requestId,
      p_payment_method: 'digital',
      p_expected_draw_id: pendingSale.drawId,
      p_expected_prize_preview: pendingSale.prizePreview,
    });
    if (error) {
      if (Number(error.status) >= 400) {
        pendingSale = null;
        sessionStorage.removeItem('jva.lottery.pending-sale');
      }
      throw error;
    }

    pendingSale = null;
    sessionStorage.removeItem('jva.lottery.pending-sale');
    ticket = data;
  } catch (error) {
    console.error('[lottery] No se pudo comprar el cartón:', error);
    status.textContent = error.message || 'No se pudo comprar el cartón.';
    await refreshPreview();
    return;
  }

  status.textContent = 'Cartón comprado correctamente.';
  status.classList.add('lottery-status--success');
  playLotterySound('ticket');
  renderTicket(ticket);
  try {
    await refreshAccount();
    await refreshPreview();
    await refreshHistory();
  } catch (error) {
    console.error('[lottery] El cartón se compró, pero no se pudo actualizar la pantalla:', error);
    status.textContent = 'El cartón se compró, pero no se pudo actualizar saldo e historial. Recarga la página.';
  } finally {
    buyButton.disabled = !currentPreview;
  }
}

function renderTicket(ticket) {
  const card = document.createElement('article');
  card.className = 'mesa lottery-ticket lottery-ticket--new';
  const title = document.createElement('h3');
  title.textContent = `Cartón #${ticket.ticket_number}`;
  const draw = document.createElement('p');
  draw.textContent = `Sorteo #${ticket.draw_number}`;
  const numbers = renderNumberGrid(ticket.numbers);
  const prizeLabel = document.createElement('strong');
  prizeLabel.textContent = 'Premios fijados al momento de la compra:';
  const prizeList = document.createElement('ul');
  [15, 14, 13, 12, 11].forEach((hits) => {
    const item = document.createElement('li');
    item.textContent =
      `${hits} aciertos: ${formatTokens(ticket.prize_preview_tokens[String(hits)] || 0)} fichas`;
    prizeList.appendChild(item);
  });
  card.append(title, draw, numbers, prizeLabel, prizeList);
  ticketResult.replaceChildren(card);
}

function renderNumberGrid(numbers) {
  const grid = document.createElement('div');
  grid.className = 'lottery-number-grid';
  grid.setAttribute('aria-label', 'Números del cartón');
  numbers.forEach((number, index) => {
    const ball = document.createElement('span');
    ball.className = 'lottery-number-ball';
    ball.style.setProperty('--ball-index', String(index));
    ball.textContent = String(number);
    grid.appendChild(ball);
  });
  return grid;
}

async function refreshHistory() {
  const { data, error } = await supabase.rpc('jva_get_my_lottery_tickets', {
    p_limit: 50,
  });
  if (error) {
    throw error;
  }

  historyContainer.replaceChildren();
  if (!data.length) {
    historyContainer.textContent = 'Todavía no tienes cartones.';
    return;
  }

  data.forEach((ticket) => {
    const card = document.createElement('article');
    card.className = 'mesa';
    const title = document.createElement('h3');
    title.textContent = `Cartón #${ticket.ticket_number} · Sorteo #${ticket.draw_number}`;
    const numbers = renderNumberGrid(ticket.numbers);
    const result = document.createElement('p');
    if (ticket.draw_status !== 'settled') {
      result.textContent = 'Sorteo pendiente.';
    } else if (ticket.prize_tokens > 0 && !ticket.prize_claimed_at) {
      result.textContent = `Premio pendiente: ${formatTokens(ticket.prize_tokens)} fichas.`;
      const claimButton = document.createElement('button');
      claimButton.type = 'button';
      claimButton.textContent = 'Cobrar premio';
      claimButton.addEventListener('click', () => claimPrize(ticket.id, claimButton));
      card.append(title, numbers, result, claimButton);
      historyContainer.appendChild(card);
      return;
    } else if (ticket.prize_tokens > 0) {
      result.textContent = `Premio cobrado: ${formatTokens(ticket.prize_tokens)} fichas.`;
    } else {
      result.textContent = 'Este cartón no obtuvo premio.';
    }
    card.append(title, numbers, result);
    historyContainer.appendChild(card);
  });
}

async function claimPrize(ticketId, button) {
  button.disabled = true;
  try {
    const { error } = await supabase.rpc('jva_claim_lottery_prize', {
      p_ticket_id: ticketId,
      p_request_id: crypto.randomUUID(),
    });
    if (error) {
      throw error;
    }
    status.textContent = 'Premio acreditado en tu billetera.';
    status.classList.add('lottery-status--success');
    playLotterySound('prize');
    await refreshAccount();
    await refreshHistory();
  } catch (error) {
    console.error('[lottery] No se pudo cobrar el premio:', error);
    status.textContent = error.message || 'No se pudo cobrar el premio.';
    button.disabled = false;
  }
}

function playLotterySound(soundName) {
  const sound = lotterySounds[soundName];
  sound.currentTime = 0;
  sound.play().catch((error) => {
    console.warn('[lottery] No se pudo reproducir el sonido:', error);
  });
}

async function markActivity() {
  const { error } = await supabase.rpc('jva_ping_activity', {
    p_current_page: 'loteria',
  });
  if (error) {
    throw error;
  }
}

function formatTokens(amount) {
  return new Intl.NumberFormat('es-AR').format(Number(amount));
}

function readPendingSale() {
  const storedSale = sessionStorage.getItem('jva.lottery.pending-sale');
  if (!storedSale) {
    return null;
  }
  try {
    const pending = JSON.parse(storedSale);
    if (
      typeof pending.requestId === 'string'
      && typeof pending.userId === 'string'
      && typeof pending.drawId === 'string'
      && pending.prizePreview
      && typeof pending.prizePreview === 'object'
    ) {
      return pending;
    }
  } catch (error) {
    console.warn('[lottery] Se descartó una venta pendiente inválida:', error);
  }
  sessionStorage.removeItem('jva.lottery.pending-sale');
  return null;
}
