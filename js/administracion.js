import { supabase } from './supabase.js';
import { verificarSesion } from './session.js';

const status = document.getElementById('admin-status');
const usersList = document.getElementById('users-list');
const financeSection = document.getElementById('finance-section');
const settingsSection = document.getElementById('settings-section');
const gameForm = document.getElementById('game-config-form');
const gameKeyInput = document.getElementById('game-key');
const gameEnabledInput = document.getElementById('game-enabled');
const lotterySharesFieldset = document.getElementById('lottery-shares');
const drawStatus = document.getElementById('draw-status');
let user = null;
let roles = [];
let publicConfig = null;
let openDraw = null;

document.addEventListener('DOMContentLoaded', initialize);
document.getElementById('user-search-form').addEventListener('submit', searchUsers);
usersList.addEventListener('click', handleUserAction);
usersList.addEventListener('submit', handleUserAction);
document.getElementById('refresh-finance').addEventListener('click', refreshFinance);
document.getElementById('platform-settings-form').addEventListener('submit', saveSettings);
gameForm.addEventListener('submit', saveGameConfig);
document.getElementById('modules-form').addEventListener('submit', saveModules);
gameKeyInput.addEventListener('change', populateGameConfig);
document.getElementById('open-draw').addEventListener('click', openLotteryDraw);
document.getElementById('settle-draw').addEventListener('click', settleLotteryDraw);

async function initialize() {
  try {
    user = await verificarSesion();
    const { data: roleRows, error } = await supabase
      .from('jva_user_roles')
      .select('role')
      .eq('user_id', user.id);
    if (error) {
      throw error;
    }

    roles = roleRows.map((row) => row.role);
    if (!roles.length) {
      status.textContent = 'Tu cuenta no tiene permisos de administración.';
      return;
    }

    document.getElementById('admin-identity').textContent =
      `${user.username} · ${roles.join(', ')}`;
    financeSection.hidden = !hasRole('super_admin', 'admin');
    settingsSection.hidden = !hasRole('super_admin', 'admin');
    document.getElementById('superadmin-settings').hidden = !hasRole('super_admin');
    document.getElementById('open-draw').hidden = !hasRole('super_admin', 'admin');
    document.getElementById('settle-draw').hidden = !hasRole('super_admin', 'admin');
    await searchUsers();
    await refreshPublicConfig();
    if (!financeSection.hidden) {
      await refreshFinance();
    }
  } catch (error) {
    console.error('[admin] No se pudo iniciar el panel:', error);
    status.textContent = error.message || 'No se pudo cargar el panel.';
  }
}

async function searchUsers(event) {
  event?.preventDefault();
  const search = document.getElementById('user-search').value.trim();
  const { data, error } = await supabase.rpc('jva_get_admin_users', {
    p_search: search,
  });
  if (error) {
    console.error('[admin] No se pudieron buscar cuentas:', error);
    status.textContent = error.message;
    return;
  }

  usersList.replaceChildren();
  if (!data.length) {
    usersList.textContent = 'No se encontraron cuentas.';
    return;
  }

  data.forEach((account) => {
    usersList.appendChild(renderUserCard(account));
  });
}

function renderUserCard(account) {
  const card = document.createElement('article');
  card.className = 'mesa';
  const title = document.createElement('h3');
  title.textContent = `${account.username} · ${account.phone_e164}`;
  const balance = document.createElement('p');
  balance.textContent = `Saldo: ${formatTokens(account.balance_tokens)} fichas`;
  const signins = document.createElement('p');
  signins.textContent = `Inicios sin activar: ${account.successful_signins}`;
  const accountStatus = document.createElement('p');
  accountStatus.textContent = account.access_blocked_at
    ? `Cuenta bloqueada: ${account.access_block_reason}`
    : account.manually_verified_at
      ? 'Cuenta activada permanentemente.'
      : account.verification_required
        ? 'Debe confirmar la cuenta por WhatsApp.'
        : 'Pendiente de activación.';
  card.append(title, balance, signins, accountStatus);

  if (hasRole('super_admin', 'admin') && !account.manually_verified_at) {
    const activate = document.createElement('button');
    activate.type = 'button';
    activate.textContent = 'Activar cuenta';
    activate.dataset.action = 'activate';
    activate.dataset.userId = account.user_id;
    card.appendChild(activate);
  }

  if (hasRole('super_admin', 'admin') && !account.is_staff && account.user_id !== user.id) {
    const accessButton = document.createElement('button');
    accessButton.type = 'button';
    accessButton.textContent = account.access_blocked_at
      ? 'Desbloquear cuenta'
      : 'Bloquear cuenta';
    accessButton.dataset.action = account.access_blocked_at ? 'unblock' : 'block';
    accessButton.dataset.userId = account.user_id;
    card.appendChild(accessButton);
  }

  if (hasRole('super_admin', 'admin', 'cashier')) {
    card.append(
      renderCashForm(account.user_id, 'deposit', 'Acreditar fichas recibidas'),
      renderCashForm(account.user_id, 'redeem', 'Canjear fichas por fichas físicas'),
    );
  }
  return card;
}

