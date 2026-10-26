import { supabase } from './supabase.js';
import { verificarSesion } from './session.js';

const status = document.getElementById('admin-status');
const usersList = document.getElementById('users-list');
const financeSection = document.getElementById('finance-section');
const settingsSection = document.getElementById('settings-section');
const gameFundingForm = document.getElementById('game-funding-form');
const gameForm = document.getElementById('game-config-form');
const gameKeyInput = document.getElementById('game-key');
const gameEnabledInput = document.getElementById('game-enabled');
const lotterySharesFieldset = document.getElementById('lottery-shares');
const drawStatus = document.getElementById('draw-status');
const gameConfigStatus = document.getElementById('game-config-status');
const arcadeSettingsFieldset = document.getElementById('arcade-game-settings');
const legacySettingsFieldset = document.getElementById('legacy-game-settings');
const adminLogsPanel = document.getElementById('admin-logs');
const adminLogsList = document.getElementById('admin-logs-list');
const adminLogsCount = document.getElementById('admin-logs-count');
const arcadeGameKeys = ['dice', 'mines', 'crash', 'wheel', 'jackpot'];
const lobbyGameKeys = ['slots', 'lottery', ...arcadeGameKeys];
const adminLogsStorageKey = 'jva-admin-logs-v1';
const maxAdminLogs = 200;
let user = null;
let roles = [];
let publicConfig = null;
let openDraw = null;
let openJackpotDraw = null;
let accountArchiveAvailable = false;
let adminLogs = loadAdminLogs();

document.addEventListener('DOMContentLoaded', initialize);
window.addEventListener('error', (event) => {
  recordAdminLog('error', `Error de JavaScript: ${event.message}`, {
    file: event.filename.split('?')[0].split('#')[0],
    line: event.lineno,
    column: event.colno,
    stack: event.error?.stack,
  });
});
window.addEventListener('unhandledrejection', (event) => {
  recordAdminLog('error', 'Promesa rechazada sin manejar', event.reason);
});
document.getElementById('user-search-form').addEventListener('submit', searchUsers);
document.getElementById('show-archived-users').addEventListener('change', searchUsers);
usersList.addEventListener('click', handleUserAction);
usersList.addEventListener('submit', handleUserAction);
document.getElementById('refresh-finance').addEventListener('click', refreshFinance);
gameFundingForm.addEventListener('submit', transferGameFunding);
document.getElementById('platform-settings-form').addEventListener('submit', saveSettings);
gameForm.addEventListener('submit', saveGameConfig);
document.getElementById('modules-form').addEventListener('submit', saveModules);
gameKeyInput.addEventListener('change', populateGameConfig);
document.getElementById('open-draw').addEventListener('click', openLotteryDraw);
document.getElementById('settle-draw').addEventListener('click', settleLotteryDraw);
document.getElementById('open-jackpot-draw').addEventListener('click', openJackpotDrawForAdmin);
document.getElementById('settle-jackpot-draw').addEventListener('click', settleJackpotDraw);
document.getElementById('download-admin-logs').addEventListener('click', downloadAdminLogs);
document.getElementById('clear-admin-logs').addEventListener('click', clearAdminLogs);
renderAdminLogs();

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

    adminLogsPanel.hidden = false;
    recordAdminLog('info', 'Panel de administración iniciado', {
      roles,
      path: window.location.pathname,
    });
    document.getElementById('admin-identity').textContent =
      `${user.username} · ${roles.join(', ')}`;
    financeSection.hidden = !hasRole('super_admin', 'admin');
    settingsSection.hidden = !hasRole('super_admin', 'admin');
    document.getElementById('superadmin-settings').hidden = !hasRole('super_admin');
    document.getElementById('game-funding-tool').hidden = !hasRole('super_admin');
    document.getElementById('open-draw').hidden = !hasRole('super_admin', 'admin');
    document.getElementById('settle-draw').hidden = !hasRole('super_admin', 'admin');
    document.getElementById('open-jackpot-draw').hidden = !hasRole('super_admin', 'admin');
    document.getElementById('settle-jackpot-draw').hidden = !hasRole('super_admin', 'admin');
    await searchUsers();
    await refreshPublicConfig();
    if (!financeSection.hidden) {
      await refreshFinance();
    }
  } catch (error) {
    reportAdminError('[admin] No se pudo iniciar el panel:', error);
    status.textContent = error.message || 'No se pudo cargar el panel.';
  }
}

