import { getUsuarioActual } from './auth.js';
import { supabase } from './supabase.js';

const storageKeys = {
  sessionId: 'jva-brain-session-id-v1',
  generation: 'jva-brain-generation-v1',
  version: 'jva-brain-state-version-v1',
};

const status = document.getElementById('brain-status');
const output = document.getElementById('brain-output');
const identity = document.getElementById('brain-identity');
const sessionInfo = document.getElementById('brain-session-info');
const snapshotInput = document.getElementById('brain-snapshot');
const eventTypeInput = document.getElementById('brain-event-type');
const eventPayloadInput = document.getElementById('brain-event-payload');
const handoffPayloadInput = document.getElementById('brain-handoff-payload');
const queryInput = document.getElementById('brain-query');
const actionButtons = [
  'brain-bootstrap',
  'brain-claim',
  'brain-heartbeat',
  'brain-new-session',
  'brain-save-state',
  'brain-append-event',
  'brain-search',
  'brain-handoff',
];

document.addEventListener('DOMContentLoaded', initialize);
document.getElementById('brain-bootstrap').addEventListener('click', loadContext);
document.getElementById('brain-claim').addEventListener('click', claimSession);
document.getElementById('brain-heartbeat').addEventListener('click', heartbeat);
document.getElementById('brain-new-session').addEventListener('click', createNewSession);
document.getElementById('brain-save-state').addEventListener('click', saveSnapshot);
document.getElementById('brain-append-event').addEventListener('click', appendEvent);
document.getElementById('brain-search').addEventListener('click', searchPlaybooks);
document.getElementById('brain-handoff').addEventListener('click', handoff);

async function initialize() {
  try {
    const user = await getUsuarioActual();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    const { data: roleRows, error } = await supabase
      .from('jva_user_roles')
      .select('role')
      .eq('user_id', user.id);
    if (error) {
      throw error;
    }

    const roles = roleRows.map((row) => row.role);
    if (!roles.includes('ai_auditor')) {
      status.textContent = 'El Brain requiere el rol ai_auditor.';
      return;
    }

    identity.textContent = `${user.username} · ${roles.join(', ')}`;
    actionButtons.forEach((id) => {
      document.getElementById(id).disabled = false;
    });
    updateSessionInfo();
    await loadContext();
  } catch (error) {
    console.error('[jva-brain] No se pudo iniciar el Brain:', error);
    status.textContent = error.message || 'No se pudo validar el acceso al Brain.';
  }
}

async function loadContext() {
  await runAction('Cargando contexto...', async () => {
    const data = await callRpc('jva_brain_bootstrap', { p_event_limit: 20 });
    setSnapshot(data.snapshot);
    sessionStorage.setItem(storageKeys.version, String(data.version));
    showResult(data);
    status.textContent = 'Contexto cargado. No se modificó el estado.';
  });
}

async function claimSession() {
  await runAction('Reclamando el lease exclusivo...', async () => {
    let sessionId = sessionStorage.getItem(storageKeys.sessionId);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(storageKeys.sessionId, sessionId);
    }

    const data = await callRpc('jva_brain_claim', {
      p_session_id: sessionId,
      p_lease_seconds: 90,
    });
    if (data.claimed) {
      sessionStorage.setItem(storageKeys.generation, String(data.generation));
      sessionStorage.setItem(storageKeys.version, String(data.context.version));
      setSnapshot(data.context.snapshot);
      status.textContent = 'Lease reclamado. Mantén el heartbeat durante el trabajo.';
    } else {
      status.textContent = 'Otra sesión conserva un lease vigente; no se habilitó escritura.';
    }
    updateSessionInfo(data);
    showResult(data);
  });
}

async function heartbeat() {
  await runAction('Renovando lease...', async () => {
    const data = await callRpc('jva_brain_heartbeat', {
      p_session_id: getRequiredValue(storageKeys.sessionId, 'No hay ID de sesión.'),
      p_generation: getRequiredInteger(storageKeys.generation, 'No hay lease reclamado.'),
      p_lease_seconds: 90,
    });
    showResult(data);
    status.textContent = 'Lease renovado.';
    updateSessionInfo(data);
  });
}

function createNewSession() {
  sessionStorage.setItem(storageKeys.sessionId, crypto.randomUUID());
  sessionStorage.removeItem(storageKeys.generation);
  updateSessionInfo();
  status.textContent = 'ID nuevo listo. Solo reclama si corresponde iniciar una sesión nueva.';
}

