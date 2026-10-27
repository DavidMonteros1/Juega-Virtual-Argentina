import { getUsuarioActual } from './auth.js';
import { supabase } from './supabase.js';

const status = document.getElementById('audit-status');
const report = document.getElementById('audit-report');
const logList = document.getElementById('audit-log-list');
const refreshButton = document.getElementById('refresh-audit');
const downloadButton = document.getElementById('download-audit');
const autoRefresh = document.getElementById('audit-auto-refresh');
const lastUpdated = document.getElementById('audit-last-updated');
const logStorageKey = 'jva-platform-audit-log-v1';
const maxLogs = 100;
let currentReport = null;
let refreshTimer = null;
let requestInFlight = false;

document.addEventListener('DOMContentLoaded', initialize);
refreshButton.addEventListener('click', loadAuditReport);
downloadButton.addEventListener('click', downloadReport);
document.getElementById('clear-audit-logs').addEventListener('click', clearLogs);
autoRefresh.addEventListener('change', updateRefreshTimer);

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
    if (!roles.some((role) => ['super_admin', 'admin', 'ai_auditor'].includes(role))) {
      status.textContent = 'Tu cuenta no tiene acceso a los informes de auditoría.';
      addLog('warning', 'Acceso denegado por falta de rol de auditoría.');
      return;
    }

    document.getElementById('audit-identity').textContent =
      `${user.username} · ${roles.join(', ')}`;
    refreshButton.disabled = false;
    addLog('info', 'Panel de auditoría iniciado.');
    await loadAuditReport();
    updateRefreshTimer();
  } catch (error) {
    console.error('[ai-audit] No se pudo iniciar la auditoría:', error);
    status.textContent = error.message || 'No se pudo validar el acceso a la auditoría.';
    addLog('error', 'No se pudo validar el acceso.', safeError(error));
  }
}

async function loadAuditReport() {
  if (requestInFlight) {
    return;
  }

  requestInFlight = true;
  refreshButton.disabled = true;
  status.textContent = 'Consultando el informe de solo lectura...';
  addLog('info', 'Solicitud del informe iniciada.');

  try {
    const { data, error } = await supabase.rpc('jva_get_platform_audit');
    if (error) {
      throw error;
    }
    if (!data || typeof data !== 'object') {
      throw new Error('La RPC devolvió un informe vacío o con formato inesperado.');
    }

    currentReport = data;
    report.textContent = JSON.stringify(data, null, 2);
    lastUpdated.textContent = `Última actualización: ${new Date(data.generated_at).toLocaleString('es-AR')}`;
    status.textContent = 'Informe recibido. La consulta no modificó datos.';
    downloadButton.disabled = false;
    addLog('success', 'Informe recibido.', {
      relations: data.relations?.length || 0,
      functions: data.functions?.length || 0,
      triggers: data.triggers?.length || 0,
      account_mismatches: (data.economy?.accounts || [])
        .filter((account) => !account.matches_ledger).length,
      unbalanced_entries: data.economy?.journal?.unbalanced_entries ?? null,
    });
  } catch (error) {
    console.error('[ai-audit] Falló la consulta de auditoría:', error);
    status.textContent = error.message || 'No se pudo consultar la auditoría.';
    addLog('error', 'Falló la consulta del informe.', safeError(error));
  } finally {
    requestInFlight = false;
    refreshButton.disabled = false;
  }
}

function updateRefreshTimer() {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (autoRefresh.checked && !document.hidden) {
    refreshTimer = window.setInterval(loadAuditReport, 15000);
  }
}

document.addEventListener('visibilitychange', updateRefreshTimer);

function downloadReport() {
  if (!currentReport) {
    return;
  }
  const blob = new Blob([JSON.stringify(currentReport, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `jva-auditoria-${new Date().toISOString().replaceAll(':', '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
  addLog('info', 'Informe JSON descargado.');
}

function addLog(level, message, details = null) {
  const logs = readLogs();
  logs.unshift({
    at: new Date().toISOString(),
    level,
    message,
    details,
  });
  try {
    sessionStorage.setItem(logStorageKey, JSON.stringify(logs.slice(0, maxLogs)));
  } catch (error) {
    console.warn('[ai-audit] No se pudo guardar el log local:', error);
  }
  renderLogs(logs.slice(0, maxLogs));
}

function readLogs() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(logStorageKey) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    console.warn('[ai-audit] Se descartó un log local inválido:', error);
    return [];
  }
}

function renderLogs(logs) {
  logList.replaceChildren();
  logs.forEach((entry) => {
    const item = document.createElement('li');
    item.className = `ai-audit-log ai-audit-log--${entry.level}`;
    const timestamp = document.createElement('time');
    timestamp.dateTime = entry.at;
    timestamp.textContent = new Date(entry.at).toLocaleString('es-AR');
    const message = document.createElement('strong');
    message.textContent = entry.message;
    item.append(timestamp, message);
    if (entry.details) {
      const details = document.createElement('pre');
      details.textContent = JSON.stringify(entry.details, null, 2);
      item.append(details);
    }
    logList.append(item);
  });
}

function clearLogs() {
  sessionStorage.removeItem(logStorageKey);
  renderLogs([]);
}

function safeError(error) {
  return {
    code: error?.code || null,
    message: error?.message || 'Error desconocido',
    status: error?.status || null,
  };
}

renderLogs(readLogs());