async function searchUsers(event) {
  event?.preventDefault();
  const search = document.getElementById('user-search').value.trim();
  const showArchivedInput = document.getElementById('show-archived-users');
  const showArchived = accountArchiveAvailable && showArchivedInput.checked;
  let { data, error } = await supabase.rpc('jva_search_admin_accounts', {
    p_search: search,
    p_show_archived: showArchived,
  });
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    accountArchiveAvailable = false;
    showArchivedInput.checked = false;
    document.getElementById('show-archived-users-label').hidden = true;
    ({ data, error } = await supabase.rpc('jva_get_admin_users', {
      p_search: search,
    }));
    if (!error) {
      status.textContent =
        'Para habilitar el retiro de cuentas, primero aplica la migración de archivo en Supabase.';
    }
  } else if (!error) {
    accountArchiveAvailable = true;
    document.getElementById('show-archived-users-label').hidden =
      !hasRole('super_admin', 'admin');
  }
  if (error) {
    reportAdminError('[admin] No se pudieron buscar cuentas:', error);
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
  card.className = 'mesa account-card';
  const identity = document.createElement('div');
  identity.className = 'account-card-identity';
  const title = document.createElement('h3');
  title.textContent = account.username;
  const phone = document.createElement('p');
  phone.textContent = account.phone_e164;
  identity.append(title, phone);
  const wallet = document.createElement('div');
  wallet.className = 'account-card-wallet';
  const balanceLabel = document.createElement('span');
  balanceLabel.textContent = 'SALDO DISPONIBLE';
  const balance = document.createElement('p');
  balance.textContent = `${formatTokens(account.balance_tokens)} fichas`;
  wallet.append(balanceLabel, balance);
  const signins = document.createElement('p');
  signins.textContent = `Inicios sin activar: ${account.successful_signins}`;
  signins.className = 'account-card-signins';
  const accountStatus = document.createElement('p');
  accountStatus.className = 'account-card-status';
  accountStatus.textContent = account.account_archived_at
    ? 'Cuenta retirada y bloqueada; el historial se conserva.'
    : account.access_blocked_at
    ? `Cuenta bloqueada: ${account.access_block_reason}`
    : account.manually_verified_at
      ? 'Cuenta activada permanentemente.'
      : account.verification_required
        ? 'Debe confirmar la cuenta por WhatsApp.'
        : 'Pendiente de activación.';
  card.append(identity, wallet, accountStatus, signins);

  if (account.account_archived_at) {
    card.classList.add('account-archived');
    return card;
  }

  const actions = document.createElement('details');
  actions.className = 'account-actions';
  const actionsSummary = document.createElement('summary');
  actionsSummary.textContent = 'Administrar cuenta y caja';
  actions.appendChild(actionsSummary);
  const actionsContent = document.createElement('div');
  actionsContent.className = 'account-actions-content';

  if (hasRole('super_admin', 'admin') && !account.manually_verified_at) {
    const activate = document.createElement('button');
    activate.type = 'button';
    activate.textContent = 'Activar cuenta';
    activate.dataset.action = 'activate';
    activate.dataset.userId = account.user_id;
    actionsContent.appendChild(activate);
  }

  if (accountArchiveAvailable && hasRole('super_admin', 'admin')
      && !account.is_staff && account.user_id !== user.id) {
    const archiveButton = document.createElement('button');
    archiveButton.type = 'button';
    archiveButton.textContent = 'Eliminar cuenta';
    archiveButton.className = 'button-danger';
    archiveButton.dataset.action = 'archive';
    archiveButton.dataset.userId = account.user_id;
    actionsContent.appendChild(archiveButton);
  }

  if (hasRole('super_admin', 'admin') && !account.is_staff && account.user_id !== user.id) {
    const accessButton = document.createElement('button');
    accessButton.type = 'button';
    accessButton.textContent = account.access_blocked_at
      ? 'Desbloquear cuenta'
      : 'Bloquear cuenta';
    accessButton.dataset.action = account.access_blocked_at ? 'unblock' : 'block';
    accessButton.dataset.userId = account.user_id;
    actionsContent.appendChild(accessButton);
  }

  if (hasRole('super_admin', 'admin', 'cashier')) {
    actionsContent.append(
      renderCashForm(account.user_id, 'deposit', 'Acreditar fichas recibidas'),
      renderCashForm(account.user_id, 'redeem', 'Canjear fichas por fichas físicas'),
    );
  }
  if (actionsContent.childElementCount > 0) {
    actions.appendChild(actionsContent);
    card.appendChild(actions);
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
    if (action === 'archive') {
      const confirmed = window.confirm(
        '¿Eliminar esta cuenta del panel? La cuenta quedará bloqueada y oculta de la lista normal. Sus saldos, movimientos e historial se conservarán. Esta acción no se puede revertir desde el panel.'
      );
      if (!confirmed) {
        return;
      }
      button.disabled = true;
      try {
        const { error } = await supabase.rpc('jva_archive_account', {
          p_user_id: button.dataset.userId,
        });
        if (error) {
          throw error;
        }
        status.textContent = 'Cuenta retirada, bloqueada y oculta de la lista normal.';
        await searchUsers();
      } catch (error) {
        reportAdminError('[admin] No se pudo retirar la cuenta:', error);
        status.textContent = error.message || 'No se pudo retirar la cuenta.';
        button.disabled = false;
      }
      return;
    }

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
      reportAdminError('[admin] No se pudo actualizar el acceso de la cuenta:', error);
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
    reportAdminError(`[admin] No se pudo registrar ${action}:`, error);
    status.textContent = error.message || 'No se pudo registrar el movimiento.';
    submit.disabled = false;
  }
}