function renderCashForm(userId, action, label) {
  const form = document.createElement('form');
  form.dataset.action = action;
  form.dataset.userId = userId;
  form.dataset.requestKey = `jva.admin.pending.${user.id}.${action}.${userId}`;
  const amountLabel = document.createElement('label');
  amountLabel.textContent = `${label} · cantidad`;
  const amountInput = document.createElement('input');
  amountInput.type = 'number';
  amountInput.min = '1';
  amountInput.max = '1000000000';
  amountInput.required = true;
  amountInput.dataset.field = 'amount';
  amountLabel.appendChild(amountInput);
  const reasonLabel = document.createElement('label');
  reasonLabel.textContent = 'Motivo (mínimo 3 caracteres)';
  const reasonInput = document.createElement('input');
  reasonInput.type = 'text';
  reasonInput.minLength = 3;
  reasonInput.maxLength = 200;
  reasonInput.required = true;
  reasonInput.dataset.field = 'reason';
  reasonLabel.appendChild(reasonInput);
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = action === 'deposit' ? 'Registrar acreditación' : 'Registrar canje';
  form.append(amountLabel, reasonLabel, submit);
  return form;
}

async function handleUserAction(event) {
  const button = event.target.closest('button[data-action]');
  if (button) {
    const action = button.dataset.action;
    const reason = action === 'activate'
      ? null
      : window.prompt(action === 'block'
        ? 'Indica el motivo del bloqueo:'
        : 'Indica el motivo del desbloqueo:');
    if (action !== 'activate' && reason === null) {
      return;
    }
    if (reason !== null && reason.trim().length < 3) {
      status.textContent = 'El motivo debe tener al menos 3 caracteres.';
      return;
    }

    button.disabled = true;
    try {
      const { error } = action === 'activate'
        ? await supabase.rpc('jva_activate_user', {
          p_user_id: button.dataset.userId,
        })
        : await supabase.rpc('jva_set_account_blocked', {
          p_user_id: button.dataset.userId,
          p_blocked: action === 'block',
          p_reason: reason.trim(),
        });
      if (error) {
        throw error;
      }
      status.textContent = action === 'activate'
        ? 'Cuenta activada.'
        : action === 'block'
          ? 'Cuenta bloqueada.'
          : 'Cuenta desbloqueada.';
      await searchUsers();
    } catch (error) {
      console.error('[admin] No se pudo actualizar el acceso de la cuenta:', error);
      status.textContent = error.message || 'No se pudo actualizar el acceso de la cuenta.';
      button.disabled = false;
    }
    return;
  }

  if (event.type !== 'submit') {
    return;
  }
  const form = event.target.closest('form[data-action]');
  if (!form) {
    return;
  }
  event.preventDefault();
  const action = form.dataset.action;
  const amount = Number(form.querySelector('[data-field="amount"]').value);
  const reason = form.querySelector('[data-field="reason"]').value.trim();
  const rpcName = action === 'deposit' ? 'jva_deposit_tokens' : 'jva_redeem_tokens';
  const submit = form.querySelector('button[type="submit"]');
  const requestKey = form.dataset.requestKey;
  const requestId = sessionStorage.getItem(requestKey) || crypto.randomUUID();
  sessionStorage.setItem(requestKey, requestId);
  submit.disabled = true;
  try {
    const { error } = await supabase.rpc(rpcName, {
      p_user_id: form.dataset.userId,
      p_amount: amount,
      p_reason: reason,
      p_request_id: requestId,
    });
    if (error) {
      if (Number(error.status) >= 400) {
        sessionStorage.removeItem(requestKey);
      }
      throw error;
    }
    sessionStorage.removeItem(requestKey);
    status.textContent = action === 'deposit'
      ? 'Acreditación registrada.'
      : 'Canje registrado.';
    await searchUsers();
    if (!financeSection.hidden) {
      await refreshFinance();
    }
  } catch (error) {
    console.error(`[admin] No se pudo registrar ${action}:`, error);
    status.textContent = error.message || 'No se pudo registrar el movimiento.';
    submit.disabled = false;
  }
}