async function saveSnapshot() {
  await runAction('Guardando snapshot...', async () => {
    const snapshot = parseJson(snapshotInput.value, 'snapshot');
    const data = await callRpc('jva_brain_save_state', {
      p_session_id: getRequiredValue(storageKeys.sessionId, 'No hay ID de sesión.'),
      p_generation: getRequiredInteger(storageKeys.generation, 'No hay lease reclamado.'),
      p_expected_version: getRequiredInteger(storageKeys.version, 'Carga el contexto antes de guardar.'),
      p_snapshot: snapshot,
    });
    sessionStorage.setItem(storageKeys.version, String(data.version));
    showResult(data);
    status.textContent = `Snapshot guardado. Versión ${data.version}.`;
  });
}

async function appendEvent() {
  await runAction('Guardando evento...', async () => {
    const data = await callRpc('jva_brain_append_event', {
      p_session_id: getRequiredValue(storageKeys.sessionId, 'No hay ID de sesión.'),
      p_generation: getRequiredInteger(storageKeys.generation, 'No hay lease reclamado.'),
      p_event_type: eventTypeInput.value,
      p_payload: parseJson(eventPayloadInput.value, 'payload del evento'),
    });
    showResult({ event_id: data });
    status.textContent = `Evento ${data} guardado.`;
  });
}

async function searchPlaybooks() {
  await runAction('Buscando playbooks...', async () => {
    const data = await callRpc('jva_brain_search_playbooks', {
      p_query: queryInput.value,
      p_limit: 10,
    });
    showResult(data);
    status.textContent = `${data.length} playbook(s) encontrados.`;
  });
}

async function handoff() {
  await runAction('Guardando handoff y liberando lease...', async () => {
    const data = await callRpc('jva_brain_handoff', {
      p_session_id: getRequiredValue(storageKeys.sessionId, 'No hay ID de sesión.'),
      p_generation: getRequiredInteger(storageKeys.generation, 'No hay lease reclamado.'),
      p_expected_version: getRequiredInteger(storageKeys.version, 'Carga el contexto antes del handoff.'),
      p_snapshot: parseJson(snapshotInput.value, 'snapshot'),
      p_handoff_payload: parseJson(handoffPayloadInput.value, 'payload del handoff'),
    });
    sessionStorage.removeItem(storageKeys.sessionId);
    sessionStorage.removeItem(storageKeys.generation);
    sessionStorage.setItem(storageKeys.version, String(data.version));
    showResult(data);
    status.textContent = 'Handoff guardado y lease liberado.';
    updateSessionInfo();
  });
}

async function runAction(progressMessage, action) {
  status.textContent = progressMessage;
  disableActions(true);
  try {
    await action();
  } catch (error) {
    console.error('[jva-brain] Falló una operación:', error);
    status.textContent = error.message || 'Falló la operación del Brain.';
    showResult({
      code: error.code || null,
      message: error.message || 'Error desconocido',
      status: error.status || null,
    });
  } finally {
    disableActions(false);
  }
}

async function callRpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) {
    throw error;
  }
  return data;
}

function getRequiredValue(key, message) {
  const value = sessionStorage.getItem(key);
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function getRequiredInteger(key, message) {
  const value = Number(getRequiredValue(key, message));
  if (!Number.isSafeInteger(value)) {
    throw new Error(message);
  }
  return value;
}

function parseJson(value, label) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label} no contiene JSON válido.`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} debe ser un objeto JSON.`);
  }
  return parsed;
}

function setSnapshot(snapshot) {
  snapshotInput.value = JSON.stringify(snapshot, null, 2);
}

function showResult(data) {
  output.textContent = JSON.stringify(data, null, 2);
}

function updateSessionInfo(result = null) {
  const sessionId = sessionStorage.getItem(storageKeys.sessionId);
  const generation = sessionStorage.getItem(storageKeys.generation);
  const version = sessionStorage.getItem(storageKeys.version);
  const lease = result?.lease_expires_at
    ? ` · lease hasta ${new Date(result.lease_expires_at).toLocaleTimeString('es-AR')}`
    : '';
  sessionInfo.textContent = sessionId
    ? `Sesión ${sessionId} · generación ${generation || 'sin lease'} · versión ${version || 'sin cargar'}${lease}`
    : 'Sin sesión escritora.';
}

function disableActions(disabled) {
  actionButtons.forEach((id) => {
    document.getElementById(id).disabled = disabled;
  });
}