async function refreshFinance() {
  const { data, error } = await supabase.rpc('jva_get_admin_financial_summary');
  if (error) {
    reportAdminError('[admin] No se pudo cargar el resumen financiero:', error);
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
  document.getElementById('game-funding-source-balance').textContent =
    `Ganancias disponibles para transferir: ${formatTokens(data.house_earnings)} fichas`;
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

async function transferGameFunding(event) {
  event.preventDefault();
  if (!hasRole('super_admin')) {
    status.textContent = 'Solo el administrador maestro puede transferir fondos a un juego.';
    return;
  }

  const submit = gameFundingForm.querySelector('button[type="submit"]');
  const gameKey = document.getElementById('funding-game-key').value;
  const amount = Number(document.getElementById('funding-amount').value);
  const reason = document.getElementById('funding-reason').value.trim();
  const requestStorageKey = `jva.admin.pending.game-fund.${user.id}`;
  const requestPayload = { gameKey, amount, reason };
  let pendingRequest;
  submit.disabled = true;
  document.getElementById('game-funding-status').textContent = 'Procesando transferencia...';
  try {
    pendingRequest = JSON.parse(sessionStorage.getItem(requestStorageKey) || 'null');
    if (!pendingRequest?.requestId
        || JSON.stringify(pendingRequest.payload) !== JSON.stringify(requestPayload)) {
      pendingRequest = { payload: requestPayload, requestId: crypto.randomUUID() };
      sessionStorage.setItem(requestStorageKey, JSON.stringify(pendingRequest));
    }
    recordAdminLog('info', 'Solicitando transferencia al fondo de un juego', {
      rpc: 'jva_fund_game_from_house_earnings',
      game_key: gameKey,
      amount_tokens: amount,
    });
    const { data, error } = await supabase.rpc('jva_fund_game_from_house_earnings', {
      p_game_key: gameKey,
      p_amount: amount,
      p_reason: reason,
      p_request_id: pendingRequest.requestId,
    });
    if (error) {
      if (Number(error.status) >= 400) {
        sessionStorage.removeItem(requestStorageKey);
      }
      throw error;
    }
    sessionStorage.removeItem(requestStorageKey);
    const selectedGame = publicConfig.games.find((game) => game.key === gameKey);
    const confirmation = `Se transfirieron ${formatTokens(amount)} fichas al fondo de ${selectedGame?.title || gameKey}.`;
    document.getElementById('game-funding-status').textContent = confirmation;
    status.textContent = confirmation;
    gameFundingForm.reset();
    recordAdminLog('info', 'Transferencia al fondo confirmada por Supabase', {
      rpc: 'jva_fund_game_from_house_earnings',
      game_key: gameKey,
      amount_tokens: amount,
      journal_entry_id: data,
    });
    await refreshFinance();
  } catch (error) {
    reportAdminError('[admin] No se pudo transferir al fondo del juego:', error);
    document.getElementById('game-funding-status').textContent =
      `${error.message || 'No se pudo completar la transferencia.'} Si fue un corte de conexión, conserva los mismos datos al reintentar.`;
  } finally {
    submit.disabled = false;
  }
}

async function refreshPublicConfig() {
  const { data, error } = await supabase.rpc('jva_get_public_config');
  if (error) {
    throw error;
  }
  publicConfig = data;
  populateFundingGameOptions();

  const settings = data.settings;
  document.getElementById('login-limit').value = settings.unverified_login_limit;
  document.getElementById('organizer-whatsapp').value =
    settings.organizer_whatsapp.replace(/\D/g, '');
  document.getElementById('ticket-price').value = settings.lottery_ticket_price;
  populateGameConfig();
  renderGameModuleToggles();

  openDraw = data.open_lottery_draw || null;
  document.getElementById('settle-draw').disabled = !openDraw;
  drawStatus.textContent = openDraw
    ? `Sorteo abierto #${openDraw.draw_number}.`
    : 'No hay un sorteo abierto.';

  openJackpotDraw = data.open_jackpot_draw || null;
  document.getElementById('settle-jackpot-draw').disabled = !openJackpotDraw;
  document.getElementById('jackpot-draw-status').textContent = openJackpotDraw
    ? `Sorteo de Jackpot abierto #${openJackpotDraw.draw_number}.`
    : 'No hay un sorteo de Jackpot abierto.';
}

function populateFundingGameOptions() {
  const select = document.getElementById('funding-game-key');
  const currentValue = select.value;
  select.replaceChildren();
  publicConfig.games
    .filter((game) => game.key !== 'tables')
    .forEach((game) => {
      const option = document.createElement('option');
      option.value = game.key;
      option.textContent = game.title;
      select.appendChild(option);
    });
  if (publicConfig.games.some((game) => game.key === currentValue)) {
    select.value = currentValue;
  }
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
  const isArcadeGame = arcadeGameKeys.includes(game.key);
  arcadeSettingsFieldset.hidden = !isArcadeGame;
  arcadeSettingsFieldset.disabled = !isArcadeGame;
  legacySettingsFieldset.hidden = isArcadeGame;
  legacySettingsFieldset.disabled = isArcadeGame;
  if (isArcadeGame) {
    populateArcadeSettings(game);
  } else {
    document.getElementById('payout-includes-stake').checked = game.payout_includes_stake;
    document.getElementById('jackpot-multiplier').value = game.max_jackpot_multiplier;
    document.getElementById('pair-multiplier').value = game.max_pair_multiplier;
    document.getElementById('jackpot-probability').value = game.jackpot_probability_bps;
    document.getElementById('pair-probability').value = game.pair_probability_bps;
  }
  [15, 14, 13, 12, 11].forEach((hits) => {
    document.getElementById(`share-${hits}`).value = game.prize_shares?.[String(hits)] ?? 0;
  });
  lotterySharesFieldset.hidden = game.key !== 'lottery';
}

function populateArcadeSettings(game) {
  const settings = game.arcade_settings || {};
  document.querySelectorAll('[data-arcade-config]').forEach((fieldset) => {
    const selected = fieldset.dataset.arcadeConfig === game.key;
    fieldset.hidden = !selected;
    fieldset.disabled = !selected;
  });
  if (game.key === 'dice') {
    document.getElementById('dice-multiplier').value = settings.win_multiplier;
  } else if (game.key === 'mines') {
    document.getElementById('mines-count').value = settings.mine_count;
    document.getElementById('mines-max-multiplier').value = settings.max_multiplier;
  } else if (game.key === 'crash') {
    document.getElementById('crash-max-multiplier').value = settings.max_multiplier;
    document.getElementById('crash-max-point').value = settings.max_crash_multiplier;
    document.getElementById('crash-growth').value = settings.growth_per_second;
  } else if (game.key === 'wheel') {
    document.getElementById('wheel-multipliers').value =
      Array.isArray(settings.multipliers) ? settings.multipliers.join(', ') : '';
  } else if (game.key === 'jackpot') {
    document.getElementById('jackpot-entry-price').value = settings.entry_price_tokens;
    document.getElementById('jackpot-interval').value = settings.draw_interval_hours;
  }
}

function renderGameModuleToggles() {
  const container = document.getElementById('game-modules-list');
  container.replaceChildren();
  for (const key of lobbyGameKeys) {
    const module = publicConfig.modules.find((item) => item.key === key);
    const game = publicConfig.games.find((item) => item.key === key);
    if (!module || !game) {
      continue;
    }
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.gameModule = key;
    checkbox.checked = module.visible && game.enabled;
    checkbox.disabled = !game.enabled;
    checkbox.title = game.enabled
      ? ''
      : 'Primero guarda este juego como habilitado en Configurar juego.';
    label.append(checkbox, ` Mostrar ${game.title} en el lobby${game.enabled ? '' : ' (pausado)'}`);
    container.appendChild(label);
  }
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
    reportAdminError('[admin] No se pudo guardar la configuración:', error);
    status.textContent = error.message || 'No se pudo guardar la configuración.';
  } finally {
    submit.disabled = false;
  }
}

async function saveGameConfig(event) {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  submit.disabled = true;
  gameConfigStatus.textContent = 'Guardando configuración...';
  try {
    const gameKey = gameKeyInput.value;
    const expectedEnabled = gameKey === 'tables' ? false : gameEnabledInput.checked;
    const isArcadeGame = arcadeGameKeys.includes(gameKey);
    const prizeShares = gameKey === 'lottery'
      ? Object.fromEntries([15, 14, 13, 12, 11].map((hits) => [
        String(hits),
        Number(document.getElementById(`share-${hits}`).value),
      ]))
      : null;
    const rpcName = isArcadeGame ? 'jva_update_arcade_game_config' : 'jva_update_game_config';
    recordAdminLog('info', 'Enviando configuración de juego a Supabase', {
      rpc: rpcName,
      game_key: gameKey,
      enabled: expectedEnabled,
    });
    const parameters = isArcadeGame
      ? {
        p_game_key: gameKey,
        p_enabled: gameEnabledInput.checked,
        p_house_share_percent: Number(document.getElementById('house-share').value),
        p_settings: getArcadeSettings(gameKey),
      }
      : {
        p_game_key: gameKey,
        p_enabled: expectedEnabled,
        p_house_share_percent: Number(document.getElementById('house-share').value),
        p_payout_includes_stake: document.getElementById('payout-includes-stake').checked,
        p_max_jackpot_multiplier: Number(document.getElementById('jackpot-multiplier').value),
        p_max_pair_multiplier: Number(document.getElementById('pair-multiplier').value),
        p_jackpot_probability_bps: Number(document.getElementById('jackpot-probability').value),
        p_pair_probability_bps: Number(document.getElementById('pair-probability').value),
        p_prize_shares: prizeShares,
      };
    const { error } = await supabase.rpc(rpcName, parameters);
    if (error) {
      throw error;
    }
    await refreshPublicConfig();
    const savedGame = publicConfig.games.find((game) => game.key === gameKey);
    if (!savedGame || savedGame.enabled !== expectedEnabled) {
      throw new Error(
        `Supabase no confirmó el cambio. ${gameKey} continúa pausado; ` +
        'revisa los permisos y el error de la consola antes de continuar.',
      );
    }
    status.textContent = `Configuración de ${savedGame.title} guardada.`;
    gameConfigStatus.textContent = savedGame.enabled
      ? `Configuración guardada: ${savedGame.title} está habilitado. Ya puedes marcarlo en Visibilidad de módulos.`
      : `Configuración guardada: ${savedGame.title} continúa pausado.`;
    recordAdminLog('info', 'Configuración de juego confirmada por Supabase', {
      rpc: rpcName,
      game_key: gameKey,
      enabled: savedGame.enabled,
    });
    try {
      await refreshFinance();
    } catch (error) {
      reportAdminError('[admin] No se pudo actualizar el resumen financiero:', error);
      status.textContent = `El juego se guardó, pero no se pudo actualizar el resumen financiero: ${error.message}`;
    }
  } catch (error) {
    reportAdminError('[admin] No se pudo guardar el juego:', error);
    status.textContent = error.message || 'No se pudo guardar el juego.';
    gameConfigStatus.textContent = error.message || 'No se pudo guardar el juego.';
  } finally {
    submit.disabled = false;
  }
}

function getArcadeSettings(gameKey) {
  if (gameKey === 'dice') {
    return { win_multiplier: Number(document.getElementById('dice-multiplier').value) };
  }
  if (gameKey === 'mines') {
    return {
      mine_count: Number(document.getElementById('mines-count').value),
      max_multiplier: Number(document.getElementById('mines-max-multiplier').value),
    };
  }
  if (gameKey === 'crash') {
    return {
      max_multiplier: Number(document.getElementById('crash-max-multiplier').value),
      max_crash_multiplier: Number(document.getElementById('crash-max-point').value),
      growth_per_second: Number(document.getElementById('crash-growth').value),
    };
  }
  if (gameKey === 'wheel') {
    return {
      multipliers: document.getElementById('wheel-multipliers').value
        .split(',')
        .map((value) => Number(value.trim())),
    };
  }
  return {
    entry_price_tokens: Number(document.getElementById('jackpot-entry-price').value),
    draw_interval_hours: Number(document.getElementById('jackpot-interval').value),
  };
}

async function saveModules(event) {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const visibleModules = Object.fromEntries(
      [...document.querySelectorAll('[data-game-module]')].map((checkbox) => [
        checkbox.dataset.gameModule,
        checkbox.checked,
      ]),
    );
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
    recordAdminLog('info', 'Visibilidad de módulos guardada', {
      rpc: 'jva_update_site_modules',
      visible_modules: modules.filter((module) => module.visible).map((module) => module.key),
    });
    await refreshPublicConfig();
  } catch (error) {
    reportAdminError('[admin] No se pudieron guardar los módulos:', error);
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
    reportAdminError('[admin] No se pudo abrir el sorteo:', error);
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
    reportAdminError('[admin] No se pudo realizar el sorteo:', error);
    status.textContent = error.message || 'No se pudo realizar el sorteo.';
    button.disabled = false;
  }
}