async function refreshFinance() {
  const { data, error } = await supabase.rpc('jva_get_admin_financial_summary');
  if (error) {
    console.error('[admin] No se pudo cargar el resumen financiero:', error);
    status.textContent = error.message;
    return;
  }

  const summary = document.getElementById('finance-summary');
  summary.replaceChildren();
  [
    ['Fichas físicas en caja', data.physical_tokens],
    ['Ganancias acumuladas de la casa', data.house_earnings],
    ['Saldo total de billeteras', data.player_wallet_liabilities],
  ].forEach(([label, amount]) => {
    const line = document.createElement('p');
    line.textContent = `${label}: ${formatTokens(amount)} fichas`;
    summary.appendChild(line);
  });
  (data.games || []).forEach((game) => {
    const line = document.createElement('p');
    line.textContent =
      `${game.game_key}: fondo ${formatTokens(game.fund_tokens)}, ` +
      `reservado ${formatTokens(game.reserved_tokens)}, ` +
      `disponible ${formatTokens(game.available_tokens)}`;
    summary.appendChild(line);
  });
  const counts = document.createElement('p');
  counts.textContent =
    `Asientos: ${data.journal_entries} · Apuestas: ${data.bets} · Cartones: ${data.tickets}`;
  summary.appendChild(counts);
}

async function refreshPublicConfig() {
  const { data, error } = await supabase.rpc('jva_get_public_config');
  if (error) {
    throw error;
  }
  publicConfig = data;

  const settings = data.settings;
  document.getElementById('login-limit').value = settings.unverified_login_limit;
  document.getElementById('organizer-whatsapp').value =
    settings.organizer_whatsapp.replace(/\D/g, '');
  document.getElementById('ticket-price').value = settings.lottery_ticket_price;
  populateGameConfig();
  document.getElementById('show-slots').checked =
    data.modules.some((module) => module.key === 'slots' && module.visible);
  document.getElementById('show-lottery').checked =
    data.modules.some((module) => module.key === 'lottery' && module.visible);

  openDraw = data.open_lottery_draw || null;
  document.getElementById('settle-draw').disabled = !openDraw;
  drawStatus.textContent = openDraw
    ? `Sorteo abierto #${openDraw.draw_number}.`
    : 'No hay un sorteo abierto.';
}

function populateGameConfig() {
  if (!publicConfig) {
    return;
  }
  const game = publicConfig.games.find((item) => item.key === gameKeyInput.value);
  if (!game) {
    return;
  }
  gameEnabledInput.checked = game.enabled;
  gameEnabledInput.disabled = game.key === 'tables';
  document.getElementById('house-share').value = game.house_share_percent;
  document.getElementById('payout-includes-stake').checked = game.payout_includes_stake;
  document.getElementById('jackpot-multiplier').value = game.max_jackpot_multiplier;
  document.getElementById('pair-multiplier').value = game.max_pair_multiplier;
  document.getElementById('jackpot-probability').value = game.jackpot_probability_bps;
  document.getElementById('pair-probability').value = game.pair_probability_bps;
  [15, 14, 13, 12, 11].forEach((hits) => {
    document.getElementById(`share-${hits}`).value = game.prize_shares[String(hits)];
  });
  lotterySharesFieldset.hidden = game.key !== 'lottery';
}