async function openJackpotDrawForAdmin() {
  const button = document.getElementById('open-jackpot-draw');
  button.disabled = true;
  try {
    const { data, error } = await supabase.rpc('jva_open_jackpot_draw');
    if (error) {
      throw error;
    }
    status.textContent = `Se abrió el sorteo de Jackpot #${data.draw_number}.`;
    await refreshPublicConfig();
  } catch (error) {
    reportAdminError('[admin] No se pudo abrir el sorteo de Jackpot:', error);
    status.textContent = error.message || 'No se pudo abrir el sorteo de Jackpot.';
  } finally {
    button.disabled = false;
  }
}

async function settleJackpotDraw() {
  if (!openJackpotDraw) {
    return;
  }
  const button = document.getElementById('settle-jackpot-draw');
  const requestKey = `jva-jackpot-settle-${openJackpotDraw.id}`;
  const requestId = sessionStorage.getItem(requestKey) || crypto.randomUUID();
  sessionStorage.setItem(requestKey, requestId);
  button.disabled = true;
  try {
    const { data, error } = await supabase.rpc('jva_settle_jackpot_draw', {
      p_draw_id: openJackpotDraw.id,
      p_request_id: requestId,
    });
    if (error) {
      if (Number(error.status) >= 400) {
        sessionStorage.removeItem(requestKey);
      }
      throw error;
    }
    sessionStorage.removeItem(requestKey);
    await refreshPublicConfig();
    document.getElementById('jackpot-draw-status').textContent = data.no_entries
      ? `Sorteo #${data.draw_number} cerrado sin participantes. El pozo queda acumulado.`
      : `Sorteo #${data.draw_number}: premio de ${formatTokens(data.prize_tokens)} fichas · ` +
        `ganador ${data.winner_user_id}.`;
    await refreshFinance();
  } catch (error) {
    reportAdminError('[admin] No se pudo realizar el sorteo de Jackpot:', error);
    status.textContent = error.message || 'No se pudo realizar el sorteo de Jackpot.';
    button.disabled = false;
  }
}