async function saveSettings(event) {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const { error } = await supabase.rpc('jva_update_platform_settings', {
      p_unverified_login_limit: Number(document.getElementById('login-limit').value),
      p_organizer_whatsapp: document.getElementById('organizer-whatsapp').value.trim(),
      p_lottery_ticket_price: Number(document.getElementById('ticket-price').value),
    });
    if (error) {
      throw error;
    }
    status.textContent = 'Configuración general guardada.';
    await refreshPublicConfig();
  } catch (error) {
    console.error('[admin] No se pudo guardar la configuración:', error);
    status.textContent = error.message || 'No se pudo guardar la configuración.';
  } finally {
    submit.disabled = false;
  }
}

async function saveGameConfig(event) {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const gameKey = gameKeyInput.value;
    const prizeShares = gameKey === 'lottery'
      ? Object.fromEntries([15, 14, 13, 12, 11].map((hits) => [
        String(hits),
        Number(document.getElementById(`share-${hits}`).value),
      ]))
      : null;
    const { error } = await supabase.rpc('jva_update_game_config', {
      p_game_key: gameKey,
      p_enabled: gameKey === 'tables' ? false : gameEnabledInput.checked,
      p_house_share_percent: Number(document.getElementById('house-share').value),
      p_payout_includes_stake: document.getElementById('payout-includes-stake').checked,
      p_max_jackpot_multiplier: Number(document.getElementById('jackpot-multiplier').value),
      p_max_pair_multiplier: Number(document.getElementById('pair-multiplier').value),
      p_jackpot_probability_bps: Number(document.getElementById('jackpot-probability').value),
      p_pair_probability_bps: Number(document.getElementById('pair-probability').value),
      p_prize_shares: prizeShares,
    });
    if (error) {
      throw error;
    }
    status.textContent = 'Configuración del juego guardada.';
    await refreshPublicConfig();
    await refreshFinance();
  } catch (error) {
    console.error('[admin] No se pudo guardar el juego:', error);
    status.textContent = error.message || 'No se pudo guardar el juego.';
  } finally {
    submit.disabled = false;
  }
}

async function saveModules(event) {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const visibleModules = {
      slots: document.getElementById('show-slots').checked,
      lottery: document.getElementById('show-lottery').checked,
    };
    const modules = publicConfig.modules.map((module) => ({
      key: module.key,
      order: module.order,
      visible: Object.hasOwn(visibleModules, module.key)
        ? visibleModules[module.key]
        : module.visible,
    }));
    const { error } = await supabase.rpc('jva_update_site_modules', {
      p_modules: modules,
    });
    if (error) {
      throw error;
    }
    status.textContent = 'Visibilidad de módulos guardada.';
    await refreshPublicConfig();
  } catch (error) {
    console.error('[admin] No se pudieron guardar los módulos:', error);
    status.textContent = error.message || 'No se pudieron guardar los módulos.';
  } finally {
    submit.disabled = false;
  }
}

async function openLotteryDraw() {
  const button = document.getElementById('open-draw');
  button.disabled = true;
  try {
    const { data, error } = await supabase.rpc('jva_open_lottery_draw');
    if (error) {
      throw error;
    }
    status.textContent = `Se abrió el sorteo #${data.draw_number}.`;
    await refreshPublicConfig();
  } catch (error) {
    console.error('[admin] No se pudo abrir el sorteo:', error);
    status.textContent = error.message || 'No se pudo abrir el sorteo.';
  } finally {
    button.disabled = false;
  }
}

async function settleLotteryDraw() {
  if (!openDraw) {
    return;
  }
  const button = document.getElementById('settle-draw');
  button.disabled = true;
  try {
    const { data, error } = await supabase.rpc('jva_settle_lottery_draw', {
      p_draw_id: openDraw.id,
    });
    if (error) {
      throw error;
    }
    drawStatus.textContent =
      `Sorteo #${data.draw_number}: ${data.drawn_numbers.join(', ')} · ` +
      `${data.winning_tickets} cartones premiados.`;
    await refreshPublicConfig();
    await refreshFinance();
  } catch (error) {
    console.error('[admin] No se pudo realizar el sorteo:', error);
    status.textContent = error.message || 'No se pudo realizar el sorteo.';
    button.disabled = false;
  }
}

function hasRole(...allowedRoles) {
  return roles.some((role) => allowedRoles.includes(role));
}

function formatTokens(amount) {
  return new Intl.NumberFormat('es-AR').format(Number(amount || 0));
}