function hasRole(...allowedRoles) {
  return roles.some((role) => allowedRoles.includes(role));
}

function formatTokens(amount) {
  return new Intl.NumberFormat('es-AR').format(Number(amount || 0));
}

function loadAdminLogs() {
  try {
    const stored = sessionStorage.getItem(adminLogsStorageKey);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.slice(-maxAdminLogs) : [];
  } catch (error) {
    console.warn('[admin] No se pudieron recuperar los registros de esta pestaña:', error);
    return [];
  }
}

function recordAdminLog(level, message, details = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message: redactSensitiveText(String(message)),
    details: details === null ? null : sanitizeLogDetails(details),
  };
  adminLogs.push(entry);
  adminLogs = adminLogs.slice(-maxAdminLogs);
  renderAdminLogs();
  try {
    sessionStorage.setItem(adminLogsStorageKey, JSON.stringify(adminLogs));
  } catch (error) {
    console.warn('[admin] No se pudieron guardar los registros en esta pestaña:', error);
  }
}

function sanitizeLogDetails(details, depth = 0) {
  if (depth > 4) {
    return '[profundidad máxima alcanzada]';
  }
  if (details instanceof Error) {
    return Object.fromEntries(
      ['name', 'message', 'code', 'status', 'details', 'hint', 'stack']
        .filter((key) => details[key] !== undefined)
        .map((key) => [key, sanitizeLogDetails(details[key], depth + 1)]),
    );
  }
  if (typeof details === 'string') {
    return redactSensitiveText(details);
  }
  if (typeof details !== 'object' || details === null) {
    return redactSensitiveText(String(details));
  }
  if (Array.isArray(details)) {
    return details.slice(0, 30).map((value) => sanitizeLogDetails(value, depth + 1));
  }
  const sensitiveKey = /token|password|secret|authorization|api.?key|service.?role|publishable.?key|anon.?key|credential/i;
  return Object.fromEntries(
    Object.entries(details)
      .filter(([key]) => !sensitiveKey.test(key))
      .map(([key, value]) => [key, sanitizeLogDetails(value, depth + 1)]),
  );
}

function redactSensitiveText(value) {
  return value
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(
      /((?:access|refresh|service[_ -]?(?:role|key|token)|publishable[_ -]?key|anon[_ -]?key|api[_ -]?key|password|secret|authorization|credential|token))\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,]+)/gi,
      '$1=[REDACTED]',
    )
    .slice(0, 6000);
}

function reportAdminError(message, error) {
  console.error(message, error);
  recordAdminLog('error', message, error);
}

function renderAdminLogs() {
  if (!adminLogsList) {
    return;
  }
  adminLogsList.replaceChildren();
  adminLogs.slice().reverse().forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'admin-log-entry';
    item.dataset.level = entry.level;
    const time = document.createElement('time');
    time.dateTime = entry.timestamp;
    time.textContent = new Date(entry.timestamp).toLocaleString('es-AR');
    const message = document.createElement('span');
    message.textContent = `[${entry.level.toUpperCase()}] ${entry.message}`;
    item.append(time, message);
    if (entry.details !== null) {
      const details = document.createElement('pre');
      details.textContent = typeof entry.details === 'string'
        ? entry.details
        : JSON.stringify(entry.details, null, 2);
      item.appendChild(details);
    }
    adminLogsList.appendChild(item);
  });
  adminLogsCount.textContent = `${adminLogs.length} / ${maxAdminLogs} registros`;
}

function downloadAdminLogs() {
  const content = JSON.stringify({
    captured_at: new Date().toISOString(),
    page: window.location.pathname,
    entries: adminLogs,
  }, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `jva-admin-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
  recordAdminLog('info', 'Se descargó el archivo de registros');
}

function clearAdminLogs() {
  adminLogs = [];
  try {
    sessionStorage.removeItem(adminLogsStorageKey);
  } catch (error) {
    console.warn('[admin] No se pudieron limpiar los registros de esta pestaña:', error);
  }
  renderAdminLogs();
  recordAdminLog('info', 'Registros técnicos limpiados');
}
