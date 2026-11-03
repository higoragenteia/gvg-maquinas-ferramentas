/* =========================================================
   GVG & ARTEFAL — Controle de Máquinas e Ferramentas
   Interface SPA (GitHub Pages) + API Apps Script.
   ========================================================= */
'use strict';

const CONFIG = window.GVG_CONFIG || {};
const API_URL = String(CONFIG.apiUrl || '').trim();
const TOKEN_KEY = 'gvgMaqTokenV1';
const USERS_COLLAPSED_KEY = 'gvgMaqUsersCollapsedV1';

const state = {
  token: localStorage.getItem(TOKEN_KEY) || '',
  data: null,
  user: null,
  view: 'dashboard',
  busy: false,
  setupStatus: null,
  detail: null,
  detailLoading: false,
  detailId: '',
  detailTab: 'resumo',
  eqFilters: { q: '', categoria: '', status: '', conservacao: '', revisar: false },
  eqPage: 1,
  eqPageSize: 15,
  movFilters: { tipo: '', busca: '', dataInicio: '', dataFim: '' },
  movPage: 1,
  movData: null,
  movLoading: false,
  movCache: {},
  movReq: 0,
  manFilters: { status: '', busca: '' },
  manData: null,
  manLoading: false,
  manCache: {},
  manReq: 0,
  auditBusca: '',
  auditPage: 1,
  auditData: null,
  auditLoading: false,
  auditCache: {},
  auditReq: 0,
  listInflight: {},
  syncRunning: false,
  postLoadScheduled: false,
  prefetchPromise: null,
  colabSearch: '',
  usersCollapsed: localStorage.getItem(USERS_COLLAPSED_KEY) === '1',
  deferredPrompt: null,
  pendingRequestIds: {},
};

const VIEW_META = {
  dashboard: { title: 'Visão geral', subtitle: 'Resumo do controle de máquinas e ferramentas' },
  equipamentos: { title: 'Equipamentos', subtitle: 'Máquinas, ferramentas, disponibilidade e conservação' },
  movimentacoes: { title: 'Movimentações', subtitle: 'Entregas, devoluções, transferências e manutenção' },
  manutencoes: { title: 'Manutenções', subtitle: 'Equipamentos enviados para conserto e retorno' },
  colaboradores: { title: 'Colaboradores', subtitle: 'Pessoas, grupos e locais que recebem equipamentos' },
  categorias: { title: 'Categorias', subtitle: 'Tipos de máquinas e ferramentas controladas' },
  usuarios: { title: 'Usuários', subtitle: 'Contas de acesso e permissões do sistema' },
  auditoria: { title: 'Auditoria', subtitle: 'Registro das ações administrativas' },
};

const STATUS_LABEL = {
  DISPONIVEL: 'Disponível', ENTREGUE: 'Entregue', PARCIAL: 'Parcial',
  MANUTENCAO: 'Manutenção', INATIVO: 'Inativo',
};
const LOAN_LABEL = { ABERTO: 'Em aberto', ENCERRADO: 'Encerrado', TRANSFERIDO: 'Transferido' };
const MAN_LABEL = { ABERTA: 'Aberta', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada' };
const CONSERVACAO_LABEL = { NOVO: 'Novo', USADO: 'Usado', BOM: 'Bom', REGULAR: 'Regular', RUIM: 'Ruim', NAO_INFORMADO: 'Não informado' };
const TIPO_LABEL = {
  ENTREGA: 'Entrega', DEVOLUCAO: 'Devolução', TRANSFERENCIA: 'Transferência',
  SAIDA_MANUTENCAO: 'Saída p/ manutenção', RETORNO_MANUTENCAO: 'Retorno de manutenção',
  AJUSTE: 'Ajuste', IMPORTACAO: 'Importação',
};
const TIPO_COLAB_LABEL = { PESSOA: 'Pessoa', GRUPO: 'Grupo', LOCAL: 'Local', NAO_INFORMADO: 'Não informado' };

/* ---------- Ícones ---------- */
const ICON_PATHS = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  drill: '<path d="M3 10.5h7.5l2.2-3.2h3.9l2.9 2.9v3.3h-7.2l-2.1 3.2H3z"/><path d="M6.2 16.7v4"/><path d="M9.2 16.7v2.8"/><path d="M18.8 10.2H21"/>',
  swap: '<path d="M7 7h11l-3-3"/><path d="M17 17H6l3 3"/><path d="M18 7l-3 3"/><path d="M6 17l3-3"/>',
  wrench: '<path d="M14.7 6.3a4.3 4.3 0 0 0-5.8 5.8L3 18l3 3 5.9-5.9a4.3 4.3 0 0 0 5.8-5.8l-2.4 2.4-2.9-.7-.7-2.9z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 12A9 9 0 0 1 18.5 5.8L21 8"/><path d="M21 3v5h-5"/><path d="M3 21v-5h5"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.9.7-1.7 1.2-1.7 2.7"/><path d="M12 17h.01"/>',
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  x: '<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  alert: '<path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  package: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 10v4"/><path d="M6 10v4"/><path d="M10 10v4"/>',
  plug: '<path d="M9 2v6"/><path d="M15 2v6"/><path d="M6 8h12"/><path d="M12 8v5a4 4 0 0 0 4 4h1a4 4 0 0 0 4-4v-1"/><path d="M8 21h8"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.5 12.5 8-8"/><path d="m16 7 2 2"/><path d="m18 5 2 2"/>',
  userPlus: '<path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  mapPin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  filter: '<path d="M4 4h16l-6 7v6l-4 2v-8Z"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  arrowUpRight: '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
  fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
  wifiOff: '<path d="m2 2 20 20"/><path d="M8.5 8.5a10.5 10.5 0 0 1 12 2"/><path d="M5 12.5a10.5 10.5 0 0 1 4-2.4"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M12 20h.01"/>',
  sparkles: '<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2Z"/><path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7Z"/><path d="m5 14 .7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7Z"/>',
};

function icon(name, cls) {
  const p = ICON_PATHS[name] || ICON_PATHS.info;
  return `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
function hydrateIcons(root) {
  (root || document).querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.getAttribute('data-icon'));
  });
}

/* ---------- Utilidades ---------- */
function esc(v) {
  return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function norm(v) {
  return String(v === null || v === undefined ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'usuário';
}
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function genId() {
  if (window.crypto && crypto.randomUUID) return 'REQ-' + crypto.randomUUID().replace(/-/g, '').slice(0, 24).toUpperCase();
  return 'REQ-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 10).toUpperCase();
}
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseIsoDate(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}
function fmtDate(s) {
  const d = parseIsoDate(s);
  return d ? d.toLocaleDateString('pt-BR') : (s ? esc(s) : '—');
}
function fmtDateTime(s) {
  if (!s) return '—';
  const parts = String(s).split(' ');
  const d = parseIsoDate(parts[0]);
  if (!d) return esc(s);
  return d.toLocaleDateString('pt-BR') + (parts[1] ? ' ' + parts[1].slice(0, 5) : '');
}
function fmtQty(n) {
  const v = Number(n);
  if (!isFinite(v)) return '0';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
function fmtMoney(v) {
  if (v === '' || v === null || v === undefined) return '—';
  const n = Number(v);
  if (!isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function plural(n, s, p) { return `${fmtQty(n)} ${Number(n) === 1 ? s : p}`; }
function statusPill(s) {
  const key = String(s || '').toLowerCase();
  return `<span class="status-pill status-${esc(key)}">${esc(STATUS_LABEL[s] || s || '—')}</span>`;
}
function loanPill(s) {
  return `<span class="status-pill status-${esc(String(s || '').toLowerCase())}">${esc(LOAN_LABEL[s] || s || '—')}</span>`;
}
function manPill(s) {
  return `<span class="status-pill status-${esc(String(s || '').toLowerCase())}">${esc(MAN_LABEL[s] || s || '—')}</span>`;
}
function roleLabel(perfil) {
  return perfil === 'ADMINISTRADOR' ? 'Administrador' : 'Colaborador · consulta';
}
function isAdmin() { return state.user && state.user.perfil === 'ADMINISTRADOR'; }
function eqName(eq) { return eq.nome || [eq.categoria, eq.modelo || eq.codigoModelo || eq.codigo].filter(Boolean).join(' '); }
function movementTypeClass(t) {
  if (t === 'ENTREGA') return 'entrega';
  if (t === 'DEVOLUCAO') return 'devolucao';
  if (t === 'TRANSFERENCIA') return 'transferencia';
  if (t === 'SAIDA_MANUTENCAO' || t === 'RETORNO_MANUTENCAO' || t === 'AJUSTE') return 'manutencao';
  return '';
}
function movementIcon(t) {
  if (t === 'ENTREGA') return 'arrowUpRight';
  if (t === 'DEVOLUCAO') return 'check';
  if (t === 'TRANSFERENCIA') return 'swap';
  if (t === 'SAIDA_MANUTENCAO') return 'wrench';
  if (t === 'RETORNO_MANUTENCAO') return 'rotate';
  return 'history';
}
function debounce(fn, ms) {
  let t;
  return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}
function scrollTop() { window.scrollTo(0, 0); }
function safeText(v) { return esc(v === undefined || v === null || v === '' ? '—' : v); }
function daysBetween(iso) {
  const d = parseIsoDate(iso);
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

/* ---------- API ---------- */
class ApiClientError extends Error {
  constructor(code, message, details) {
    super(message || 'Não foi possível concluir a operação.');
    this.name = 'ApiClientError';
    this.code = code || 'ERRO';
    this.details = details || null;
  }
}

async function api(action, payload, opts) {
  opts = opts || {};
  if (!API_URL) throw new ApiClientError('CONFIG_AUSENTE', 'O endereço da API não está configurado.');
  const requestId = opts.requestId || genId();
  const body = {
    action,
    token: opts.token !== undefined ? opts.token : state.token,
    requestId,
    payload: payload || {},
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout || 120000);
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e && e.name === 'AbortError') throw new ApiClientError('TEMPO_ESGOTADO', 'O servidor demorou para responder. Verifique a conexão e tente novamente.');
    throw new ApiClientError('SEM_CONEXAO', 'Não foi possível conectar ao servidor. Verifique a internet e tente novamente.');
  }
  clearTimeout(timer);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) {
    throw new ApiClientError('RESPOSTA_INVALIDA', 'O servidor respondeu em formato inesperado. Confirme se a API do Apps Script está publicada corretamente.');
  }
  if (!json.ok) {
    const err = json.error || {};
    const code = err.code || 'ERRO';
    if (['NAO_AUTENTICADO', 'SESSAO_EXPIRADA', 'CONTA_BLOQUEADA'].indexOf(code) >= 0 && action !== 'login') {
      handleAuthLost(err.message);
    }
    throw new ApiClientError(code, err.message || 'Não foi possível concluir a operação.', err.details);
  }
  return json.data;
}

function isAuthError(err) {
  return !!err && ['NAO_AUTENTICADO', 'SESSAO_EXPIRADA', 'CONTA_BLOQUEADA'].indexOf(err.code) >= 0;
}

function handleAuthLost(message) {
  saveToken('');
  resetListCaches();
  state.data = null;
  state.user = null;
  closeModal();
  closeDetail();
  hideApp();
  showAuth('login', message || 'Sua sessão expirou. Entre novamente.', 'error');
}

function showConnectionError(message) {
  showAuth('connection', message || 'Não foi possível conectar ao servidor. Sua sessão foi mantida.', 'error');
}

/* ---------- UI base ---------- */
const $ = (id) => document.getElementById(id);
function showBoot(show) { const el = $('boot'); if (el) el.classList.toggle('hidden', !show); }
function hideApp() { const el = $('appView'); if (el) el.classList.add('hidden'); }
function showToast(message, type) {
  const root = $('toastRoot');
  if (!root) return;
  const t = document.createElement('div');
  t.className = 'toast ' + (type || 'info');
  t.innerHTML = `<span data-icon="${type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info'}"></span><div class="toast-body">${esc(message)}</div><button type="button" class="toast-close" aria-label="Fechar">✕</button>`;
  root.appendChild(t);
  hydrateIcons(t);
  const close = () => { t.style.opacity = '0'; t.style.transform = 'translateY(6px)'; setTimeout(() => t.remove(), 180); };
  t.querySelector('.toast-close').addEventListener('click', close);
  setTimeout(close, type === 'error' ? 7000 : 4200);
}
function setButtonBusy(btn, busy) {
  if (!btn) return;
  if (busy) {
    if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span> Processando…`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalHtml) { btn.innerHTML = btn.dataset.originalHtml; delete btn.dataset.originalHtml; }
  }
}
function setFormMessage(el, message, type) {
  if (!el) return;
  el.className = 'form-message ' + (type || '');
  el.textContent = message || '';
}
function showModalError(message) {
  const el = $('modalError');
  if (el) { el.textContent = message || ''; el.style.display = message ? 'block' : 'none'; }
}
function clearFormErrors(form) {
  if (!form) return;
  form.querySelectorAll('.field-error').forEach((e) => e.remove());
  const msg = form.querySelector('.form-message');
  if (msg) msg.textContent = '';
  showModalError('');
}

/* ---------- Auth ---------- */
function showAuth(mode, message, type) {
  showBoot(false);
  closeSidebar();
  hideApp();
  const auth = $('authView');
  if (auth) auth.classList.remove('hidden');
  ['loginBox', 'setupBox', 'recoveryBox', 'setupPendingBox', 'connectionBox'].forEach((id) => {
    const el = $(id); if (el) el.classList.add('hidden');
  });
  const map = { login: 'loginBox', setup: 'setupBox', recovery: 'recoveryBox', pending: 'setupPendingBox', connection: 'connectionBox' };
  const box = $(map[mode] || 'loginBox');
  if (box) box.classList.remove('hidden');
  if (mode === 'login') {
    if (message) setFormMessage($('loginMessage'), message, type || 'error');
    setTimeout(() => { const el = $('loginEmail'); if (el && !el.value) el.focus(); }, 80);
  }
  if (mode === 'setup') {
    if (message) setFormMessage($('setupMessage'), message, type || 'error');
    setTimeout(() => { const el = $('setupCode'); if (el) el.focus(); }, 80);
  }
  if (mode === 'recovery') {
    if (message) setFormMessage($('recoveryMessage'), message, type || 'error');
    setTimeout(() => { const el = $('recoveryCode'); if (el) el.focus(); }, 80);
  }
  if (mode === 'connection') {
    if (message) setFormMessage($('connectionMessage'), message, type || 'error');
    setTimeout(() => { const el = $('retryConnection'); if (el) el.focus(); }, 80);
  }
}

async function checkInitial() {
  showBoot(true);
  if (!API_URL) {
    showAuth('login', 'O endereço da API não foi configurado. Publique o backend e atualize o config.js.', 'error');
    return;
  }
  // Com sessão salva, tenta abrir direto. Assim o F5 faz uma única chamada
  // em vez de setupStatus + bootstrap em sequência.
  if (state.token) {
    try {
      const data = await api('bootstrap', {});
      enterApp(data);
      return;
    } catch (e) {
      if (!isAuthError(e)) {
        showConnectionError(e.message);
        return;
      }
      saveToken('');
      resetListCaches();
      showAuth('login', e.message, 'error');
      return;
    }
  }
  try {
    const st = await api('setupStatus', {}, { token: '' });
    state.setupStatus = st;
    if (st.precisaSetup) { showAuth('setup'); return; }
    if (st.configuracaoPendente) { showAuth('pending'); return; }
    showAuth('login');
  } catch (e) {
    showConnectionError(e.message || 'Não foi possível conectar ao servidor.');
  }
}

function enterApp(data) {
  state.data = data;
  state.user = data.usuario;
  state.token = localStorage.getItem(TOKEN_KEY) || state.token;
  document.body.classList.remove('sidebar-open');
  $('boot').classList.add('hidden');
  $('authView').classList.add('hidden');
  $('appView').classList.remove('hidden');
  updateChrome();
  const hash = location.hash.replace(/^#\/?/, '');
  const view = VIEW_META[hash] ? hash : 'dashboard';
  setView(view, { push: false });
  renderCurrentView();
  state.postLoadScheduled = false;
  // Começa a aquecer as telas assim que o painel aparece, sem esperar 1,5 s.
  state.prefetchPromise = prefetchCommonLists();
  schedulePostLoad();
}

function saveToken(token) {
  state.token = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function doLogin(e) {
  e.preventDefault();
  const form = $('loginForm');
  const btn = $('loginSubmit');
  const email = $('loginEmail').value.trim();
  const senha = $('loginPassword').value;
  clearFormErrors(form);
  if (!email || !senha) { setFormMessage($('loginMessage'), 'Informe usuário/e-mail e senha.', 'error'); return; }
  const rid = form.dataset.requestId || genId();
  form.dataset.requestId = rid;
  setButtonBusy(btn, true);
  try {
    const data = await api('login', { email, senha, userAgent: navigator.userAgent }, { token: '', requestId: rid });
    form.dataset.requestId = '';
    saveToken(data.token);
    resetListCaches();
    try {
      const boot = await api('bootstrap', {});
      enterApp(boot);
      showToast(`Bem-vindo, ${firstName(data.usuario.nome)}.`, 'success');
    } catch (bootErr) {
      if (isAuthError(bootErr)) throw bootErr;
      showConnectionError(bootErr.message);
    }
  } catch (err) {
    setFormMessage($('loginMessage'), err.message, 'error');
  } finally {
    setButtonBusy(btn, false);
  }
}

async function doSignup(e) {
  e.preventDefault();
  const form = $('signupForm');
  const btn = $('signupSubmit');
  const usuario = $('signupUser').value.trim();
  const senha = $('signupPassword').value;
  clearFormErrors(form);
  if (!usuario || !senha) { setFormMessage($('signupMessage'), 'Informe usuário e senha.', 'error'); return; }
  if (senha.length < 5) { setFormMessage($('signupMessage'), 'A senha deve ter pelo menos 5 caracteres.', 'error'); return; }
  const rid = form.dataset.requestId || genId();
  form.dataset.requestId = rid;
  setButtonBusy(btn, true);
  try {
    const data = await api('autoCadastro', { usuario: usuario, senha: senha }, { token: '', requestId: rid });
    form.dataset.requestId = '';
    $('signupPassword').value = '';
    setFormMessage($('signupMessage'), data.mensagem || 'Cadastro enviado. Aguarde a aprovação do administrador.', 'success');
    showToast('Cadastro enviado. Aguarde a aprovação do administrador.', 'success');
  } catch (err) {
    setFormMessage($('signupMessage'), err.message, 'error');
  } finally {
    setButtonBusy(btn, false);
  }
}

async function doSetup(e) {
  e.preventDefault();
  const form = $('setupForm');
  const btn = $('setupSubmit');
  const codigo = $('setupCode').value.trim();
  const nome = $('setupName').value.trim();
  const email = $('setupEmail').value.trim();
  const senha = $('setupPassword').value;
  const senha2 = $('setupPassword2').value;
  clearFormErrors(form);
  if (!codigo || !nome || !email || !senha) { setFormMessage($('setupMessage'), 'Preencha todos os campos.', 'error'); return; }
  if (senha.length < 8) { setFormMessage($('setupMessage'), 'A senha deve ter pelo menos 8 caracteres.', 'error'); return; }
  if (senha !== senha2) { setFormMessage($('setupMessage'), 'As senhas não conferem.', 'error'); return; }
  const rid = form.dataset.requestId || genId();
  form.dataset.requestId = rid;
  setButtonBusy(btn, true);
  try {
    const data = await api('setupAdmin', { codigo, nome, email, senha, userAgent: navigator.userAgent }, { token: '', requestId: rid });
    form.dataset.requestId = '';
    saveToken(data.token);
    resetListCaches();
    try {
      const boot = await api('bootstrap', {});
      enterApp(boot);
      showToast('Administrador criado. A configuração inicial foi encerrada.', 'success');
      if (data.avisos && data.avisos.length) setTimeout(() => showToast(data.avisos.join(' '), 'error'), 700);
    } catch (bootErr) {
      if (isAuthError(bootErr)) throw bootErr;
      showConnectionError(bootErr.message);
    }
  } catch (err) {
    setFormMessage($('setupMessage'), err.message, 'error');
  } finally {
    setButtonBusy(btn, false);
  }
}

async function doRecovery(e) {
  e.preventDefault();
  const form = $('recoveryForm');
  const btn = $('recoverySubmit');
  const codigo = $('recoveryCode').value.trim();
  const email = $('recoveryEmail').value.trim();
  const senha = $('recoveryPassword').value;
  const senha2 = $('recoveryPassword2').value;
  clearFormErrors(form);
  if (!codigo || !email || !senha) { setFormMessage($('recoveryMessage'), 'Preencha todos os campos.', 'error'); return; }
  if (senha.length < 8) { setFormMessage($('recoveryMessage'), 'A senha deve ter pelo menos 8 caracteres.', 'error'); return; }
  if (senha !== senha2) { setFormMessage($('recoveryMessage'), 'As senhas não conferem.', 'error'); return; }
  const rid = form.dataset.requestId || genId();
  form.dataset.requestId = rid;
  setButtonBusy(btn, true);
  try {
    await api('recuperarAdmin', { codigo, email, senha }, { token: '', requestId: rid });
    form.dataset.requestId = '';
    form.reset();
    showAuth('login', 'Senha redefinida. Entre com a nova senha.', 'success');
    $('loginEmail').value = email;
  } catch (err) {
    setFormMessage($('recoveryMessage'), err.message, 'error');
  } finally {
    setButtonBusy(btn, false);
  }
}

/* ---------- Chrome / navegação ---------- */
function updateChrome() {
  if (!state.user || !state.data) return;
  const admin = isAdmin();
  document.querySelectorAll('.admin-only').forEach((el) => el.classList.toggle('hidden', !admin));
  $('userName').textContent = state.user.nome || '—';
  $('userRole').textContent = roleLabel(state.user.perfil);
  $('userAvatar').textContent = initials(state.user.nome);
  $('topbarName').textContent = state.user.nome || '—';
  $('topbarAvatar').textContent = initials(state.user.nome);
  $('navEqBadge').textContent = String(state.data.stats ? state.data.stats.totalEquipamentos : '') || '';
  $('navManBadge').textContent = String((state.data.manutencoesAbertas || []).length || '') || '';
  const pendentes = (state.data.usuarios || []).filter((u) => u.status === 'PENDENTE').length;
  $('navUsersBadge').textContent = pendentes ? String(pendentes) : '';
  const meta = VIEW_META[state.view] || VIEW_META.dashboard;
  $('pageTitle').textContent = meta.title;
  $('pageSubtitle').textContent = meta.subtitle;
  document.title = `${meta.title} · GVG Máquinas`;
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.getAttribute('data-view') === state.view));
  $('installAppBtn').hidden = !state.deferredPrompt;
}

function setView(view, opts) {
  opts = opts || {};
  if (!VIEW_META[view]) view = 'dashboard';
  state.view = view;
  if (opts.push !== false) {
    const target = '#/' + view;
    if (location.hash !== target) history.pushState(null, '', target);
  }
  updateChrome();
  closeSidebar();
  scrollTop();
  renderCurrentView();
}

function renderCurrentView() {
  if (!state.data) return;
  const main = $('main');
  if (!main) return;
  if (state.view === 'dashboard') renderDashboard();
  else if (state.view === 'equipamentos') renderEquipmentView();
  else if (state.view === 'movimentacoes') renderMovementsView();
  else if (state.view === 'manutencoes') renderMaintenanceView();
  else if (state.view === 'colaboradores') renderCollaboratorsView();
  else if (state.view === 'categorias') renderCategoriesView();
  else if (state.view === 'usuarios') renderUsersView();
  else if (state.view === 'auditoria') renderAuditView();
  hydrateIcons(main);
}

async function refreshData(opts) {
  opts = opts || {};
  if (!state.token) return;
  const btn = $('refreshBtn');
  if (btn && !opts.silent) btn.classList.add('spinning');
  try {
    const data = await api('bootstrap', {});
    state.data = data;
    state.user = data.usuario;
    updateChrome();
    markListCachesStale();
    if (!opts.keepModal) renderCurrentView();
  } catch (e) {
    if (!opts.silent) showToast(e.message, 'error');
    throw e;
  } finally {
    if (btn) btn.classList.remove('spinning');
  }
}

/* ---------- Cache das telas e rotinas de segundo plano ---------- */
function listCacheFor(key) {
  if (key.indexOf('mov|') === 0) return state.movCache;
  if (key.indexOf('man|') === 0) return state.manCache;
  if (key.indexOf('audit|') === 0) return state.auditCache;
  return null;
}

function getListCache(key) {
  const cache = listCacheFor(key);
  return cache ? cache[key] : null;
}

function setListCache(key, data) {
  const cache = listCacheFor(key);
  if (!cache) return;
  cache[key] = { data: data, at: Date.now() };
  const keys = Object.keys(cache);
  if (keys.length > 24) {
    keys.sort(function (a, b) { return (cache[a].at || 0) - (cache[b].at || 0); });
    for (let i = 0; i < keys.length - 24; i++) delete cache[keys[i]];
  }
}

function apiList(action, payload, key) {
  if (state.listInflight[key]) return state.listInflight[key];
  const promise = api(action, payload).then(function (data) {
    setListCache(key, data);
    return data;
  }).finally(function () {
    delete state.listInflight[key];
  });
  state.listInflight[key] = promise;
  return promise;
}

function markListCachesStale() {
  [state.movCache, state.manCache, state.auditCache].forEach(function (cache) {
    Object.keys(cache).forEach(function (key) { cache[key].at = 0; });
  });
}

function resetListCaches() {
  state.movCache = {};
  state.manCache = {};
  state.auditCache = {};
  state.listInflight = {};
  state.prefetchPromise = null;
  state.movData = null;
  state.manData = null;
  state.auditData = null;
}

function movFiltersKey(page) {
  const f = state.movFilters;
  return ['mov', page, f.tipo, f.busca, f.dataInicio, f.dataFim].join('|');
}

function manFiltersKey() {
  return ['man', state.manFilters.status, state.manFilters.busca].join('|');
}

function auditFiltersKey(page) {
  return ['audit', page, state.auditBusca].join('|');
}

function schedulePostLoad() {
  if (state.postLoadScheduled) return;
  state.postLoadScheduled = true;
  setTimeout(function () { runPostLoad().catch(function () {}); }, 1500);
}

async function runPostLoad() {
  if (!state.token || !state.data) return;
  if (state.prefetchPromise) { try { await state.prefetchPromise; } catch (e) {} }
  if (isAdmin() && state.data.precisaSincronizacao) await runInitialSync();
}

async function runInitialSync() {
  if (state.syncRunning || !state.token) return;
  state.syncRunning = true;
  try {
    const data = await api('sincronizarTudo', {}, { requestId: genId(), timeout: 180000 });
    if (state.data) state.data.precisaSincronizacao = false;
    await refreshData({ silent: true, keepModal: true });
    if (data.erros && data.erros.length) {
      showToast('Sincronização inicial: ' + data.erros.length + ' item(ns) com erro. Use Sincronizar planilha para conferir.', 'error');
    }
  } catch (e) {
    if (!isAuthError(e)) showToast('A sincronização inicial das abas não foi concluída: ' + e.message, 'error');
  } finally {
    state.syncRunning = false;
  }
}

function prefetchCommonLists() {
  if (!state.token || !state.data || document.visibilityState === 'hidden') return Promise.resolve();
  const mf = state.movFilters;
  const tasks = [
    apiList('listarMovimentacoes', {
      page: 1, pageSize: 25, tipo: mf.tipo, busca: mf.busca, dataInicio: mf.dataInicio, dataFim: mf.dataFim
    }, movFiltersKey(1)),
    apiList('listarManutencoes', {
      status: state.manFilters.status, busca: state.manFilters.busca
    }, manFiltersKey())
  ];
  if (isAdmin()) {
    tasks.push(apiList('listarAuditoria', { page: 1, pageSize: 30, busca: state.auditBusca }, auditFiltersKey(1)));
  }
  return Promise.allSettled(tasks);
}

function openSidebar() {
  $('sidebar').classList.add('open');
  $('sidebarBackdrop').classList.remove('hidden');
  document.body.classList.add('sidebar-open');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  $('sidebar').classList.remove('open');
  $('sidebarBackdrop').classList.add('hidden');
  document.body.classList.remove('sidebar-open');
  document.body.style.overflow = '';
}

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const d = state.data;
  const s = d.stats || {};
  const main = $('main');
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const admin = isAdmin();
  const pend = (d.emprestimosAbertos || []).filter((l) => l.quantidade > 0 || l.totalPendente > 0).slice(0, 5);
  const mans = (d.manutencoesAbertas || []).slice(0, 4);
  const cats = (d.porCategoria || []).filter((c) => c.total > 0 || c.revisar > 0);
  const movs = (d.movimentacoesRecentes || []).slice(0, 8);
  const alertCount = (d.avisos || []).length;

  main.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">${esc(greeting)}, ${esc(firstName(state.user.nome))}</div>
        <h2>Resumo do ferramental</h2>
        <p>${esc(dateStr)} · ${esc(d.config ? d.config.appNome : 'Controle de Máquinas e Ferramentas')}</p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-secondary" data-action="refresh">${icon('refresh')} Atualizar</button>
      </div>
    </div>

    ${admin ? `<section class="card quick-actions">
      <div class="quick-actions-head">
        <div><h3>Ações rápidas</h3><p>Atalhos para as operações mais usadas no dia a dia.</p></div>
        <button type="button" class="quick-sync" data-action="sync-sheet">Sincronizar planilha</button>
      </div>
      <div class="quick-actions-grid">
        ${quickAction('new-delivery', 'Registrar entrega', 'Nova saída de equipamento', 'arrowUpRight', 'primary')}
        ${quickAction('new-equipment', 'Cadastrar equipamento', 'Novo item no controle', 'plus')}
        ${quickAction('new-maintenance', 'Enviar para manutenção', 'Indisponibiliza o item', 'wrench')}
        ${quickAction('new-collaborator', 'Novo colaborador', 'Quem recebe equipamentos', 'userPlus')}
        ${quickAction('new-category', 'Nova categoria/aba', 'Cria categoria e aba', 'tag')}
      </div>
    </section>` : ''}

    <div class="stat-grid">
      ${statCard('Disponíveis', s.disponiveis || 0, `de ${fmtQty(s.totalItens || 0)} itens ativos`, 'package', 'green', 'stat-go-equip')}
      ${statCard('Entregues', s.entregues || 0, `${plural(s.pendenciasDevolucao || 0, 'empréstimo aberto', 'empréstimos abertos')}`, 'arrowUpRight', 'gold', 'stat-go-pending')}
      ${statCard('Em manutenção', s.manutencao || 0, `${plural((d.manutencoesAbertas || []).length, 'registro aberto', 'registros abertos')}`, 'wrench', 'red', 'stat-go-man')}
      ${statCard('Devoluções', s.pendenciasDevolucao || 0, `${plural(s.itensPendentesAcessorios || 0, 'acessório pendente', 'acessórios pendentes')}`, 'clock', '', 'stat-go-pending')}
    </div>

    <div class="flex flex-wrap mt-16" style="gap:8px">
      <span class="badge gray">${fmtQty(s.totalEquipamentos || 0)} cadastros ativos</span>
      <span class="badge gray">${fmtQty(s.totalItens || 0)} itens no total</span>
      <span class="badge ${s.revisar ? 'gold' : 'green'}">${fmtQty(s.revisar || 0)} para revisar</span>
      <span class="badge ${s.inativos ? 'gray' : 'green'}">${fmtQty(s.inativos || 0)} inativos</span>
      <span class="badge blue">Atualizado ${esc(fmtDateTime(d.atualizadoEm))}</span>
    </div>

    ${alertCount ? `<div class="alert alert-warn mt-16">${icon('alert')}<div><strong>${alertCount} aviso(s) de importação/revisão.</strong> A origem tem divergências que não foram inventadas. <button type="button" class="link-btn" data-action="show-import-notes">Conferir agora</button></div></div>` : ''}

    <div class="grid-2 section-gap">
      <section class="card">
        <div class="card-head">
          <div><h3 class="card-title">Distribuição por categoria</h3><p class="card-sub">Disponível, entregue e em manutenção.</p></div>
          <button type="button" class="btn btn-sm btn-ghost" data-action="go-equipamentos">Ver todos ${icon('arrowRight')}</button>
        </div>
        <div class="card-body">
          <div class="legend mb-12"><span><i class="l-disp"></i>Disponível</span><span><i class="l-ent"></i>Entregue</span><span><i class="l-man"></i>Manutenção</span></div>
          ${cats.length ? `<div class="category-list">${cats.map(categoryRow).join('')}</div>` : emptyState('package', 'Nenhum equipamento importado', 'Cadastre o primeiro equipamento para ver a distribuição.')}
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <div><h3 class="card-title">Pendências de devolução</h3><p class="card-sub">Equipamentos e acessórios que ainda estão com colaboradores.</p></div>
          <button type="button" class="btn btn-sm btn-ghost" data-action="go-movimentacoes">Histórico ${icon('arrowRight')}</button>
        </div>
        <div class="card-body">
          ${pend.length ? `<div class="pending-list">${pend.map(pendingItem).join('')}</div>` : `<div class="empty-state" style="padding:26px 10px">${icon('check','')}<strong>Tudo em ordem</strong><p>Nenhuma devolução pendente no momento.</p></div>`}
        </div>
      </section>
    </div>

    <div class="grid-2 section-gap">
      <section class="card">
        <div class="card-head">
          <div><h3 class="card-title">Últimas movimentações</h3><p class="card-sub">Entregas, devoluções e transferências recentes.</p></div>
          <button type="button" class="btn btn-sm btn-ghost" data-action="go-movimentacoes">Ver todas ${icon('arrowRight')}</button>
        </div>
        <div class="card-body">
          ${movs.length ? `<div class="movement-list">${movs.map(movementItem).join('')}</div>` : emptyState('history', 'Sem movimentações', 'As movimentações aparecerão aqui.')}
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <div><h3 class="card-title">Manutenções abertas</h3><p class="card-sub">Equipamentos indisponíveis até o retorno.</p></div>
          <button type="button" class="btn btn-sm btn-ghost" data-action="go-manutencoes">Ver todas ${icon('arrowRight')}</button>
        </div>
        <div class="card-body">
          ${mans.length ? `<div class="pending-list">${mans.map(manutencaoItem).join('')}</div>` : `<div class="empty-state" style="padding:26px 10px">${icon('wrench','')}<strong>Nenhuma manutenção aberta</strong><p>Os equipamentos disponíveis podem ser enviados para manutenção.</p></div>`}
        </div>
      </section>
    </div>

  `;
  bindDashboardEvents();
}

function statCard(label, value, meta, ico, tone, action) {
  return `<article class="stat-card ${tone || ''}" ${action ? `data-action="${action}" role="button" tabindex="0"` : ''}>
    <div class="stat-top"><span class="stat-label">${esc(label)}</span><span class="stat-icon ${tone || ''}">${icon(ico)}</span></div>
    <div class="stat-value">${fmtQty(value)}</div>
    <div class="stat-meta">${esc(meta)}</div>
  </article>`;
}

function quickAction(action, label, sub, ico, tone) {
  return `<button type="button" class="quick-action ${tone || ''}" data-action="${esc(action)}">
    <span class="quick-action-icon">${icon(ico)}</span>
    <span class="quick-action-body"><strong>${esc(label)}</strong><small>${esc(sub)}</small></span>
  </button>`;
}

function categoryRow(c) {
  const total = Number(c.total) || 0;
  const disp = Number(c.disponivel) || 0;
  const ent = Number(c.entregue) || 0;
  const man = Number(c.manutencao) || 0;
  const base = total || 1;
  return `<button type="button" class="category-row" data-action="filter-category" data-id="${esc(c.id)}" style="border:0;background:none;text-align:left;padding:0;width:100%">
    <span class="category-name">${esc(c.nome)}${c.revisar ? ' <span class="badge gold" style="font-size:9px;padding:2px 5px">revisar</span>' : ''}<span>${plural(total, 'item', 'itens')}</span></span>
    <span class="category-bar" aria-hidden="true"><span class="seg-disp" style="width:${(disp / base) * 100}%"></span><span class="seg-ent" style="width:${(ent / base) * 100}%"></span><span class="seg-man" style="width:${(man / base) * 100}%"></span></span>
    <span class="category-meta"><span><strong>${fmtQty(disp)}</strong> disp.</span><span><strong>${fmtQty(ent)}</strong> entr.</span><span><strong>${fmtQty(man)}</strong> man.</span></span>
  </button>`;
}

function movementItem(m) {
  const cls = movementTypeClass(m.tipo);
  const rota = m.colaboradorOrigemNome || m.colaboradorDestinoNome
    ? `${m.colaboradorOrigemNome ? esc(m.colaboradorOrigemNome) : 'Estoque'} <span class="muted">→</span> ${m.colaboradorDestinoNome ? esc(m.colaboradorDestinoNome) : 'Estoque'}`
    : (m.observacoes ? esc(m.observacoes) : '—');
  return `<div class="movement-item">
    <span class="movement-dot ${cls}">${icon(movementIcon(m.tipo))}</span>
    <div class="movement-body">
      <div class="movement-title">${esc(TIPO_LABEL[m.tipo] || m.tipo)} · <strong>${esc(m.equipamentoCodigo || '')}</strong>${m.quantidade ? ` <span class="muted">(${fmtQty(m.quantidade)})</span>` : ''}</div>
      <div class="movement-sub">${rota}${m.usuarioEmail ? ' · ' + esc(m.usuarioEmail) : ''}</div>
    </div>
    <div class="movement-date">${esc(fmtDate(m.data))}</div>
  </div>`;
}

function pendingItem(l) {
  const acc = (l.acessoriosPendentes || []).map((a) => a.tipo === 'BATERIA' ? plural(a.qtd, 'bateria', 'baterias') : plural(a.qtd, 'carregador', 'carregadores')).join(' · ');
  return `<div class="pending-item">
    <span class="pending-icon">${icon(l.quantidade > 0 ? 'arrowUpRight' : 'battery')}</span>
    <div class="pending-body">
      <div class="pending-title">${esc(l.equipamentoCodigo)} — ${esc(l.equipamentoNome)}</div>
      <div class="pending-sub">${esc(l.colaboradorNome)} · ${l.quantidade > 0 ? `${plural(l.quantidade, 'unidade', 'unidades')} · ` : ''}${esc(fmtDate(l.dataEntrega))}${acc ? ' · ' + esc(acc) : ''}</div>
    </div>
    <div class="pending-actions">
      <button type="button" class="btn btn-sm btn-secondary" data-action="return-loan" data-id="${esc(l.id)}">Devolver</button>
    </div>
  </div>`;
}

function manutencaoItem(m) {
  return `<div class="pending-item">
    <span class="pending-icon">${icon('wrench')}</span>
    <div class="pending-body">
      <div class="pending-title">${esc(m.equipamentoCodigo)} — ${esc(m.equipamentoNome)}</div>
      <div class="pending-sub">${esc(m.defeito || 'Sem defeito informado')} · ${esc(fmtDate(m.dataEnvio))}${m.responsavel ? ' · ' + esc(m.responsavel) : ''}${m.celularResponsavel ? ' · ' + esc(m.celularResponsavel) : ''}</div>
    </div>
    <div class="pending-actions">
      ${isAdmin() ? `<button type="button" class="btn btn-sm btn-secondary" data-action="conclude-maintenance" data-id="${esc(m.id)}">Concluir</button>` : ''}
    </div>
  </div>`;
}

function emptyState(ico, title, text) {
  return `<div class="empty-state"><div class="empty-ico">${icon(ico)}</div><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`;
}

function bindDashboardEvents() {
  // Eventos tratados por delegação global; nada específico necessário.
}

/* ---------- Equipamentos ---------- */
function renderEquipmentView() {
  const main = $('main');
  const cats = (state.data.categorias || []).filter((c) => c.ativo || c.quantidadeEquipamentos > 0);
  const f = state.eqFilters;
  main.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Cadastro e disponibilidade</div><h2>${fmtQty((state.data.equipamentos || []).length)} equipamentos cadastrados</h2><p>Consulte por código, categoria, responsável, marca ou modelo. A disponibilidade é separada da conservação.</p></div>
      <div class="page-actions">${isAdmin() ? `<button type="button" class="btn btn-primary" data-action="new-equipment">${icon('plus')} Novo equipamento</button>` : ''}</div>
    </div>
    <div class="filter-bar">
      <label class="filter-search">${icon('search')}<input id="eqSearch" type="search" placeholder="Buscar código, nome, marca…" value="${esc(f.q)}" autocomplete="off"></label>
      <select class="select" id="eqCategoria" aria-label="Categoria">
        <option value="">Todas as categorias</option>
        ${cats.map((c) => `<option value="${esc(c.id)}" ${f.categoria === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
      </select>
      <select class="select" id="eqStatus" aria-label="Situação">
        <option value="">Todas as situações</option>
        ${['DISPONIVEL','ENTREGUE','PARCIAL','MANUTENCAO','INATIVO'].map((s) => `<option value="${s}" ${f.status === s ? 'selected' : ''}>${esc(STATUS_LABEL[s])}</option>`).join('')}
      </select>
      <select class="select" id="eqConservacao" aria-label="Conservação">
        <option value="">Todas as conservações</option>
        ${Object.keys(CONSERVACAO_LABEL).map((s) => `<option value="${s}" ${f.conservacao === s ? 'selected' : ''}>${esc(CONSERVACAO_LABEL[s])}</option>`).join('')}
      </select>
      <label class="checkbox"><input type="checkbox" id="eqRevisar" ${f.revisar ? 'checked' : ''}> Somente para revisar</label>
      <button type="button" class="filter-clear" data-action="eq-clear">Limpar filtros</button>
      <span class="result-count" id="eqCount"></span>
    </div>
    <div id="eqList"></div>
  `;
  bindEquipmentFilterEvents();
  renderEquipmentList();
}

function filteredEquipment() {
  const f = state.eqFilters;
  const q = norm(f.q);
  return (state.data.equipamentos || []).filter((e) => {
    if (f.categoria && e.categoriaId !== f.categoria) return false;
    if (f.status && e.status !== f.status) return false;
    if (f.conservacao && e.estadoConservacao !== f.conservacao) return false;
    if (f.revisar && !e.revisar) return false;
    if (q) {
      const hay = norm([e.codigo, e.nome, e.categoria, e.marca, e.modelo, e.codigoModelo, e.numeroSerie, e.colaboradorAtual, e.observacoes, e.origemNumero].join(' '));
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });
}

function renderEquipmentList() {
  const el = $('eqList');
  if (!el) return;
  const list = filteredEquipment();
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / state.eqPageSize));
  if (state.eqPage > pages) state.eqPage = pages;
  const start = (state.eqPage - 1) * state.eqPageSize;
  const pageItems = list.slice(start, start + state.eqPageSize);
  const count = $('eqCount');
  if (count) count.innerHTML = `<strong>${fmtQty(total)}</strong> equipamento(s)`;
  if (!total) {
    el.innerHTML = `<div class="card">${emptyState('drill', 'Nenhum equipamento encontrado', 'Ajuste os filtros ou cadastre um novo equipamento.')}</div>`;
    hydrateIcons(el);
    return;
  }
  const rows = pageItems.map((e) => `
    <tr class="clickable" data-action="open-equipment" data-id="${esc(e.id)}">
      <td><span class="cell-code">${esc(e.codigo)}</span>${e.revisar ? '<span class="badge gold review-badge" style="margin-left:6px;font-size:9px;padding:2px 5px">revisar</span>' : ''}<span class="cell-sub">${esc(e.origemNumero ? 'Nº origem ' + e.origemNumero : '')}</span></td>
      <td><span class="cell-main">${esc(e.nome)}</span><span class="cell-sub">${esc([e.marca, e.modelo || e.codigoModelo, e.numeroSerie].filter(Boolean).join(' · ') || 'Sem marca/modelo informado')}</span></td>
      <td>${esc(e.categoria)}</td>
      <td>${statusPill(e.status)}<span class="cell-sub">${fmtQty(e.quantidadeDisponivel)} de ${fmtQty(e.quantidadeTotal)} disp.</span></td>
      <td><span class="badge ${e.estadoConservacao === 'NOVO' ? 'green' : e.estadoConservacao === 'NAO_INFORMADO' ? 'gray' : ''}">${esc(CONSERVACAO_LABEL[e.estadoConservacao] || e.estadoConservacao || '—')}</span>${e.estadoOrigem && e.estadoOrigem !== e.estadoConservacao ? `<span class="cell-sub">origem: ${esc(e.estadoOrigem)}</span>` : ''}</td>
      <td>${e.colaboradorAtual ? `<span class="cell-main">${esc(e.colaboradorAtual)}</span><span class="cell-sub">${e.dataEntregaAtual ? 'desde ' + esc(fmtDate(e.dataEntregaAtual)) : 'data não informada'}</span>` : '<span class="muted">—</span>'}</td>
      <td class="cell-actions">
        <button type="button" class="btn btn-sm btn-secondary" data-action="open-equipment" data-id="${esc(e.id)}">Ver</button>
        ${isAdmin() && e.podeEntregar ? `<button type="button" class="btn btn-sm btn-primary" data-action="deliver-equipment" data-id="${esc(e.id)}">Entregar</button>` : ''}
        ${isAdmin() && e.podeDevolver ? `<button type="button" class="btn btn-sm btn-secondary" data-action="return-equipment" data-id="${esc(e.id)}">Devolver</button>` : ''}
      </td>
    </tr>`).join('');
  const cards = pageItems.map((e) => `
    <article class="eq-card" data-action="open-equipment" data-id="${esc(e.id)}">
      <div class="eq-card-head"><div><div class="eq-card-code">${esc(e.codigo)}</div><div class="eq-card-title">${esc(e.nome)}</div><div class="eq-card-sub">${esc(e.categoria)} · ${esc(e.marca || 'marca não informada')}</div></div>${statusPill(e.status)}</div>
      <dl class="eq-card-grid">
        <div><dt>Disponível</dt><dd>${fmtQty(e.quantidadeDisponivel)} de ${fmtQty(e.quantidadeTotal)}</dd></div>
        <div><dt>Conservação</dt><dd>${esc(CONSERVACAO_LABEL[e.estadoConservacao] || e.estadoConservacao || '—')}</dd></div>
        <div><dt>Responsável</dt><dd>${esc(e.colaboradorAtual || '—')}</dd></div>
        <div><dt>Entrega</dt><dd>${esc(fmtDate(e.dataEntregaAtual))}</dd></div>
      </dl>
      <div class="eq-card-actions">
        <button type="button" class="btn btn-sm btn-secondary" data-action="open-equipment" data-id="${esc(e.id)}">Abrir ficha</button>
        ${isAdmin() && e.podeEntregar ? `<button type="button" class="btn btn-sm btn-primary" data-action="deliver-equipment" data-id="${esc(e.id)}">Entregar</button>` : ''}
        ${e.revisar ? '<span class="badge gold review-badge">revisar</span>' : ''}
      </div>
    </article>`).join('');
  el.innerHTML = `
    <div class="table-wrap desktop-only">
      <table class="data-table">
        <thead><tr><th>Código</th><th>Equipamento</th><th>Categoria</th><th>Situação</th><th>Conservação</th><th>Responsável</th><th style="text-align:right">Ações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="mobile-cards">${cards}</div>
    ${pagination(total, state.eqPage, state.eqPageSize, 'eq-page')}
  `;
  hydrateIcons(el);
}

function pagination(total, page, pageSize, action) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return `<div class="table-foot"><span class="muted">${fmtQty(total)} registro(s)</span></div>`;
  const nums = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);
  if (start > 1) nums.push(1, '…');
  for (let i = start; i <= end; i++) nums.push(i);
  if (end < pages) nums.push('…', pages);
  return `<div class="table-foot"><span class="muted">${fmtQty(total)} registro(s) · página ${page} de ${pages}</span><div class="pagination">
    <button type="button" class="page-btn" data-action="${action}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Página anterior">${icon('chevronLeft')}</button>
    ${nums.map((n) => n === '…' ? '<span class="muted" style="padding:0 4px">…</span>' : `<button type="button" class="page-btn ${n === page ? 'active' : ''}" data-action="${action}" data-page="${n}">${n}</button>`).join('')}
    <button type="button" class="page-btn" data-action="${action}" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="Próxima página">${icon('chevronRight')}</button>
  </div></div>`;
}

function bindEquipmentFilterEvents() {
  const search = $('eqSearch');
  if (search) search.addEventListener('input', debounce((e) => {
    state.eqFilters.q = e.target.value;
    state.eqPage = 1;
    renderEquipmentList();
  }, 220));
  const bindSelect = (id, key) => {
    const el = $(id);
    if (el) el.addEventListener('change', () => { state.eqFilters[key] = el.value; state.eqPage = 1; renderEquipmentList(); });
  };
  bindSelect('eqCategoria', 'categoria');
  bindSelect('eqStatus', 'status');
  bindSelect('eqConservacao', 'conservacao');
  const rev = $('eqRevisar');
  if (rev) rev.addEventListener('change', () => { state.eqFilters.revisar = rev.checked; state.eqPage = 1; renderEquipmentList(); });
}

/* ---------- Movimentações ---------- */
function renderMovementsView() {
  const main = $('main');
  main.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Histórico</div><h2>Entradas e saídas do ferramental</h2><p>Todo o histórico de entregas, devoluções, transferências e manutenção. Nada é apagado ao trocar o responsável.</p></div><div class="page-actions"><button type="button" class="btn btn-secondary" data-action="refresh">${icon('refresh')} Atualizar</button></div></div>
    <form id="movFilterForm" class="filter-bar">
      <label class="filter-search">${icon('search')}<input id="movBusca" type="search" placeholder="Buscar equipamento, colaborador, observação…" value="${esc(state.movFilters.busca)}"></label>
      <select class="select" id="movTipo" aria-label="Tipo">
        <option value="">Todos os tipos</option>
        ${Object.keys(TIPO_LABEL).map((t) => `<option value="${t}" ${state.movFilters.tipo === t ? 'selected' : ''}>${esc(TIPO_LABEL[t])}</option>`).join('')}
      </select>
      <label class="date-filter"><span>De</span><input class="input" type="date" id="movInicio" value="${esc(state.movFilters.dataInicio)}" aria-label="Data inicial"></label>
      <label class="date-filter"><span>Até</span><input class="input" type="date" id="movFim" value="${esc(state.movFilters.dataFim)}" aria-label="Data final"></label>
      <button type="submit" class="btn btn-secondary btn-sm">${icon('filter')} Filtrar</button>
      <button type="button" class="filter-clear" data-action="mov-clear">Limpar</button>
    </form>
    <div id="movList"><div class="card"><div class="card-body">${skeletonRows(6)}</div></div></div>
  `;
  const form = $('movFilterForm');
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); state.movFilters = { tipo: $('movTipo').value, busca: $('movBusca').value, dataInicio: $('movInicio').value, dataFim: $('movFim').value }; state.movPage = 1; loadMovements(1); });
  $('movBusca').addEventListener('input', debounce(() => { state.movFilters.busca = $('movBusca').value; state.movPage = 1; loadMovements(1); }, 300));
  $('movTipo').addEventListener('change', () => { state.movFilters.tipo = $('movTipo').value; state.movPage = 1; loadMovements(1); });
  loadMovements(state.movPage || 1);
}

async function loadMovements(page, opts) {
  opts = opts || {};
  state.movPage = page || 1;
  const key = movFiltersKey(state.movPage);
  const cached = getListCache(key);
  const el = $('movList');
  if (cached) {
    paintMovements(cached.data, el);
    if (!opts.force && Date.now() - cached.at < 60000) return;
  } else if (el) {
    if (state.movData) paintMovements(state.movData, el);
    else el.innerHTML = `<div class="card"><div class="card-body">${skeletonRows(6)}</div></div>`;
  }
  const req = ++state.movReq;
  state.movLoading = true;
  try {
    const data = await apiList('listarMovimentacoes', {
      page: state.movPage, pageSize: 25, tipo: state.movFilters.tipo, busca: state.movFilters.busca,
      dataInicio: state.movFilters.dataInicio, dataFim: state.movFilters.dataFim
    }, key);
    if (req !== state.movReq || state.view !== 'movimentacoes' || key !== movFiltersKey(state.movPage)) return;
    paintMovements(data);
  } catch (e) {
    if (!cached && req === state.movReq && el) {
      el.innerHTML = `<div class="card"><div class="card-body">${emptyState('alert', 'Não foi possível carregar', e.message)}</div></div>`;
      hydrateIcons(el);
    }
  } finally {
    if (req === state.movReq) state.movLoading = false;
  }
}

function paintMovements(data, el) {
  if (state.view !== 'movimentacoes' || !data) return;
  el = el || $('movList');
  if (!el) return;
  state.movData = data;
  if (!data.items.length) {
    el.innerHTML = `<div class="card">${emptyState('history', 'Nenhuma movimentação', 'Ajuste os filtros ou registre a primeira entrega.')}</div>`;
    hydrateIcons(el);
    return;
  }
  el.innerHTML = `
    <div class="table-wrap desktop-only"><table class="data-table">
      <thead><tr><th>Data</th><th>Tipo</th><th>Equipamento</th><th>Origem → destino</th><th>Qtd.</th><th>Usuário</th><th>Observações</th></tr></thead>
      <tbody>${data.items.map((m) => `<tr>
        <td class="nowrap">${esc(fmtDate(m.data))}</td>
        <td><span class="type-chip ${movementTypeClass(m.tipo)}">${icon(movementIcon(m.tipo))} ${esc(TIPO_LABEL[m.tipo] || m.tipo)}</span></td>
        <td><button type="button" class="link-btn" data-action="open-equipment" data-id="${esc(m.equipamentoId)}">${esc(m.equipamentoCodigo)}</button><span class="cell-sub">${esc(m.categoriaNome)}</span></td>
        <td><span class="cell-main">${esc(m.colaboradorOrigemNome || 'Estoque')}</span> <span class="muted">→</span> <span class="cell-main">${esc(m.colaboradorDestinoNome || 'Estoque')}</span></td>
        <td class="cell-qty">${fmtQty(m.quantidade)}</td>
        <td>${esc(m.usuarioEmail || '—')}</td>
        <td><span class="audit-detail">${esc(m.observacoes || '—')}</span></td>
      </tr>`).join('')}</tbody>
    </table></div>
    <div class="mobile-cards">${data.items.map((m) => `<article class="eq-card"><div class="eq-card-head"><div><div class="eq-card-code">${esc(TIPO_LABEL[m.tipo] || m.tipo)} · ${esc(fmtDate(m.data))}</div><div class="eq-card-title">${esc(m.equipamentoCodigo)}</div><div class="eq-card-sub">${esc(m.colaboradorOrigemNome || 'Estoque')} → ${esc(m.colaboradorDestinoNome || 'Estoque')}</div></div><span class="badge">${fmtQty(m.quantidade)} un.</span></div>${m.observacoes ? `<p class="small muted mt-8">${esc(m.observacoes)}</p>` : ''}</article>`).join('')}</div>
    <div class="table-foot"><span class="muted">${fmtQty(data.total)} movimentação(ões) · página ${data.page} de ${data.totalPaginas}</span><div class="pagination">
      <button type="button" class="page-btn" data-action="mov-page" data-page="${data.page - 1}" ${data.page <= 1 ? 'disabled' : ''}>${icon('chevronLeft')}</button>
      <button type="button" class="page-btn" data-action="mov-page" data-page="${data.page + 1}" ${data.page >= data.totalPaginas ? 'disabled' : ''}>${icon('chevronRight')}</button>
    </div></div>`;
  hydrateIcons(el);
}

/* ---------- Manutenções ---------- */
function renderMaintenanceView() {
  const main = $('main');
  main.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Conservação e disponibilidade</div><h2>Conservação e retorno</h2><p>Equipamento em manutenção fica indisponível para entrega. O histórico é preservado.</p></div><div class="page-actions">${isAdmin() ? `<button type="button" class="btn btn-primary" data-action="new-maintenance">${icon('plus')} Nova manutenção</button>` : ''}<button type="button" class="btn btn-secondary" data-action="refresh">${icon('refresh')} Atualizar</button></div></div>
    <div class="filter-bar">
      <label class="filter-search">${icon('search')}<input id="manBusca" type="search" placeholder="Buscar equipamento ou defeito…" value="${esc(state.manFilters.busca)}"></label>
      <select class="select" id="manStatus" aria-label="Situação">
        <option value="">Todas as situações</option>
        ${Object.keys(MAN_LABEL).map((s) => `<option value="${s}" ${state.manFilters.status === s ? 'selected' : ''}>${esc(MAN_LABEL[s])}</option>`).join('')}
      </select>
      <button type="button" class="filter-clear" data-action="man-clear">Limpar</button>
      <span class="result-count" id="manCount"></span>
    </div>
    <div id="manList"><div class="card"><div class="card-body">${skeletonRows(4)}</div></div></div>
  `;
  $('manBusca').addEventListener('input', debounce(() => { state.manFilters.busca = $('manBusca').value; loadMaintenances(); }, 280));
  $('manStatus').addEventListener('change', () => { state.manFilters.status = $('manStatus').value; loadMaintenances(); });
  loadMaintenances();
}

async function loadMaintenances(opts) {
  opts = opts || {};
  const key = manFiltersKey();
  const cached = getListCache(key);
  const el = $('manList');
  if (cached) {
    paintMaintenances(cached.data, el);
    if (!opts.force && Date.now() - cached.at < 60000) return;
  } else if (el) {
    if (state.manData) paintMaintenances(state.manData, el);
    else el.innerHTML = `<div class="card"><div class="card-body">${skeletonRows(4)}</div></div>`;
  }
  const req = ++state.manReq;
  state.manLoading = true;
  try {
    const data = await apiList('listarManutencoes', {
      status: state.manFilters.status, busca: state.manFilters.busca
    }, key);
    if (req !== state.manReq || state.view !== 'manutencoes' || key !== manFiltersKey()) return;
    paintMaintenances(data);
  } catch (e) {
    if (!cached && req === state.manReq && el) {
      el.innerHTML = `<div class="card"><div class="card-body">${emptyState('alert', 'Não foi possível carregar', e.message)}</div></div>`;
      hydrateIcons(el);
    }
  } finally {
    if (req === state.manReq) state.manLoading = false;
  }
}

function paintMaintenances(data, el) {
  if (state.view !== 'manutencoes' || !data) return;
  el = el || $('manList');
  if (!el) return;
  state.manData = data;
  const count = $('manCount'); if (count) count.innerHTML = `<strong>${fmtQty(data.total)}</strong> registro(s)`;
  if (!data.items.length) {
    el.innerHTML = `<div class="card">${emptyState('wrench', 'Nenhuma manutenção encontrada', 'Ajuste os filtros ou envie um equipamento para manutenção.')}</div>`;
    hydrateIcons(el);
    return;
  }
  el.innerHTML = `<div class="entity-grid">${data.items.map(manCard).join('')}</div>`;
  hydrateIcons(el);
}

function manCard(m) {
  const admin = isAdmin();
  return `<article class="entity-card">
    <div class="entity-head"><div><div class="entity-title">${esc(m.equipamentoCodigo)} — ${esc(m.equipamentoNome)}</div><div class="entity-sub">${esc(m.categoriaNome)} · envio ${esc(fmtDate(m.dataEnvio))}</div></div>${manPill(m.status)}</div>
    <div class="small"><strong>Defeito:</strong> ${esc(m.defeito || 'não informado')}</div>
    <div class="small muted">Responsável: ${esc(m.responsavel || 'não informado')}${m.celularResponsavel ? ' · ' + esc(m.celularResponsavel) : ''}${m.previsaoRetorno ? ' · previsão ' + esc(fmtDate(m.previsaoRetorno)) : ''}${m.dataRetorno ? ' · retorno ' + esc(fmtDate(m.dataRetorno)) : ''}</div>
    <div class="entity-metrics"><div class="entity-metric"><strong>${fmtMoney(m.custo)}</strong>custo</div><div class="entity-metric"><strong>${esc(m.estadoRetorno || '—')}</strong>estado retorno</div></div>
    ${m.observacoes ? `<div class="entity-note">${esc(m.observacoes)}</div>` : ''}
    ${m.revisar ? `<div class="alert alert-warn small">${icon('alert')}<div>${esc(m.motivoRevisao || 'Revisar dados importados.')}</div></div>` : ''}
    <div class="entity-actions">
      <button type="button" class="btn btn-sm btn-secondary" data-action="open-equipment" data-id="${esc(m.equipamentoId)}">Ver equipamento</button>
      ${admin && m.aberta ? `<button type="button" class="btn btn-sm btn-secondary" data-action="edit-maintenance" data-id="${esc(m.id)}">Editar</button><button type="button" class="btn btn-sm btn-primary" data-action="conclude-maintenance" data-id="${esc(m.id)}">Concluir</button><button type="button" class="btn btn-sm btn-ghost" data-action="cancel-maintenance" data-id="${esc(m.id)}">Cancelar</button>` : ''}
    </div>
  </article>`;
}

/* ---------- Colaboradores ---------- */
function renderCollaboratorsView() {
  const main = $('main');
  const q = norm(state.colabSearch);
  const list = (state.data.colaboradores || []).filter((c) => !q || norm([c.nome, c.tipo, c.funcao, c.email, c.telefone, c.localObra].join(' ')).indexOf(q) >= 0);
  main.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Responsáveis</div><h2>Quem está com o quê</h2><p>Pessoas, grupos e locais que recebem equipamentos. Cadastrar um colaborador não cria acesso ao sistema.</p></div><div class="page-actions">${isAdmin() ? `<button type="button" class="btn btn-primary" data-action="new-collaborator">${icon('userPlus')} Novo colaborador</button>` : ''}</div></div>
    <div class="filter-bar"><label class="filter-search">${icon('search')}<input id="colabSearch" type="search" placeholder="Buscar nome, função, local ou contato…" value="${esc(state.colabSearch)}"></label><span class="result-count"><strong>${fmtQty(list.length)}</strong> colaborador(es)</span></div>
    ${list.length ? `<div class="entity-grid">${list.map(colabCard).join('')}</div>` : `<div class="card">${emptyState('users', 'Nenhum colaborador encontrado', 'Ajuste a busca ou cadastre um novo colaborador.')}</div>`}
  `;
  $('colabSearch').addEventListener('input', debounce((e) => { state.colabSearch = e.target.value; renderCollaboratorsView(); }, 220));
  hydrateIcons(main);
}

function colabCard(c) {
  const admin = isAdmin();
  return `<article class="entity-card" style="${c.ativo ? '' : 'opacity:.72;'}">
    <div class="entity-head"><div class="flex"><span class="avatar">${esc(initials(c.nome))}</span><div><div class="entity-title">${esc(c.nome)}</div><div class="entity-sub">${esc(TIPO_COLAB_LABEL[c.tipo] || c.tipo || 'Não informado')}${c.funcao ? ' · ' + esc(c.funcao) : ''}</div></div></div><span class="badge ${c.ativo ? 'green' : 'gray'}">${c.ativo ? 'Ativo' : 'Inativo'}</span></div>
    <div class="small muted">${c.email ? esc(c.email) : ''}${c.telefone ? (c.email ? ' · ' : '') + esc(c.telefone) : ''}${!c.email && !c.telefone ? 'Sem contato informado' : ''}</div>
    ${(c.localObra || c.setor) ? `<div class="small muted">${c.localObra ? `${icon('mapPin')} ${esc(c.localObra)}` : ''}${c.localObra && c.setor ? ' · ' : ''}${c.setor ? 'Setor: ' + esc(c.setor) : ''}</div>` : ''}
    <div class="entity-metrics"><div class="entity-metric"><strong>${fmtQty(c.equipamentosAtuais)}</strong>equipamento(s)</div><div class="entity-metric"><strong>${fmtQty(c.emprestimosAbertos)}</strong>empréstimo(s)</div><div class="entity-metric"><strong>${fmtQty(c.acessoriosPendentes)}</strong>acessório(s)</div></div>
    <div class="entity-actions">
      <button type="button" class="btn btn-sm btn-secondary" data-action="filter-colaborador" data-name="${esc(c.nome)}">Ver equipamentos</button>
      ${admin ? `<button type="button" class="btn btn-sm btn-ghost" data-action="edit-collaborator" data-id="${esc(c.id)}">Editar</button>
      ${c.ativo ? `<button type="button" class="btn btn-sm btn-ghost" data-action="inactivate-collaborator" data-id="${esc(c.id)}">Inativar</button>` : `<button type="button" class="btn btn-sm btn-ghost" data-action="reactivate-collaborator" data-id="${esc(c.id)}">Reativar</button>`}
      <button type="button" class="btn btn-sm btn-ghost" data-action="delete-collaborator" data-id="${esc(c.id)}">Excluir</button>` : ''}
    </div>
  </article>`;
}

/* ---------- Categorias ---------- */
function renderCategoriesView() {
  const main = $('main');
  const list = state.data.categorias || [];
  main.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Estrutura</div><h2>Estrutura do controle</h2><p>Cada categoria tem seu próprio rótulo de item. Códigos iguais em categorias diferentes não são o mesmo equipamento.</p></div><div class="page-actions">${isAdmin() ? `<button type="button" class="btn btn-primary" data-action="new-category">${icon('plus')} Nova categoria/aba</button>` : ''}</div></div>
    ${list.length ? `<div class="entity-grid">${list.map(catCard).join('')}</div>` : `<div class="card">${emptyState('tag', 'Nenhuma categoria', 'Cadastre a primeira categoria.')}</div>`}
  `;
  hydrateIcons(main);
}

function catCard(c) {
  const admin = isAdmin();
  return `<article class="entity-card" style="${c.ativo ? '' : 'opacity:.72;'}">
    <div class="entity-head"><div><div class="entity-title">${esc(c.nome)}</div><div class="entity-sub">Prefixo ${esc(c.prefixo || '—')} · campo “${esc(c.campoItem || 'ITEM')}”${c.nomeAba ? ' · aba ' + esc(c.nomeAba) : ''}</div></div><span class="badge ${c.ativo ? 'green' : 'gray'}">${c.ativo ? 'Ativa' : 'Inativa'}</span></div>
    <div class="entity-metrics"><div class="entity-metric"><strong>${fmtQty(c.quantidadeEquipamentos)}</strong>cadastro(s)</div><div class="entity-metric"><strong>${fmtQty(c.quantidadeDisponivel)}</strong>disponível(is)</div><div class="entity-metric"><strong>${fmtQty(c.quantidadeEntregue)}</strong>entregue(s)</div><div class="entity-metric"><strong>${fmtQty(c.quantidadeManutencao)}</strong>manutenção</div></div>
    ${c.observacaoImportacao ? `<div class="entity-note">${esc(c.observacaoImportacao)}</div>` : ''}
    ${c.observacaoOrigem ? `<div class="small muted">Observação da origem: ${esc(c.observacaoOrigem)}</div>` : ''}
    <div class="entity-actions">
      <button type="button" class="btn btn-sm btn-secondary" data-action="filter-category" data-id="${esc(c.id)}">Ver equipamentos</button>
      ${admin ? `<button type="button" class="btn btn-sm btn-ghost" data-action="edit-category" data-id="${esc(c.id)}">Editar</button>
      ${c.ativo ? `<button type="button" class="btn btn-sm btn-ghost" data-action="inactivate-category" data-id="${esc(c.id)}">Inativar</button>` : `<button type="button" class="btn btn-sm btn-ghost" data-action="reactivate-category" data-id="${esc(c.id)}">Reativar</button>`}
      <button type="button" class="btn btn-sm btn-ghost" data-action="delete-category" data-id="${esc(c.id)}">Excluir</button>` : ''}
    </div>
  </article>`;
}

/* ---------- Usuários ---------- */
function renderUsersView() {
  if (!isAdmin()) { setView('dashboard'); return; }
  const main = $('main');
  const users = state.data.usuarios || [];
  const pendentes = users.filter((u) => u.status === 'PENDENTE');
  main.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Segurança</div><h2>Acessos e permissões</h2><p>Contas de acesso ao sistema. Cadastros feitos pela tela de login ficam pendentes até a aprovação do administrador.</p></div><div class="page-actions"><button type="button" class="btn btn-primary" data-action="new-user">${icon('userPlus')} Novo usuário</button></div></div>
    <div class="users-toolbar">
      <div class="flex flex-wrap"><span class="badge">${fmtQty(users.length)} conta(s)</span><span class="badge green">${fmtQty(users.filter((u) => u.status === 'ATIVO').length)} ativa(s)</span><span class="badge gray">${fmtQty(users.filter((u) => u.perfil === 'ADMINISTRADOR').length)} administrador(es)</span>${pendentes.length ? `<span class="badge pending">${fmtQty(pendentes.length)} pendente(s)</span>` : ''}</div>
      <button type="button" class="btn btn-sm btn-secondary" id="toggleUsers" aria-expanded="${!state.usersCollapsed}">${state.usersCollapsed ? 'Mostrar lista' : 'Ocultar lista'}</button>
    </div>
    ${pendentes.length ? `<div class="alert alert-warn users-pending">${icon('alert')}<div><strong>${fmtQty(pendentes.length)} cadastro(s) aguardando aprovação.</strong> Aprove para liberar o acesso somente de consulta.</div><button type="button" class="btn btn-sm btn-primary" data-action="show-pending">Mostrar pendentes</button></div>` : ''}
    <div id="usersList" class="${state.usersCollapsed ? 'users-collapsed' : ''}">
      ${users.length ? `<div class="user-list">${users.map(userRow).join('')}</div>` : `<div class="card">${emptyState('shield', 'Nenhuma conta', 'Crie o primeiro usuário.')}</div>`}
      <div class="users-empty-hint">${pendentes.length ? `${fmtQty(pendentes.length)} cadastro(s) pendente(s). ` : ''}Lista de usuários oculta. Use “Mostrar lista” para exibir as contas.</div>
    </div>
  `;
  $('toggleUsers').addEventListener('click', () => {
    state.usersCollapsed = !state.usersCollapsed;
    localStorage.setItem(USERS_COLLAPSED_KEY, state.usersCollapsed ? '1' : '0');
    const list = $('usersList');
    const btn = $('toggleUsers');
    list.classList.toggle('users-collapsed', state.usersCollapsed);
    btn.textContent = state.usersCollapsed ? 'Mostrar lista' : 'Ocultar lista';
    btn.setAttribute('aria-expanded', String(!state.usersCollapsed));
  });
  hydrateIcons(main);
}

function userRow(u) {
  const self = state.user && u.id === state.user.id;
  const pendente = u.status === 'PENDENTE';
  const statusBadge = pendente
    ? '<span class="badge pending">Pendente</span>'
    : `<span class="badge ${u.status === 'ATIVO' ? 'green' : 'red'}">${u.status === 'ATIVO' ? 'Ativo' : 'Bloqueado'}</span>`;
  return `<div class="user-row">
    <span class="avatar">${esc(initials(u.nome))}</span>
    <div class="user-row-info"><strong>${esc(u.nome)}${self ? ' <span class="badge gray" style="font-size:9px;padding:2px 5px">você</span>' : ''}</strong><span>${esc(u.email)} · ${esc(roleLabel(u.perfil))}${u.ultimoAcesso ? ' · último acesso ' + esc(fmtDateTime(u.ultimoAcesso)) : ''}</span></div>
    ${statusBadge}
    <div class="user-row-actions">
      ${pendente ? `<button type="button" class="btn btn-sm btn-primary" data-action="approve-user" data-id="${esc(u.id)}">Aprovar</button><button type="button" class="btn btn-sm btn-ghost" data-action="reject-user" data-id="${esc(u.id)}">Recusar</button>` : ''}
      <button type="button" class="btn btn-sm btn-ghost" data-action="edit-user" data-id="${esc(u.id)}">Editar</button>
      ${!pendente ? `<button type="button" class="btn btn-sm btn-ghost" data-action="reset-user-password" data-id="${esc(u.id)}">Redefinir senha</button>` : ''}
      ${!self && !pendente ? (u.status === 'ATIVO' ? `<button type="button" class="btn btn-sm btn-ghost" data-action="block-user" data-id="${esc(u.id)}">Bloquear</button>` : `<button type="button" class="btn btn-sm btn-ghost" data-action="unblock-user" data-id="${esc(u.id)}">Desbloquear</button>`) : ''}
    </div>
  </div>`;
}

/* ---------- Auditoria ---------- */
function renderAuditView() {
  if (!isAdmin()) { setView('dashboard'); return; }
  const main = $('main');
  main.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Rastreabilidade</div><h2>Rastreabilidade das ações</h2><p>Registro das ações administrativas, com data, usuário e identificação do registro.</p></div><div class="page-actions"><button type="button" class="btn btn-secondary" data-action="refresh">${icon('refresh')} Atualizar</button></div></div>
    <div class="filter-bar"><label class="filter-search">${icon('search')}<input id="auditBusca" type="search" placeholder="Buscar usuário, ação, entidade…" value="${esc(state.auditBusca)}"></label><span class="result-count" id="auditCount"></span></div>
    <div id="auditList"><div class="card"><div class="card-body">${skeletonRows(6)}</div></div></div>
  `;
  $('auditBusca').addEventListener('input', debounce(() => { state.auditBusca = $('auditBusca').value; state.auditPage = 1; loadAudit(1); }, 300));
  loadAudit(state.auditPage || 1);
}

async function loadAudit(page, opts) {
  opts = opts || {};
  state.auditPage = page || 1;
  if (!isAdmin()) return;
  const key = auditFiltersKey(state.auditPage);
  const cached = getListCache(key);
  const el = $('auditList');
  if (cached) {
    paintAudit(cached.data, el);
    if (!opts.force && Date.now() - cached.at < 60000) return;
  } else if (el) {
    if (state.auditData) paintAudit(state.auditData, el);
    else el.innerHTML = `<div class="card"><div class="card-body">${skeletonRows(6)}</div></div>`;
  }
  const req = ++state.auditReq;
  state.auditLoading = true;
  try {
    const data = await apiList('listarAuditoria', {
      page: state.auditPage, pageSize: 30, busca: state.auditBusca
    }, key);
    if (req !== state.auditReq || state.view !== 'auditoria' || key !== auditFiltersKey(state.auditPage)) return;
    paintAudit(data);
  } catch (e) {
    if (!cached && req === state.auditReq && el) {
      el.innerHTML = `<div class="card"><div class="card-body">${emptyState('alert', 'Não foi possível carregar', e.message)}</div></div>`;
      hydrateIcons(el);
    }
  } finally {
    if (req === state.auditReq) state.auditLoading = false;
  }
}

function paintAudit(data, el) {
  if (state.view !== 'auditoria' || !data) return;
  el = el || $('auditList');
  if (!el) return;
  state.auditData = data;
  const count = $('auditCount'); if (count) count.innerHTML = `<strong>${fmtQty(data.total)}</strong> registro(s)`;
  if (!data.items.length) {
    el.innerHTML = `<div class="card">${emptyState('history', 'Nenhum registro', 'As ações administrativas aparecerão aqui.')}</div>`;
    hydrateIcons(el);
    return;
  }
  el.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Detalhes</th><th>Origem</th></tr></thead><tbody>
    ${data.items.map((a) => `<tr><td class="nowrap">${esc(fmtDateTime(a.DATA))}</td><td><span class="cell-main">${esc(a.USUARIO_EMAIL || '—')}</span><span class="cell-sub">${esc(a.PERFIL || '')}</span></td><td><span class="badge">${esc(a.ACAO)}</span></td><td>${esc(a.ENTIDADE)}<span class="cell-sub">${esc(a.ENTIDADE_ID || '')}</span></td><td><span class="audit-detail">${esc(a.DETALHES || '—')}</span></td><td>${esc(a.ORIGEM || 'APP')}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="table-foot"><span class="muted">${fmtQty(data.total)} registro(s) · página ${data.page} de ${data.totalPaginas}</span><div class="pagination"><button type="button" class="page-btn" data-action="audit-page" data-page="${data.page - 1}" ${data.page <= 1 ? 'disabled' : ''}>${icon('chevronLeft')}</button><button type="button" class="page-btn" data-action="audit-page" data-page="${data.page + 1}" ${data.page >= data.totalPaginas ? 'disabled' : ''}>${icon('chevronRight')}</button></div></div>`;
  hydrateIcons(el);
}

function skeletonRows(n) {
  return Array.from({ length: n }, () => '<div class="skeleton skeleton-row"></div>').join('');
}

/* ---------- Detalhe do equipamento ---------- */
async function openEquipment(id, tab) {
  if (!id) return;
  state.detailId = id;
  state.detailTab = tab || state.detailTab || 'resumo';
  state.detailLoading = true;
  renderDetailDrawer();
  try {
    const data = await api('detalheEquipamento', { id });
    state.detail = data;
    state.detailLoading = false;
    renderDetailDrawer();
  } catch (e) {
    state.detailLoading = false;
    closeDetail();
    showToast(e.message, 'error');
  }
}

function closeDetail() {
  state.detail = null;
  state.detailId = '';
  state.detailLoading = false;
  const root = $('detailRoot');
  if (root) root.remove();
  document.body.style.overflow = '';
}

function renderDetailDrawer() {
  let root = $('detailRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'detailRoot';
    document.body.appendChild(root);
  }
  const d = state.detail;
  const eq = d ? d.equipamento : null;
  const tab = state.detailTab || 'resumo';
  const admin = isAdmin();
  root.innerHTML = `<div class="drawer-backdrop" data-action="close-detail"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="Ficha do equipamento">
      <div class="drawer-head">
        <div class="drawer-head-top">
          <div style="min-width:0">
            ${eq ? `<div class="drawer-code">${esc(eq.codigo)}</div><h2 class="drawer-title">${esc(eq.nome)}</h2><p class="drawer-sub">${esc(eq.categoria)}${eq.marca ? ' · ' + esc(eq.marca) : ''}${eq.modelo || eq.codigoModelo ? ' · ' + esc(eq.modelo || eq.codigoModelo) : ''}</p>
            <div class="drawer-badges">${statusPill(eq.status)}<span class="badge">${esc(CONSERVACAO_LABEL[eq.estadoConservacao] || eq.estadoConservacao)}</span>${eq.revisar ? '<span class="badge gold review-badge">revisar</span>' : ''}<span class="badge gray">${fmtQty(eq.quantidadeDisponivel)} de ${fmtQty(eq.quantidadeTotal)} disp.</span></div>` : `<div class="drawer-code">CARREGANDO</div><h2 class="drawer-title">Abrindo ficha…</h2>`}
          </div>
          <button type="button" class="icon-btn" data-action="close-detail" aria-label="Fechar">${icon('x')}</button>
        </div>
      </div>
      ${state.detailLoading ? `<div class="drawer-body">${skeletonRows(8)}</div>` : drawDetailBody(eq, d, tab, admin)}
      ${eq ? `<div class="drawer-foot">${detailFooterButtons(eq, admin)}</div>` : ''}
    </aside>`;
}

function drawDetailBody(eq, d, tab, admin) {
  if (!eq) return '';
  const tabs = [
    ['resumo', 'Resumo'], ['historico', 'Histórico'], ['emprestimos', 'Empréstimos'], ['manutencoes', 'Manutenções'],
  ];
  let body = '';
  if (tab === 'historico') {
    body = d.movimentacoes.length ? `<div class="timeline">${d.movimentacoes.map(timelineItem).join('')}</div>` : emptyState('history', 'Sem histórico', 'Nenhuma movimentação registrada para este equipamento.');
  } else if (tab === 'emprestimos') {
    body = d.emprestimos.length ? `<div class="pending-list">${d.emprestimos.map(loanDetailItem).join('')}</div>` : emptyState('arrowUpRight', 'Sem empréstimos', 'Nenhum empréstimo registrado.');
  } else if (tab === 'manutencoes') {
    body = d.manutencoes.length ? `<div class="pending-list">${d.manutencoes.map(manDetailItem).join('')}</div>` : emptyState('wrench', 'Sem manutenções', 'Nenhuma manutenção registrada.');
  } else {
    body = `
      ${eq.revisar ? `<div class="alert alert-warn mb-12">${icon('alert')}<div><strong>Revisar informação importada.</strong><br>${esc(eq.motivoRevisao || 'A origem tem dados ambíguos.')} ${admin ? `<button type="button" class="link-btn" data-action="review-equipment" data-id="${esc(eq.id)}">Marcar como revisado</button>` : ''}</div></div>` : ''}
      <div class="detail-grid">
        <div class="detail-item"><dt>Categoria</dt><dd>${esc(eq.categoria)}</dd></div>
        <div class="detail-item"><dt>Código do modelo</dt><dd>${esc(eq.codigoModelo || '—')}</dd></div>
        <div class="detail-item"><dt>Marca</dt><dd>${esc(eq.marca || '—')}</dd></div>
        <div class="detail-item"><dt>Modelo</dt><dd>${esc(eq.modelo || '—')}</dd></div>
        <div class="detail-item"><dt>Número de série</dt><dd>${esc(eq.numeroSerie || '—')}</dd></div>
        <div class="detail-item"><dt>Conservação</dt><dd>${esc(CONSERVACAO_LABEL[eq.estadoConservacao] || eq.estadoConservacao)}${eq.estadoOrigem && eq.estadoOrigem !== eq.estadoConservacao ? ` <span class="muted small">(origem: ${esc(eq.estadoOrigem)})</span>` : ''}</dd></div>
        <div class="detail-item"><dt>Disponível</dt><dd>${fmtQty(eq.quantidadeDisponivel)} de ${fmtQty(eq.quantidadeTotal)} · ${fmtQty(eq.quantidadeEmUso)} em uso</dd></div>
        <div class="detail-item"><dt>Responsável atual</dt><dd>${esc(eq.colaboradorAtual || '—')}</dd></div>
        <div class="detail-item"><dt>Entrega atual</dt><dd>${esc(fmtDate(eq.dataEntregaAtual))}</dd></div>
        <div class="detail-item"><dt>Origem</dt><dd>${esc(eq.origemAba ? `${eq.origemAba} · linha ${eq.origemLinha}` : 'Cadastro pelo aplicativo')}${eq.origemNumero ? ` · Nº ${esc(eq.origemNumero)}` : ''}</dd></div>
        <div class="detail-item"><dt>Criado em</dt><dd>${esc(fmtDateTime(eq.criadoEm))}</dd></div>
        <div class="detail-item"><dt>Atualizado em</dt><dd>${esc(fmtDateTime(eq.atualizadoEm))}</dd></div>
      </div>
      <div class="detail-section"><h3>Acessórios cadastrados</h3><div class="accessory-list">${eq.acessorios.length ? eq.acessorios.map((a) => `<span class="accessory-chip">${icon(a.tipo === 'BATERIA' ? 'battery' : 'plug')} <b>${esc(a.tipo === 'BATERIA' ? 'Bateria' : 'Carregador')}</b> ${esc(a.codigo)} · ${fmtQty(a.qtd)}</span>`).join('') : '<span class="muted small">Nenhum acessório cadastrado.</span>'}</div></div>
      ${eq.acessoriosPendentes.length ? `<div class="detail-section"><h3>Acessórios pendentes</h3><div class="accessory-list">${eq.acessoriosPendentes.map((a) => `<span class="accessory-chip pending">${icon(a.tipo === 'BATERIA' ? 'battery' : 'plug')} ${esc(a.tipo === 'BATERIA' ? 'Bateria' : 'Carregador')} ${esc(a.codigo)} · ${fmtQty(a.qtd)}</span>`).join('')}</div>${eq.pendencias.length ? `<div class="small muted mt-8">${eq.pendencias.map((p) => `${esc(p.colaborador)}: ${p.acessorios.map((a) => a.tipo === 'BATERIA' ? plural(a.qtd, 'bateria', 'baterias') : plural(a.qtd, 'carregador', 'carregadores')).join(', ')}`).join(' · ')}</div>` : ''}</div>` : ''}
      ${eq.observacoes ? `<div class="detail-section"><h3>Observações</h3><div class="detail-note">${esc(eq.observacoes)}</div></div>` : ''}
    `;
  }
  return `<div class="drawer-tabs">${tabs.map(([k, l]) => `<button type="button" class="drawer-tab ${tab === k ? 'active' : ''}" data-action="detail-tab" data-tab="${k}">${l}</button>`).join('')}</div><div class="drawer-body">${body}</div>`;
}

function detailFooterButtons(eq, admin) {
  if (!admin) return `<button type="button" class="btn btn-secondary" data-action="close-detail">Fechar</button>`;
  return `
    ${eq.podeEntregar ? `<button type="button" class="btn btn-primary btn-sm" data-action="deliver-equipment" data-id="${esc(eq.id)}">${icon('arrowUpRight')} Entregar</button>` : ''}
    ${eq.podeDevolver ? `<button type="button" class="btn btn-secondary btn-sm" data-action="return-equipment" data-id="${esc(eq.id)}">${icon('check')} Devolver</button>` : ''}
    ${eq.podeTransferir ? `<button type="button" class="btn btn-secondary btn-sm" data-action="transfer-equipment" data-id="${esc(eq.id)}">${icon('swap')} Transferir</button>` : ''}
    ${eq.podeManutencao ? `<button type="button" class="btn btn-secondary btn-sm" data-action="maintenance-equipment" data-id="${esc(eq.id)}">${icon('wrench')} Manutenção</button>` : ''}
    <button type="button" class="btn btn-secondary btn-sm" data-action="edit-equipment" data-id="${esc(eq.id)}">${icon('edit')} Editar</button>
    ${eq.status === 'INATIVO' ? `<button type="button" class="btn btn-secondary btn-sm" data-action="reactivate-equipment" data-id="${esc(eq.id)}">${icon('rotate')} Reativar</button>` : (eq.podeInativar ? `<button type="button" class="btn btn-secondary btn-sm" data-action="inactivate-equipment" data-id="${esc(eq.id)}">${icon('lock')} Inativar</button>` : '')}
    ${eq.podeExcluir ? `<button type="button" class="btn btn-danger btn-sm" data-action="delete-equipment" data-id="${esc(eq.id)}">${icon('trash')} Excluir</button>` : ''}
  `;
}

function timelineItem(m) {
  return `<div class="timeline-item">
    <span class="timeline-dot ${movementTypeClass(m.tipo)}"></span>
    <div class="timeline-head"><span class="timeline-title">${esc(TIPO_LABEL[m.tipo] || m.tipo)}</span><span class="timeline-date">${esc(fmtDate(m.data))}</span></div>
    <div class="timeline-body">${esc(m.colaboradorOrigemNome || 'Estoque')} → ${esc(m.colaboradorDestinoNome || 'Estoque')}${m.quantidade ? ' · ' + plural(m.quantidade, 'unidade', 'unidades') : ''}${m.observacoes ? '<br>' + esc(m.observacoes) : ''}</div>
    <div class="timeline-tags">${m.estadoConservacao ? `<span class="badge gray">${esc(CONSERVACAO_LABEL[m.estadoConservacao] || m.estadoConservacao)}</span>` : ''}${m.usuarioEmail ? `<span class="badge gray">${esc(m.usuarioEmail)}</span>` : ''}</div>
  </div>`;
}

function loanDetailItem(l) {
  const admin = isAdmin();
  return `<div class="pending-item">
    <span class="pending-icon">${icon(l.status === 'ABERTO' ? 'arrowUpRight' : l.status === 'TRANSFERIDO' ? 'swap' : 'check')}</span>
    <div class="pending-body">
      <div class="pending-title">${esc(l.colaboradorNome)} · ${loanPill(l.status)}</div>
      <div class="pending-sub">${plural(l.quantidade, 'unidade', 'unidades')} · entrega ${esc(fmtDate(l.dataEntrega))}${l.dataDevolucaoEquipamento ? ' · devolução ' + esc(fmtDate(l.dataDevolucaoEquipamento)) : ''}${l.totalPendente ? ' · ' + plural(l.totalPendente, 'acessório pendente', 'acessórios pendentes') : ''}</div>
      ${l.acessoriosPendentes.length ? `<div class="accessory-list mt-8">${l.acessoriosPendentes.map((a) => `<span class="accessory-chip pending">${esc(a.tipo === 'BATERIA' ? 'Bateria' : 'Carregador')} ${esc(a.codigo)} · ${fmtQty(a.qtd)}</span>`).join('')}</div>` : ''}
      ${l.observacoes ? `<div class="small muted mt-8">${esc(l.observacoes)}</div>` : ''}
    </div>
    ${admin && l.status === 'ABERTO' ? `<div class="pending-actions"><button type="button" class="btn btn-sm btn-secondary" data-action="return-loan" data-id="${esc(l.id)}">Devolver</button>${l.quantidade > 0 ? `<button type="button" class="btn btn-sm btn-ghost" data-action="transfer-loan" data-id="${esc(l.id)}">Transferir</button>` : ''}</div>` : ''}
  </div>`;
}

function manDetailItem(m) {
  const admin = isAdmin();
  return `<div class="pending-item">
    <span class="pending-icon">${icon('wrench')}</span>
    <div class="pending-body">
      <div class="pending-title">${esc(m.status)} · ${esc(fmtDate(m.dataEnvio))}</div>
      <div class="pending-sub">${esc(m.defeito || 'Sem defeito informado')}${m.responsavel ? ' · ' + esc(m.responsavel) : ''}${m.celularResponsavel ? ' · ' + esc(m.celularResponsavel) : ''}${m.servico ? ' · ' + esc(m.servico) : ''}${m.custo !== '' ? ' · ' + fmtMoney(m.custo) : ''}</div>
      ${m.observacoes ? `<div class="small muted mt-8">${esc(m.observacoes)}</div>` : ''}
    </div>
    ${admin && m.aberta ? `<div class="pending-actions"><button type="button" class="btn btn-sm btn-secondary" data-action="edit-maintenance" data-id="${esc(m.id)}">Editar</button><button type="button" class="btn btn-sm btn-primary" data-action="conclude-maintenance" data-id="${esc(m.id)}">Concluir</button></div>` : ''}
  </div>`;
}

/* ---------- Modais base ---------- */
function openModal(opts) {
  const root = $('modalRoot');
  const size = opts.size === 'sm' ? 'modal-sm' : opts.size === 'lg' ? 'modal-lg' : '';
  root.innerHTML = `<div class="modal-backdrop" data-modal-backdrop="1">
    <div class="modal-card ${size}" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-head"><div><h2 id="modalTitle">${esc(opts.title || '')}</h2>${opts.subtitle ? `<p>${esc(opts.subtitle)}</p>` : ''}</div><button type="button" class="icon-btn modal-close" data-action="close-modal" aria-label="Fechar">${icon('x')}</button></div>
      <div id="modalError" class="form-message error modal-error" style="display:none"></div>
      <div class="modal-body">${opts.body || ''}</div>
      ${opts.foot ? `<div class="modal-foot">${opts.foot}</div>` : ''}
    </div>
  </div>`;
  hydrateIcons(root);
  document.body.style.overflow = 'hidden';
  const first = root.querySelector('input:not([type=hidden]), select, textarea, button');
  if (first) setTimeout(() => first.focus(), 60);
  if (typeof opts.onMount === 'function') opts.onMount(root);
}

function closeModal() {
  const root = $('modalRoot');
  if (root) root.innerHTML = '';
  if (!$('detailRoot')) document.body.style.overflow = '';
}

function openConfirm(opts) {
  const danger = !!opts.danger;
  openModal({
    title: opts.title || 'Confirmar',
    subtitle: opts.subtitle || '',
    size: 'sm',
    body: `<div class="alert ${danger ? 'alert-danger' : 'alert-warn'}">${icon(danger ? 'alert' : 'info')}<div>${opts.message || ''}</div></div>`,
    foot: `<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="button" class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" id="confirmActionBtn">${esc(opts.confirmLabel || 'Confirmar')}</button>`,
    onMount: () => {
      $('confirmActionBtn').addEventListener('click', async (ev) => {
        const btn = ev.currentTarget;
        await runAction(btn, opts.action, opts.payload, { successMsg: opts.successMsg, detailId: opts.detailId, modal: true, onSuccess: opts.onSuccess });
      });
    },
  });
}

async function runAction(btn, action, payload, opts) {
  opts = opts || {};
  if (btn && btn.disabled) return;
  const ridKey = action + ':' + JSON.stringify(payload || {});
  let rid = btn && btn.dataset.requestId;
  if (!rid) { rid = state.pendingRequestIds[ridKey] || genId(); state.pendingRequestIds[ridKey] = rid; }
  if (btn) { btn.dataset.requestId = rid; setButtonBusy(btn, true); }
  try {
    const data = await api(action, payload, { requestId: rid });
    delete state.pendingRequestIds[ridKey];
    if (btn) delete btn.dataset.requestId;
    await afterWrite(opts.successMsg, Object.assign({}, opts, { avisos: data && data.avisos, _result: data }));
    return data;
  } catch (e) {
    if (opts.modal) showModalError(e.message);
    showToast(e.message, 'error');
  } finally {
    if (btn) setButtonBusy(btn, false);
  }
}

async function afterWrite(message, opts) {
  opts = opts || {};
  await refreshData({ silent: true, keepModal: true });
  closeModal();
  if (opts.detailId) {
    state.detailTab = opts.detailTab || 'resumo';
    await openEquipment(opts.detailId, state.detailTab);
    renderCurrentView();
  } else {
    renderCurrentView();
  }
  if (message) showToast(message, 'success');
  if (opts.avisos && opts.avisos.length) showToast(opts.avisos.join(' '), 'error');
  if (typeof opts.onSuccess === 'function') opts.onSuccess(opts._result);
}

async function doSyncSheet(btn) {
  if (!btn || btn.disabled) return;
  if (state.syncRunning) { showToast('A sincronização já está em andamento.', 'info'); return; }
  let rid = btn.dataset.requestId;
  if (!rid) { rid = genId(); btn.dataset.requestId = rid; }
  state.syncRunning = true;
  setButtonBusy(btn, true);
  try {
    const data = await api('sincronizarTudo', {}, { requestId: rid, timeout: 180000 });
    delete btn.dataset.requestId;
    if (state.data) state.data.precisaSincronizacao = false;
    await refreshData({ silent: true, keepModal: true });
    renderCurrentView();
    openSyncReport(data);
    showToast('Sincronização da planilha concluída.', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    state.syncRunning = false;
    setButtonBusy(btn, false);
  }
}

function openSyncReport(data) {
  const erros = data.erros || [];
  openModal({
    title: 'Sincronização da planilha',
    subtitle: 'As abas originais foram conferidas e atualizadas a partir do estado atual do sistema.',
    size: 'lg',
    body: `<div class="grid-3">
        <div class="stat-card"><div class="stat-label">Equipamentos</div><div class="stat-value">${fmtQty(data.equipamentosSincronizados || 0)}</div><div class="stat-meta">de ${fmtQty(data.total || 0)} sincronizados</div></div>
        <div class="stat-card gold"><div class="stat-label">Abas criadas</div><div class="stat-value">${fmtQty(data.abasCriadas || 0)}</div><div class="stat-meta">novas abas de categoria</div></div>
        <div class="stat-card ${erros.length ? 'red' : 'green'}"><div class="stat-label">Erros</div><div class="stat-value">${fmtQty(erros.length)}</div><div class="stat-meta">${erros.length ? 'verifique abaixo' : 'nenhum'}</div></div>
      </div>
      ${erros.length ? `<div class="alert alert-danger mt-16">${icon('alert')}<div><strong>Alguns itens não foram sincronizados.</strong><br>${erros.map((e) => esc((e.codigo || e.categoria || 'Item') + ': ' + e.erro)).join('<br>')}</div></div>` : `<div class="alert alert-success mt-16">${icon('check')}<div>Todas as abas originais confirmaram a gravação. Histórico preservado nas abas de movimentações.</div></div>`}
      <div class="small muted mt-12">Última sincronização: ${esc(fmtDateTime(data.quando))}</div>`,
    foot: `<button type="button" class="btn btn-secondary" data-action="close-modal">Fechar</button>`
  });
}

/* ---------- Formulários ---------- */
function formVal(form, name) {
  const el = form.elements[name];
  if (!el) return '';
  return String(el.value === undefined || el.value === null ? '' : el.value).trim();
}
function formNum(form, name) {
  const v = formVal(form, name);
  if (v === '') return 0;
  const n = Number(v.replace(',', '.'));
  return isFinite(n) ? n : 0;
}
function fieldError(form, name, message) {
  const el = form.elements[name];
  if (!el) return;
  const field = el.closest('.field') || el.parentElement;
  field.querySelectorAll('.field-error').forEach((x) => x.remove());
  const p = document.createElement('span');
  p.className = 'form-message error field-error';
  p.textContent = message;
  field.appendChild(p);
  el.focus();
}
function validateRequired(form, names) {
  for (const n of names) {
    const el = form.elements[n];
    if (el && !String(el.value || '').trim()) { fieldError(form, n, 'Preencha este campo.'); return false; }
  }
  return true;
}

async function submitModalForm(form, action, payloadFn, opts) {
  opts = opts || {};
  let btn = form.querySelector('[type=submit]');
  if (!btn && form.id) btn = document.querySelector('button[form="' + form.id + '"][type="submit"]');
  if (!btn && opts.buttonId) btn = $(opts.buttonId);
  if (!btn || btn.disabled) return;
  clearFormErrors(form);
  const payload = payloadFn(form);
  if (payload === false) return;
  let rid = form.dataset.requestId;
  if (!rid) { rid = genId(); form.dataset.requestId = rid; }
  setButtonBusy(btn, true);
  try {
    const data = await api(action, payload, { requestId: rid });
    form.dataset.requestId = '';
    await afterWrite(opts.successMsg, Object.assign({}, opts, { avisos: data && data.avisos, _result: data }));
    return data;
  } catch (e) {
    showModalError(e.message);
    showToast(e.message, 'error');
  } finally {
    setButtonBusy(btn, false);
  }
}

/* ---------- Formulário de equipamento ---------- */
function openEquipmentForm(eq) {
  if (!isAdmin()) return;
  const editing = !!eq;
  const cats = (state.data.categorias || []).filter((c) => c.ativo || (eq && c.id === eq.categoriaId));
  const e = eq || { categoriaId: (cats[0] || {}).id || '', quantidadeTotal: 1, estadoConservacao: 'NAO_INFORMADO', carregador: {}, bateria: {} };
  openModal({
    title: editing ? 'Editar equipamento' : 'Novo equipamento',
    subtitle: editing ? 'Alterações preservam o histórico de movimentações.' : 'Cadastre a máquina ou ferramenta. O código pode ser gerado automaticamente.',
    size: 'lg',
    body: `<form id="equipmentForm" class="form-stack" novalidate>
      <div class="form-section">
        <div class="form-section-title">${icon('tag')} Identificação</div>
        <div class="form-row">
          <label class="field"><span>Categoria <b class="required"></b></span><select name="categoriaId" required>${cats.map((c) => `<option value="${esc(c.id)}" ${e.categoriaId === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label>
          <label class="field"><span>Código do equipamento <span class="hint">${editing ? 'obrigatório' : 'opcional'}</span></span><input name="codigo" value="${esc(e.codigo || '')}" placeholder="${editing ? 'Ex.: PAR-001' : 'Gerado automaticamente'}" ${editing ? 'required' : ''}></label>
        </div>
        <div class="form-row">
          <label class="field"><span>Código / modelo de origem</span><input name="codigoModelo" value="${esc(e.codigoModelo || '')}" placeholder="Ex.: DCD7781"></label>
          <label class="field"><span>Descrição</span><input name="descricao" value="${esc(e.descricao || '')}" placeholder="Descrição livre"></label>
        </div>
        <div class="form-row">
          <label class="field"><span>Marca</span><input name="marca" value="${esc(e.marca || '')}" placeholder="Ex.: DeWalt"></label>
          <label class="field"><span>Modelo</span><input name="modelo" value="${esc(e.modelo || '')}" placeholder="Ex.: DCD7781"></label>
        </div>
        <div class="form-row">
          <label class="field"><span>Número de série</span><input name="numeroSerie" value="${esc(e.numeroSerie || '')}" placeholder="Se houver"></label>
          <label class="field"><span>Quantidade total <b class="required"></b></span><input name="quantidadeTotal" type="number" min="1" max="9999" step="1" value="${esc(e.quantidadeTotal || 1)}" required></label>
        </div>
        <label class="field"><span>Estado de conservação</span><select name="estadoConservacao">${Object.keys(CONSERVACAO_LABEL).map((k) => `<option value="${k}" ${e.estadoConservacao === k ? 'selected' : ''}>${esc(CONSERVACAO_LABEL[k])}</option>`).join('')}</select><span class="form-help">Disponibilidade e conservação são campos separados. Um item disponível não é automaticamente novo.</span></label>
      </div>
      <div class="form-section">
        <div class="form-section-title">${icon('battery')} Acessórios do conjunto</div>
        <div class="form-row">
          <label class="field"><span>Código do carregador</span><input name="carregadorCodigo" value="${esc(e.carregador && e.carregador.codigo ? e.carregador.codigo : '')}" placeholder="Ex.: DCB107"></label>
          <label class="field"><span>Quantidade de carregadores</span><input name="carregadorQtd" type="number" min="0" max="99" step="1" value="${esc(e.carregador && e.carregador.qtd ? e.carregador.qtd : 0)}"></label>
        </div>
        <div class="form-row">
          <label class="field"><span>Código(s) da bateria</span><input name="bateriaCodigo" value="${esc(e.bateria && e.bateria.codigo ? e.bateria.codigo : '')}" placeholder="Ex.: B1M1F96/B1M1F97"></label>
          <label class="field"><span>Quantidade de baterias</span><input name="bateriaQtd" type="number" min="0" max="99" step="1" value="${esc(e.bateria && e.bateria.qtd ? e.bateria.qtd : 0)}"></label>
        </div>
        <div class="form-help">Preserve os códigos como texto, inclusive zeros à esquerda e os dois códigos separados por “/”.</div>
      </div>
      <label class="field"><span>Observações</span><textarea name="observacoes" placeholder="Informações adicionais, acessórios, avarias…">${esc(e.observacoes || '')}</textarea></label>
    </form>`,
    foot: `<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" form="equipmentForm" class="btn btn-primary">${editing ? 'Salvar alterações' : 'Cadastrar equipamento'}</button>`,
    onMount: () => {
      $('equipmentForm').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        if (!validateRequired(form, ['categoriaId', 'quantidadeTotal'])) return;
        if (editing && !validateRequired(form, ['codigo'])) return;
        const payload = {
          categoriaId: formVal(form, 'categoriaId'),
          codigo: formVal(form, 'codigo'),
          codigoModelo: formVal(form, 'codigoModelo'),
          descricao: formVal(form, 'descricao'),
          marca: formVal(form, 'marca'),
          modelo: formVal(form, 'modelo'),
          numeroSerie: formVal(form, 'numeroSerie'),
          quantidadeTotal: formNum(form, 'quantidadeTotal'),
          estadoConservacao: formVal(form, 'estadoConservacao'),
          carregadorCodigo: formVal(form, 'carregadorCodigo'),
          carregadorQtd: formNum(form, 'carregadorQtd'),
          bateriaCodigo: formVal(form, 'bateriaCodigo'),
          bateriaQtd: formNum(form, 'bateriaQtd'),
          observacoes: formVal(form, 'observacoes'),
        };
        if (editing) payload.id = eq.id;
        submitModalForm(form, editing ? 'editarEquipamento' : 'criarEquipamento', () => payload, {
          successMsg: editing ? 'Equipamento atualizado.' : 'Equipamento cadastrado.',
          detailId: editing ? eq.id : null,
          onSuccess: editing ? null : () => {},
        }).then((data) => {
          if (data && data.equipamento) openEquipment(data.equipamento.id, 'resumo');
        });
      });
    },
  });
}

/* ---------- Entrega ---------- */
function openDeliveryModal(equipmentId) {
  if (!isAdmin()) return;
  const eqs = (state.data.equipamentos || []).filter((e) => e.podeEntregar);
  const cols = (state.data.colaboradores || []).filter((c) => c.ativo);
  if (!eqs.length) { openModal({ title: 'Nenhum equipamento disponível', size: 'sm', body: `<div class="alert alert-warn">${icon('alert')}<div>Não há equipamento disponível para entrega. Registre uma devolução ou cadastre um novo equipamento.</div></div>`, foot: `<button type="button" class="btn btn-secondary" data-action="close-modal">Fechar</button>` }); return; }
  const selected = equipmentId || (eqs[0] && eqs[0].id);
  const eq = eqs.find((x) => x.id === selected) || eqs[0];
  openModal({
    title: 'Registrar entrega',
    subtitle: 'A disponibilidade será reduzida e o histórico será preservado.',
    size: 'lg',
    body: `<form id="deliveryForm" class="form-stack" novalidate>
      <div class="form-section">
        <div class="form-section-title">${icon('drill')} Equipamento e responsável</div>
        <label class="field"><span>Equipamento <b class="required"></b></span><select name="equipamentoId" id="deliveryEquipment" required>${eqs.map((x) => `<option value="${esc(x.id)}" ${x.id === eq.id ? 'selected' : ''}>${esc(x.codigo)} — ${esc(x.nome)} · ${fmtQty(x.quantidadeDisponivel)} disp.</option>`).join('')}</select></label>
        <div class="form-row">
          <label class="field"><span>Responsável <b class="required"></b></span><input name="colaboradorNome" list="deliveryColabList" autocomplete="off" placeholder="Digite um nome ou escolha uma sugestão" required><datalist id="deliveryColabList">${cols.map((c) => `<option value="${esc(c.nome)}"></option>`).join('')}</datalist><span class="form-help">Pode digitar um nome novo. Ele será cadastrado como colaborador, sem criar acesso ao sistema.</span></label>
          <label class="field"><span>Data da entrega <b class="required"></b></span><input name="data" type="date" value="${todayIso()}" required></label>
        </div>
        <div class="form-row">
          <label class="field"><span>Quantidade <b class="required"></b></span><input name="quantidade" id="deliveryQty" type="number" min="1" max="${eq.quantidadeDisponivel}" step="1" value="1" required><span class="form-help" id="deliveryQtyHelp">Máximo: ${fmtQty(eq.quantidadeDisponivel)}</span></label>
          <label class="field"><span>Conservação na entrega</span><select name="estadoConservacao" id="deliveryConservation">${Object.keys(CONSERVACAO_LABEL).map((k) => `<option value="${k}" ${eq.estadoConservacao === k ? 'selected' : ''}>${esc(CONSERVACAO_LABEL[k])}</option>`).join('')}</select></label>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">${icon('battery')} Acessórios entregues</div>
        <div id="deliveryAccessories"></div>
        <div class="form-help">Só é possível entregar acessórios que não estejam pendentes com outro colaborador. Deixe 0 para não entregar.</div>
      </div>
      <label class="field"><span>Observações</span><textarea name="observacoes" placeholder="Obra, local, condição, combinações…"></textarea></label>
    </form>`,
    foot: `<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" form="deliveryForm" class="btn btn-primary">Confirmar entrega</button>`,
    onMount: () => {
      const update = () => {
        const id = $('deliveryEquipment').value;
        const x = eqs.find((e) => e.id === id);
        if (!x) return;
        $('deliveryQty').max = x.quantidadeDisponivel;
        $('deliveryQty').value = 1;
        $('deliveryQtyHelp').textContent = 'Máximo: ' + fmtQty(x.quantidadeDisponivel);
        $('deliveryConservation').value = x.estadoConservacao || 'NAO_INFORMADO';
        const car = (x.acessoriosDisponiveis || []).find((a) => a.tipo === 'CARREGADOR');
        const bat = (x.acessoriosDisponiveis || []).find((a) => a.tipo === 'BATERIA');
        $('deliveryAccessories').innerHTML = `
          <div class="form-row">
            <label class="field"><span>Carregador ${car ? '— ' + esc(car.codigo) : ''}</span><input name="carregadorQtd" type="number" min="0" max="${car ? car.qtd : 0}" step="1" value="${car ? car.qtd : 0}" ${car ? '' : 'disabled'}><span class="form-help">${car ? 'Disponível: ' + fmtQty(car.qtd) : 'Nenhum carregador disponível'}</span></label>
            <label class="field"><span>Bateria ${bat ? '— ' + esc(bat.codigo) : ''}</span><input name="bateriaQtd" type="number" min="0" max="${bat ? bat.qtd : 0}" step="1" value="${bat ? bat.qtd : 0}" ${bat ? '' : 'disabled'}><span class="form-help">${bat ? 'Disponível: ' + fmtQty(bat.qtd) : 'Nenhuma bateria disponível'}</span></label>
          </div>`;
      };
      $('deliveryEquipment').addEventListener('change', update);
      update();
      $('deliveryForm').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        if (!validateRequired(form, ['colaboradorNome', 'data', 'quantidade'])) return;
        const payload = {
          equipamentoId: formVal(form, 'equipamentoId'),
          colaboradorNome: formVal(form, 'colaboradorNome'),
          data: formVal(form, 'data'),
          quantidade: formNum(form, 'quantidade'),
          estadoConservacao: formVal(form, 'estadoConservacao'),
          acessorios: { CARREGADOR: formNum(form, 'carregadorQtd'), BATERIA: formNum(form, 'bateriaQtd') },
          observacoes: formVal(form, 'observacoes'),
        };
        submitModalForm(form, 'registrarEntrega', () => payload, { successMsg: 'Entrega registrada.', detailId: payload.equipamentoId });
      });
    },
  });
}

/* ---------- Devolução ---------- */
function openReturnModal(loanId) {
  if (!isAdmin()) return;
  const loans = (state.data.emprestimosAbertos || []).filter((l) => l.status === 'ABERTO');
  if (!loans.length) { openModal({ title: 'Sem devoluções pendentes', size: 'sm', body: `<div class="alert alert-success">${icon('check')}<div>Não há empréstimo aberto ou acessório pendente.</div></div>`, foot: `<button type="button" class="btn btn-secondary" data-action="close-modal">Fechar</button>` }); return; }
  const selected = loanId || (loans[0] && loans[0].id);
  const loan = loans.find((l) => l.id === selected) || loans[0];
  openModal({
    title: 'Registrar devolução',
    subtitle: 'Aceita devolução parcial do equipamento e dos acessórios.',
    size: 'lg',
    body: `<form id="returnForm" class="form-stack" novalidate>
      <div class="form-section">
        <div class="form-section-title">${icon('arrowUpRight')} Empréstimo</div>
        <label class="field"><span>Empréstimo <b class="required"></b></span><select name="emprestimoId" id="returnLoan" required>${loans.map((l) => `<option value="${esc(l.id)}" ${l.id === loan.id ? 'selected' : ''}>${esc(l.equipamentoCodigo)} — ${esc(l.colaboradorNome)} · ${plural(l.quantidade, 'unidade', 'unidades')}${l.totalPendente ? ' · ' + plural(l.totalPendente, 'acessório', 'acessórios') : ''}</option>`).join('')}</select></label>
        <div class="form-row">
          <label class="field"><span>Data da devolução <b class="required"></b></span><input name="data" type="date" value="${todayIso()}" required></label>
          <label class="field"><span>Conservação na devolução</span><select name="estadoConservacao" id="returnConservation">${Object.keys(CONSERVACAO_LABEL).map((k) => `<option value="${k}">${esc(CONSERVACAO_LABEL[k])}</option>`).join('')}</select></label>
        </div>
        <div class="form-row">
          <label class="field"><span>Quantidade devolvida</span><input name="quantidade" id="returnQty" type="number" min="0" max="${loan.quantidade}" step="1" value="${loan.quantidade}"><span class="form-help" id="returnQtyHelp">Em posse do colaborador: ${fmtQty(loan.quantidade)}</span></label>
          <label class="field"><span>Responsável</span><input value="${esc(loan.colaboradorNome)}" disabled></label>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">${icon('battery')} Acessórios devolvidos</div>
        <div id="returnAccessories"></div>
        <div class="form-help">Deixe 0 para manter o acessório pendente com o colaborador.</div>
      </div>
      <label class="field"><span>Observações</span><textarea name="observacoes" placeholder="Condição, acessórios que ficaram pendentes…"></textarea></label>
    </form>`,
    foot: `<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" form="returnForm" class="btn btn-primary">Confirmar devolução</button>`,
    onMount: () => {
      const update = () => {
        const l = loans.find((x) => x.id === $('returnLoan').value);
        if (!l) return;
        $('returnQty').max = l.quantidade;
        $('returnQty').value = l.quantidade;
        $('returnQtyHelp').textContent = 'Em posse do colaborador: ' + fmtQty(l.quantidade);
        $('returnConservation').value = l.estadoEntrega || 'NAO_INFORMADO';
        const pt = {};
        (l.acessoriosPendentes || []).forEach((a) => { pt[a.tipo] = (pt[a.tipo] || 0) + Number(a.qtd || 0); });
        $('returnAccessories').innerHTML = `
          <div class="form-row">
            <label class="field"><span>Carregador</span><input name="carregadorQtd" type="number" min="0" max="${pt.CARREGADOR || 0}" step="1" value="${pt.CARREGADOR || 0}" ${pt.CARREGADOR ? '' : 'disabled'}><span class="form-help">Pendente: ${fmtQty(pt.CARREGADOR || 0)}</span></label>
            <label class="field"><span>Bateria</span><input name="bateriaQtd" type="number" min="0" max="${pt.BATERIA || 0}" step="1" value="${pt.BATERIA || 0}" ${pt.BATERIA ? '' : 'disabled'}><span class="form-help">Pendente: ${fmtQty(pt.BATERIA || 0)}</span></label>
          </div>`;
      };
      $('returnLoan').addEventListener('change', update);
      update();
      $('returnForm').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        if (!validateRequired(form, ['data'])) return;
        const payload = {
          emprestimoId: formVal(form, 'emprestimoId'),
          data: formVal(form, 'data'),
          quantidade: formNum(form, 'quantidade'),
          estadoConservacao: formVal(form, 'estadoConservacao'),
          acessorios: { CARREGADOR: formNum(form, 'carregadorQtd'), BATERIA: formNum(form, 'bateriaQtd') },
          observacoes: formVal(form, 'observacoes'),
        };
        const l = loans.find((x) => x.id === payload.emprestimoId);
        submitModalForm(form, 'registrarDevolucao', () => payload, { successMsg: 'Devolução registrada.', detailId: l ? l.equipamentoId : null });
      });
    },
  });
}

/* ---------- Transferência ---------- */
function openTransferModal(loanId) {
  if (!isAdmin()) return;
  const loans = (state.data.emprestimosAbertos || []).filter((l) => l.status === 'ABERTO' && l.quantidade > 0);
  if (!loans.length) { openModal({ title: 'Sem empréstimo para transferir', size: 'sm', body: `<div class="alert alert-warn">${icon('info')}<div>Não há equipamento em posse de colaborador para transferir.</div></div>`, foot: `<button type="button" class="btn btn-secondary" data-action="close-modal">Fechar</button>` }); return; }
  const selected = loanId || (loans[0] && loans[0].id);
  const loan = loans.find((l) => l.id === selected) || loans[0];
  const cols = (state.data.colaboradores || []).filter((c) => c.ativo && c.id !== loan.colaboradorId);
  openModal({
    title: 'Transferir responsável',
    subtitle: 'O histórico anterior é preservado. Uma nova responsabilidade é criada para o novo colaborador.',
    body: `<form id="transferForm" class="form-stack" novalidate>
      <label class="field"><span>Empréstimo <b class="required"></b></span><select name="emprestimoId" id="transferLoan" required>${loans.map((l) => `<option value="${esc(l.id)}" ${l.id === loan.id ? 'selected' : ''}>${esc(l.equipamentoCodigo)} — ${esc(l.colaboradorNome)} · ${plural(l.quantidade, 'unidade', 'unidades')}</option>`).join('')}</select></label>
      <div class="form-row">
        <label class="field"><span>Novo responsável <b class="required"></b></span><input name="novoColaboradorNome" id="transferNewColab" list="transferColabList" autocomplete="off" placeholder="Digite um nome ou escolha uma sugestão" required><datalist id="transferColabList">${cols.map((c) => `<option value="${esc(c.nome)}"></option>`).join('')}</datalist><span class="form-help">Pode digitar um nome novo. Ele será cadastrado como colaborador, sem criar acesso ao sistema.</span></label>
        <label class="field"><span>Data da transferência <b class="required"></b></span><input name="data" type="date" value="${todayIso()}" required></label>
      </div>
      <div id="transferInfo" class="alert alert-info"></div>
      <label class="field"><span>Observações</span><textarea name="observacoes" placeholder="Motivo ou local da transferência…"></textarea></label>
    </form>`,
    foot: `<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" form="transferForm" class="btn btn-primary">Confirmar transferência</button>`,
    onMount: () => {
      const update = () => {
        const l = loans.find((x) => x.id === $('transferLoan').value);
        if (!l) return;
        const opts = (state.data.colaboradores || []).filter((c) => c.ativo && c.id !== l.colaboradorId);
        $('transferNewColab').value = '';
        $('transferColabList').innerHTML = opts.map((c) => `<option value="${esc(c.nome)}"></option>`).join('');
        $('transferInfo').innerHTML = `<div><strong>${esc(l.equipamentoCodigo)}</strong> está com <strong>${esc(l.colaboradorNome)}</strong>. ${plural(l.quantidade, 'unidade', 'unidades')}${l.totalPendente ? ' e ' + plural(l.totalPendente, 'acessório pendente', 'acessórios pendentes') : ''} serão transferidos.</div>`;
      };
      $('transferLoan').addEventListener('change', update);
      update();
      $('transferForm').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        if (!validateRequired(form, ['novoColaboradorNome', 'data'])) return;
        const payload = { emprestimoId: formVal(form, 'emprestimoId'), novoColaboradorNome: formVal(form, 'novoColaboradorNome'), data: formVal(form, 'data'), observacoes: formVal(form, 'observacoes') };
        const l = loans.find((x) => x.id === payload.emprestimoId);
        submitModalForm(form, 'registrarTransferencia', () => payload, { successMsg: 'Transferência registrada.', detailId: l ? l.equipamentoId : null });
      });
    },
  });
}

/* ---------- Manutenção ---------- */
function openMaintenanceForm(equipmentId) {
  if (!isAdmin()) return;
  const eqs = (state.data.equipamentos || []).filter((e) => e.podeManutencao);
  if (!eqs.length) { openModal({ title: 'Nenhum equipamento disponível', size: 'sm', body: `<div class="alert alert-warn">${icon('alert')}<div>Só é possível enviar para manutenção um equipamento totalmente disponível, sem empréstimos ou acessórios pendentes.</div></div>`, foot: `<button type="button" class="btn btn-secondary" data-action="close-modal">Fechar</button>` }); return; }
  const selected = equipmentId || (eqs[0] && eqs[0].id);
  const eq = eqs.find((x) => x.id === selected) || eqs[0];
  openModal({
    title: 'Enviar para manutenção',
    subtitle: 'O equipamento ficará indisponível para entrega até o retorno.',
    size: 'lg',
    body: `<form id="maintenanceForm" class="form-stack" novalidate>
      <div class="form-section">
        <div class="form-section-title">${icon('wrench')} Equipamento e envio</div>
        <label class="field"><span>Equipamento <b class="required"></b></span><select name="equipamentoId" required>${eqs.map((x) => `<option value="${esc(x.id)}" ${x.id === eq.id ? 'selected' : ''}>${esc(x.codigo)} — ${esc(x.nome)}</option>`).join('')}</select></label>
        <div class="form-row">
          <label class="field"><span>Data de envio <b class="required"></b></span><input name="dataEnvio" type="date" value="${todayIso()}" required></label>
          <label class="field"><span>Previsão de retorno</span><input name="previsaoRetorno" type="date"></label>
        </div>
        <div class="form-row">
          <label class="field"><span>Responsável / assistência</span><input name="responsavel" placeholder="Oficina, técnico ou empresa"></label>
          <label class="field"><span>Celular do responsável/assistência</span><input name="celularResponsavel" type="tel" inputmode="tel" placeholder="(00) 00000-0000"></label>
        </div>
        <label class="field"><span>Defeito ou motivo <b class="required"></b></span><textarea name="defeito" placeholder="Descreva o defeito ou o serviço necessário" required></textarea></label>
        <label class="field"><span>Custo estimado (R$)</span><input name="custo" type="number" min="0" step="0.01" placeholder="0,00"></label>
      </div>
      <label class="field"><span>Observações</span><textarea name="observacoes" placeholder="Informações adicionais"></textarea></label>
    </form>`,
    foot: `<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" form="maintenanceForm" class="btn btn-primary">Enviar para manutenção</button>`,
    onMount: () => {
      $('maintenanceForm').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        if (!validateRequired(form, ['dataEnvio', 'defeito'])) return;
        const payload = { equipamentoId: formVal(form, 'equipamentoId'), dataEnvio: formVal(form, 'dataEnvio'), defeito: formVal(form, 'defeito'), responsavel: formVal(form, 'responsavel'), celularResponsavel: formVal(form, 'celularResponsavel'), previsaoRetorno: formVal(form, 'previsaoRetorno'), custo: formVal(form, 'custo'), observacoes: formVal(form, 'observacoes') };
        submitModalForm(form, 'abrirManutencao', () => payload, { successMsg: 'Equipamento enviado para manutenção.', detailId: payload.equipamentoId });
      });
    },
  });
}

function findMaintenance(id) {
  return (state.manData && state.manData.items || []).find((m) => m.id === id)
    || (state.detail && state.detail.manutencoes || []).find((m) => m.id === id)
    || (state.data && state.data.manutencoesAbertas || []).find((m) => m.id === id)
    || null;
}

function openMaintenanceEdit(id) {
  if (!isAdmin()) return;
  const man = findMaintenance(id);
  if (!man) return;
  openModal({
    title: 'Editar manutenção',
    subtitle: 'Atualize o andamento. Para encerrar, use “Concluir manutenção”.',
    size: 'lg',
    body: `<form id="maintenanceEditForm" class="form-stack" novalidate>
      <div class="form-row">
        <label class="field"><span>Situação</span><select name="status"><option value="ABERTA" ${man.status === 'ABERTA' ? 'selected' : ''}>Aberta</option><option value="EM_ANDAMENTO" ${man.status === 'EM_ANDAMENTO' ? 'selected' : ''}>Em andamento</option></select></label>
        <label class="field"><span>Responsável / assistência</span><input name="responsavel" value="${esc(man.responsavel || '')}"></label>
      </div>
      <div class="form-row">
        <label class="field"><span>Celular do responsável/assistência</span><input name="celularResponsavel" type="tel" inputmode="tel" value="${esc(man.celularResponsavel || '')}" placeholder="(00) 00000-0000"></label>
        <label class="field"><span>Previsão de retorno</span><input name="previsaoRetorno" type="date" value="${esc(man.previsaoRetorno || '')}"></label>
      </div>
      <label class="field"><span>Defeito ou motivo</span><textarea name="defeito">${esc(man.defeito || '')}</textarea></label>
      <label class="field"><span>Serviço realizado</span><textarea name="servico">${esc(man.servico || '')}</textarea></label>
      <label class="field"><span>Custo (R$)</span><input name="custo" type="number" min="0" step="0.01" value="${man.custo === '' ? '' : esc(man.custo)}"></label>
      <label class="field"><span>Observações</span><textarea name="observacoes">${esc(man.observacoes || '')}</textarea></label>
    </form>`,
    foot: `<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" form="maintenanceEditForm" class="btn btn-primary">Salvar</button>`,
    onMount: () => {
      $('maintenanceEditForm').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        const payload = { id: man.id, status: formVal(form, 'status'), responsavel: formVal(form, 'responsavel'), celularResponsavel: formVal(form, 'celularResponsavel'), defeito: formVal(form, 'defeito'), servico: formVal(form, 'servico'), previsaoRetorno: formVal(form, 'previsaoRetorno'), custo: formVal(form, 'custo'), observacoes: formVal(form, 'observacoes') };
        submitModalForm(form, 'atualizarManutencao', () => payload, { successMsg: 'Manutenção atualizada.', detailId: man.equipamentoId, detailTab: 'manutencoes' });
      });
    },
  });
}

function openMaintenanceConclude(id) {
  if (!isAdmin()) return;
  const man = findMaintenance(id);
  if (!man) return;
  const eqMan = (state.data.equipamentos || []).find((e) => e.id === man.equipamentoId);
  const estadoAtual = man.estadoRetorno || (eqMan && eqMan.estadoConservacao) || 'NAO_INFORMADO';
  openModal({
    title: 'Concluir manutenção',
    subtitle: 'O equipamento voltará a ficar disponível. Registre o serviço e o estado de retorno.',
    size: 'lg',
    body: `<form id="maintenanceConcludeForm" class="form-stack" novalidate>
      <div class="form-row">
        <label class="field"><span>Data de retorno <b class="required"></b></span><input name="dataRetorno" type="date" value="${todayIso()}" required></label>
        <label class="field"><span>Estado de conservação no retorno</span><select name="estadoRetorno">${Object.keys(CONSERVACAO_LABEL).map((k) => `<option value="${k}" ${estadoAtual === k ? 'selected' : ''}>${esc(CONSERVACAO_LABEL[k])}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span>Serviço realizado</span><textarea name="servico" placeholder="O que foi feito">${esc(man.servico || '')}</textarea></label>
      <div class="form-row">
        <label class="field"><span>Responsável / assistência</span><input value="${esc(man.responsavel || '—')}" disabled></label>
        <label class="field"><span>Celular do responsável/assistência</span><input name="celularResponsavel" type="tel" inputmode="tel" value="${esc(man.celularResponsavel || '')}" placeholder="(00) 00000-0000"></label>
      </div>
      <label class="field"><span>Custo final (R$)</span><input name="custo" type="number" min="0" step="0.01" value="${man.custo === '' ? '' : esc(man.custo)}"></label>
      <label class="field"><span>Observações</span><textarea name="observacoes">${esc(man.observacoes || '')}</textarea></label>
    </form>`,
    foot: `<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" form="maintenanceConcludeForm" class="btn btn-primary">Concluir e liberar</button>`,
    onMount: () => {
      $('maintenanceConcludeForm').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        if (!validateRequired(form, ['dataRetorno'])) return;
        const payload = { id: man.id, dataRetorno: formVal(form, 'dataRetorno'), estadoRetorno: formVal(form, 'estadoRetorno'), servico: formVal(form, 'servico'), custo: formVal(form, 'custo'), celularResponsavel: formVal(form, 'celularResponsavel'), observacoes: formVal(form, 'observacoes') };
        submitModalForm(form, 'concluirManutencao', () => payload, { successMsg: 'Manutenção concluída. Equipamento disponível.', detailId: man.equipamentoId, detailTab: 'manutencoes' });
      });
    },
  });
}

function openMaintenanceCancel(id) {
  if (!isAdmin()) return;
  const man = findMaintenance(id);
  if (!man) return;
  openModal({
    title: 'Cancelar manutenção',
    subtitle: 'O equipamento será liberado e o registro ficará como cancelado no histórico.',
    size: 'sm',
    body: `<form id="maintenanceCancelForm" class="form-stack" novalidate>
      <label class="field"><span>Data</span><input name="dataRetorno" type="date" value="${todayIso()}"></label>
      <label class="field"><span>Motivo</span><textarea name="motivo" placeholder="Por que a manutenção foi cancelada?"></textarea></label>
    </form>`,
    foot: `<button type="button" class="btn btn-ghost" data-action="close-modal">Voltar</button><button type="submit" form="maintenanceCancelForm" class="btn btn-danger">Cancelar manutenção</button>`,
    onMount: () => {
      $('maintenanceCancelForm').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        const payload = { id: man.id, dataRetorno: formVal(form, 'dataRetorno'), motivo: formVal(form, 'motivo') };
        submitModalForm(form, 'cancelarManutencao', () => payload, { successMsg: 'Manutenção cancelada.', detailId: man.equipamentoId, detailTab: 'manutencoes' });
      });
    },
  });
}

/* ---------- Colaborador / categoria / usuário ---------- */
function openCollaboratorForm(c) {
  if (!isAdmin()) return;
  const editing = !!c;
  const e = c || { tipo: 'PESSOA' };
  openModal({
    title: editing ? 'Editar colaborador' : 'Novo colaborador',
    subtitle: 'O cadastro de colaborador não cria conta de acesso ao sistema.',
    body: `<form id="collaboratorForm" class="form-stack" novalidate>
      <label class="field"><span>Nome <b class="required"></b></span><input name="nome" value="${esc(e.nome || '')}" placeholder="Nome, grupo ou local" required></label>
      <div class="form-row">
        <label class="field"><span>Tipo</span><select name="tipo">${Object.keys(TIPO_COLAB_LABEL).map((k) => `<option value="${k}" ${e.tipo === k ? 'selected' : ''}>${esc(TIPO_COLAB_LABEL[k])}</option>`).join('')}</select></label>
        <label class="field"><span>Função</span><input name="funcao" value="${esc(e.funcao || '')}" placeholder="Ex.: Encarregado"></label>
      </div>
      <div class="form-row">
        <label class="field"><span>Telefone</span><input name="telefone" value="${esc(e.telefone || '')}" placeholder="(00) 00000-0000"></label>
        <label class="field"><span>E-mail</span><input name="email" type="email" value="${esc(e.email || '')}" placeholder="opcional"></label>
      </div>
      <div class="form-row">
        <label class="field"><span>Local / obra</span><input name="localObra" value="${esc(e.localObra || '')}" placeholder="Obra ou local"></label>
        <label class="field"><span>Setor</span><input name="setor" value="${esc(e.setor || '')}" placeholder="Ex.: Produção, Almoxarifado"></label>
      </div>
      <label class="field"><span>Observações</span><textarea name="observacoes" placeholder="Informações adicionais">${esc(e.observacoes || '')}</textarea></label>
    </form>`,
    foot: `<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" form="collaboratorForm" class="btn btn-primary">${editing ? 'Salvar' : 'Cadastrar'}</button>`,
    onMount: () => {
      $('collaboratorForm').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        if (!validateRequired(form, ['nome'])) return;
        const payload = { nome: formVal(form, 'nome'), tipo: formVal(form, 'tipo'), funcao: formVal(form, 'funcao'), telefone: formVal(form, 'telefone'), email: formVal(form, 'email'), localObra: formVal(form, 'localObra'), setor: formVal(form, 'setor'), observacoes: formVal(form, 'observacoes') };
        if (editing) payload.id = c.id;
        submitModalForm(form, editing ? 'editarColaborador' : 'criarColaborador', () => payload, { successMsg: editing ? 'Colaborador atualizado.' : 'Colaborador cadastrado.' });
      });
    },
  });
}

function openCategoryForm(c) {
  if (!isAdmin()) return;
  const editing = !!c;
  const e = c || { ordem: (state.data.categorias || []).length + 1, campoItem: 'ITEM' };
  openModal({
    title: editing ? 'Editar categoria' : 'Nova categoria/aba',
    subtitle: editing ? 'A categoria mantém a aba já vinculada à planilha.' : 'A nova categoria cria uma aba própria na planilha e fica disponível para novos equipamentos.',
    size: 'sm',
    body: `<form id="categoryForm" class="form-stack" novalidate>
      ${editing ? `<div class="alert alert-info">${icon('info')}<div>Aba vinculada: <strong>${esc(c.nomeAba || 'não definida')}</strong>. Renomear a categoria não renomeia a aba automaticamente.</div></div>` : `<div class="alert alert-info">${icon('info')}<div>Uma nova aba será criada na planilha com o nome da categoria. Nomes duplicados e caracteres inválidos serão bloqueados.</div></div>`}
      <label class="field"><span>Nome <b class="required"></b></span><input name="nome" value="${esc(e.nome || '')}" placeholder="Ex.: Serra circular" required></label>
      <div class="form-row">
        <label class="field"><span>Prefixo <b class="required"></b></span><input name="prefixo" value="${esc(e.prefixo || '')}" maxlength="6" placeholder="Ex.: SCI" required></label>
        <label class="field"><span>Ordem</span><input name="ordem" type="number" min="1" max="999" value="${esc(e.ordem || 1)}"></label>
      </div>
      <label class="field"><span>Rótulo do item</span><input name="campoItem" value="${esc(e.campoItem || 'ITEM')}" placeholder="Ex.: SERRA CIRCULAR"></label>
      <div class="form-help">Cada categoria pode ter um rótulo próprio. Códigos iguais em categorias diferentes não são o mesmo equipamento.</div>
    </form>`,
    foot: `<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" form="categoryForm" class="btn btn-primary">${editing ? 'Salvar' : 'Criar categoria/aba'}</button>`,
    onMount: () => {
      $('categoryForm').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        if (!validateRequired(form, ['nome', 'prefixo'])) return;
        const payload = { nome: formVal(form, 'nome'), prefixo: formVal(form, 'prefixo'), ordem: formNum(form, 'ordem'), campoItem: formVal(form, 'campoItem') };
        if (editing) payload.id = c.id;
        submitModalForm(form, editing ? 'editarCategoria' : 'criarCategoria', () => payload, { successMsg: editing ? 'Categoria atualizada.' : 'Categoria criada.' });
      });
    },
  });
}

function openUserForm(u) {
  if (!isAdmin()) return;
  const editing = !!u;
  const e = u || { perfil: 'COLABORADOR' };
  openModal({
    title: editing ? 'Editar usuário' : 'Novo usuário',
    subtitle: editing ? 'A alteração de perfil encerra as sessões abertas desse usuário.' : 'A conta é separada do cadastro de colaborador.',
    body: `<form id="userForm" class="form-stack" novalidate>
      <label class="field"><span>Nome <b class="required"></b></span><input name="nome" value="${esc(e.nome || '')}" required></label>
      <label class="field"><span>Usuário ou e-mail <b class="required"></b></span><input name="email" type="text" inputmode="text" autocomplete="username" value="${esc(e.email || '')}" required></label>
      <label class="field"><span>Perfil</span><select name="perfil"><option value="COLABORADOR" ${e.perfil === 'COLABORADOR' ? 'selected' : ''}>Colaborador — somente consulta</option><option value="ADMINISTRADOR" ${e.perfil === 'ADMINISTRADOR' ? 'selected' : ''}>Administrador — acesso completo</option></select></label>
      ${editing ? '' : `<div class="form-row"><label class="field"><span>Senha inicial <b class="required"></b></span><input name="senha" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres" required></label><label class="field"><span>Confirmar senha <b class="required"></b></span><input name="senha2" type="password" autocomplete="new-password" placeholder="Repita a senha" required></label></div>`}
      <label class="field"><span>Observações</span><textarea name="observacoes" placeholder="Opcional">${esc(e.observacoes || '')}</textarea></label>
      <div class="form-help">O perfil COLABORADOR pode visualizar, pesquisar e consultar. Todas as alterações são bloqueadas no servidor.</div>
    </form>`,
    foot: `<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" form="userForm" class="btn btn-primary">${editing ? 'Salvar' : 'Criar conta'}</button>`,
    onMount: () => {
      $('userForm').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        if (!validateRequired(form, ['nome', 'email'])) return;
        if (!editing) {
          if (!validateRequired(form, ['senha', 'senha2'])) return;
          if (formVal(form, 'senha').length < 8) { fieldError(form, 'senha', 'A senha deve ter pelo menos 8 caracteres.'); return; }
          if (formVal(form, 'senha') !== formVal(form, 'senha2')) { fieldError(form, 'senha2', 'As senhas não conferem.'); return; }
        }
        const payload = { nome: formVal(form, 'nome'), email: formVal(form, 'email'), perfil: formVal(form, 'perfil'), observacoes: formVal(form, 'observacoes') };
        if (editing) payload.id = u.id; else payload.senha = formVal(form, 'senha');
        submitModalForm(form, editing ? 'editarUsuario' : 'criarUsuario', () => payload, { successMsg: editing ? 'Usuário atualizado.' : 'Conta criada.' });
      });
    },
  });
}

function openResetPassword(u) {
  if (!isAdmin()) return;
  openModal({
    title: 'Redefinir senha',
    subtitle: `Defina uma nova senha para ${u.nome}. As sessões abertas serão encerradas.`,
    size: 'sm',
    body: `<form id="resetPasswordForm" class="form-stack" novalidate>
      <label class="field"><span>Nova senha <b class="required"></b></span><input name="novaSenha" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres" required></label>
      <label class="field"><span>Confirmar senha <b class="required"></b></span><input name="novaSenha2" type="password" autocomplete="new-password" placeholder="Repita a senha" required></label>
      <div class="form-help">A senha é gravada apenas como hash com sal. O administrador não consegue visualizar a senha anterior.</div>
    </form>`,
    foot: `<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" form="resetPasswordForm" class="btn btn-primary">Redefinir senha</button>`,
    onMount: () => {
      $('resetPasswordForm').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        if (!validateRequired(form, ['novaSenha', 'novaSenha2'])) return;
        if (formVal(form, 'novaSenha').length < 8) { fieldError(form, 'novaSenha', 'A senha deve ter pelo menos 8 caracteres.'); return; }
        if (formVal(form, 'novaSenha') !== formVal(form, 'novaSenha2')) { fieldError(form, 'novaSenha2', 'As senhas não conferem.'); return; }
        submitModalForm(form, 'resetarSenhaUsuario', () => ({ id: u.id, novaSenha: formVal(form, 'novaSenha') }), { successMsg: 'Senha redefinida. As sessões antigas foram encerradas.' });
      });
    },
  });
}

function openChangePassword() {
  openModal({
    title: 'Alterar minha senha',
    subtitle: 'Sua sessão atual será renovada após a alteração.',
    size: 'sm',
    body: `<form id="changePasswordForm" class="form-stack" novalidate>
      <label class="field"><span>Senha atual <b class="required"></b></span><input name="senhaAtual" type="password" autocomplete="current-password" required></label>
      <label class="field"><span>Nova senha <b class="required"></b></span><input name="novaSenha" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres" required></label>
      <label class="field"><span>Confirmar nova senha <b class="required"></b></span><input name="novaSenha2" type="password" autocomplete="new-password" required></label>
    </form>`,
    foot: `<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" form="changePasswordForm" class="btn btn-primary">Alterar senha</button>`,
    onMount: () => {
      $('changePasswordForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        if (!validateRequired(form, ['senhaAtual', 'novaSenha', 'novaSenha2'])) return;
        if (formVal(form, 'novaSenha').length < 8) { fieldError(form, 'novaSenha', 'A senha deve ter pelo menos 8 caracteres.'); return; }
        if (formVal(form, 'novaSenha') !== formVal(form, 'novaSenha2')) { fieldError(form, 'novaSenha2', 'As senhas não conferem.'); return; }
        let btn = form.querySelector('[type=submit]');
        if (!btn) btn = document.querySelector('button[form="changePasswordForm"]');
        let rid = form.dataset.requestId;
        if (!rid) { rid = genId(); form.dataset.requestId = rid; }
        setButtonBusy(btn, true);
        try {
          const data = await api('alterarMinhaSenha', { senhaAtual: formVal(form, 'senhaAtual'), novaSenha: formVal(form, 'novaSenha'), userAgent: navigator.userAgent }, { requestId: rid });
          form.dataset.requestId = '';
          saveToken(data.token);
          closeModal();
          showToast('Senha alterada. A sessão foi renovada.', 'success');
        } catch (e) { showModalError(e.message); showToast(e.message, 'error'); }
        finally { setButtonBusy(btn, false); }
      });
    },
  });
}

/* ---------- Ajuda / observações ---------- */
function openHelp(tab) {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  openModal({
    title: 'Ajuda e instalação',
    subtitle: 'Use o aplicativo no computador e adicione à tela inicial do celular.',
    size: 'lg',
    body: `<div class="help-list">
      <div class="help-item"><span class="help-num">1</span><div><strong>Android (Chrome)</strong><p>Abra o endereço do aplicativo no Chrome. Toque no menu ⋮ e escolha <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b>. O ícone abrirá o GitHub Pages em tela cheia.</p></div></div>
      <div class="help-item"><span class="help-num">2</span><div><strong>iPhone / iPad (Safari)</strong><p>Abra o endereço no <b>Safari</b>. Toque em <b>Compartilhar</b> (ícone de quadrado com seta) → <b>Adicionar à Tela de Início</b> → <b>Adicionar</b>. No iPhone, outros navegadores não instalam o PWA da mesma forma.</p></div></div>
      <div class="help-item"><span class="help-num">3</span><div><strong>Atualização dos dados</strong><p>O aplicativo lê os dados atuais ao abrir e ao tocar em <b>Atualizar</b>. Alterações feitas diretamente na planilha aparecem ao recarregar a tela. Não há promessa de atualização em tempo real.</p></div></div>
      <div class="help-item"><span class="help-num">4</span><div><strong>Permissões</strong><p><b>Administrador</b> cadastra, edita, entrega, devolve, transfere, mantém e administra contas. <b>Colaborador</b> apenas visualiza, pesquisa e consulta. O servidor bloqueia qualquer tentativa de alteração por esse perfil.</p></div></div>
      <div class="help-item"><span class="help-num">5</span><div><strong>Histórico e exclusão</strong><p>Equipamentos com movimentações não são excluídos: são inativados para preservar o histórico. A exclusão definitiva só é liberada quando não existe nenhum registro vinculado.</p></div></div>
      <div class="help-item"><span class="help-num">6</span><div><strong>Esqueci a senha do administrador</strong><p>O proprietário gera um código de recuperação no Apps Script. O código vale por 30 minutos e é usado na tela “Esqueci a senha do administrador”.</p></div></div>
    </div>
    ${ios && !window.navigator.standalone ? `<div class="alert alert-info mt-16">${icon('info')}<div>Você está no iPhone/iPad. Use o Safari e o menu Compartilhar para adicionar à Tela de Início.</div></div>` : ''}`,
    foot: `<button type="button" class="btn btn-secondary" data-action="close-modal">Fechar</button>`,
  });
}

function openImportNotes() {
  const notes = (state.data.avisos || []);
  openModal({
    title: 'Avisos de importação e revisão',
    subtitle: 'A origem tem divergências que foram preservadas e marcadas para conferência. Nenhum dado foi inventado.',
    size: 'lg',
    body: notes.length ? `<div class="alert-list">${notes.map((a) => `<div class="alert ${a.tipo === 'REVISAO' ? 'alert-warn' : 'alert-info'}">${icon(a.tipo === 'REVISAO' ? 'alert' : 'info')}<div><strong>${esc(a.titulo)}</strong><br>${esc(a.texto)}</div></div>`).join('')}</div>` : `<div class="alert alert-success">${icon('check')}<div>Nenhum aviso de importação.</div></div>`,
    foot: `<button type="button" class="btn btn-secondary" data-action="close-modal">Fechar</button>${(state.data.stats && state.data.stats.revisar) ? `<button type="button" class="btn btn-primary" data-action="filter-review">Ver equipamentos para revisar</button>` : ''}`,
  });
}

/* ---------- Ações globais (delegação) ---------- */
document.addEventListener('click', async (ev) => {
  const actionEl = ev.target.closest('[data-action]');
  if (actionEl) {
    const action = actionEl.getAttribute('data-action');
    const id = actionEl.getAttribute('data-id');
    if (action === 'close-modal') { closeModal(); return; }
    if (action === 'close-detail') { closeDetail(); return; }
    if (action === 'refresh') { try { await refreshData(); showToast('Dados atualizados.', 'success'); } catch (e) {} return; }
    if (action === 'sync-sheet') { doSyncSheet(actionEl); return; }
    if (action === 'open-equipment') { openEquipment(id); return; }
    if (action === 'deliver-equipment') { openDeliveryModal(id); return; }
    if (action === 'return-equipment') {
      const open = (state.data.emprestimosAbertos || []).filter((l) => l.equipamentoId === id && l.status === 'ABERTO');
      const loan = open.find((l) => l.quantidade > 0) || open.find((l) => l.totalPendente > 0);
      if (loan) openReturnModal(loan.id); else showToast('Nenhum empréstimo ou acessório pendente para este equipamento.', 'info');
      return;
    }
    if (action === 'transfer-equipment') {
      const loan = (state.data.emprestimosAbertos || []).find((l) => l.equipamentoId === id && l.status === 'ABERTO' && l.quantidade > 0);
      if (loan) openTransferModal(loan.id); else showToast('Nenhum equipamento em posse de colaborador para transferir.', 'info');
      return;
    }
    if (action === 'maintenance-equipment') { openMaintenanceForm(id); return; }
    if (action === 'new-equipment') { openEquipmentForm(); return; }
    if (action === 'edit-equipment') {
      const eq = state.detail && state.detail.equipamento;
      if (eq) openEquipmentForm(eq);
      return;
    }
    if (action === 'new-delivery') { openDeliveryModal(); return; }
    if (action === 'new-maintenance') { openMaintenanceForm(); return; }
    if (action === 'new-collaborator') { openCollaboratorForm(); return; }
    if (action === 'edit-collaborator') { const c = (state.data.colaboradores || []).find((x) => x.id === id); if (c) openCollaboratorForm(c); return; }
    if (action === 'new-category') { openCategoryForm(); return; }
    if (action === 'edit-category') { const c = (state.data.categorias || []).find((x) => x.id === id); if (c) openCategoryForm(c); return; }
    if (action === 'new-user') { openUserForm(); return; }
    if (action === 'edit-user') { const u = (state.data.usuarios || []).find((x) => x.id === id); if (u) openUserForm(u); return; }
    if (action === 'reset-user-password') { const u = (state.data.usuarios || []).find((x) => x.id === id); if (u) openResetPassword(u); return; }
    if (action === 'approve-user') {
      const u = (state.data.usuarios || []).find((x) => x.id === id);
      if (u) runAction(actionEl, 'aprovarUsuario', { id }, { successMsg: 'Cadastro aprovado. O usuário já pode entrar.' });
      return;
    }
    if (action === 'reject-user') {
      const u = (state.data.usuarios || []).find((x) => x.id === id);
      if (u) openConfirm({ title: 'Recusar cadastro', message: `Recusar o cadastro de <strong>${esc(u.nome)}</strong>? A conta ficará bloqueada e não poderá entrar.`, confirmLabel: 'Recusar', danger: true, action: 'bloquearUsuario', payload: { id }, successMsg: 'Cadastro recusado.' });
      return;
    }
    if (action === 'show-pending') {
      state.usersCollapsed = false;
      localStorage.setItem(USERS_COLLAPSED_KEY, '0');
      if (state.view === 'usuarios') renderUsersView();
      setTimeout(() => { const el = $('usersList'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120);
      return;
    }
    if (action === 'block-user') {
      const u = (state.data.usuarios || []).find((x) => x.id === id);
      if (u) openConfirm({ title: 'Bloquear usuário', message: `Bloquear <strong>${esc(u.nome)}</strong>? As sessões abertas serão encerradas.`, confirmLabel: 'Bloquear', danger: true, action: 'bloquearUsuario', payload: { id }, successMsg: 'Usuário bloqueado.' });
      return;
    }
    if (action === 'unblock-user') {
      const u = (state.data.usuarios || []).find((x) => x.id === id);
      if (u) openConfirm({ title: 'Desbloquear usuário', message: `Liberar o acesso de <strong>${esc(u.nome)}</strong>?`, confirmLabel: 'Desbloquear', action: 'desbloquearUsuario', payload: { id }, successMsg: 'Usuário desbloqueado.' });
      return;
    }
    if (action === 'inactivate-collaborator') {
      openConfirm({ title: 'Inativar colaborador', message: 'O colaborador deixará de aparecer para novas entregas. O histórico é preservado. Só é permitido se não houver pendências.', confirmLabel: 'Inativar', danger: true, action: 'inativarColaborador', payload: { id }, successMsg: 'Colaborador inativado.' });
      return;
    }
    if (action === 'reactivate-collaborator') { await runAction(actionEl, 'reativarColaborador', { id }, { successMsg: 'Colaborador reativado.' }); return; }
    if (action === 'delete-collaborator') {
      openConfirm({ title: 'Excluir colaborador', message: 'A exclusão definitiva só é permitida quando não há nenhum histórico. Caso contrário, use a inativação.', confirmLabel: 'Excluir', danger: true, action: 'excluirColaborador', payload: { id }, successMsg: 'Colaborador excluído.' });
      return;
    }
    if (action === 'inactivate-category') {
      openConfirm({ title: 'Inativar categoria', message: 'A categoria deixará de aparecer para novos cadastros. Só é permitido se não houver equipamentos ativos.', confirmLabel: 'Inativar', danger: true, action: 'inativarCategoria', payload: { id }, successMsg: 'Categoria inativada.' });
      return;
    }
    if (action === 'reactivate-category') { await runAction(actionEl, 'reativarCategoria', { id }, { successMsg: 'Categoria reativada.' }); return; }
    if (action === 'delete-category') {
      openConfirm({ title: 'Excluir categoria', message: 'A exclusão definitiva só é permitida se a categoria não tiver equipamentos vinculados.', confirmLabel: 'Excluir', danger: true, action: 'excluirCategoria', payload: { id }, successMsg: 'Categoria excluída.' });
      return;
    }
    if (action === 'inactivate-equipment') {
      openConfirm({ title: 'Inativar equipamento', message: 'O equipamento deixará de aparecer como disponível. O histórico é preservado. Só é permitido sem empréstimos ou manutenção abertos.', confirmLabel: 'Inativar', danger: true, action: 'inativarEquipamento', payload: { id }, successMsg: 'Equipamento inativado.', detailId: id });
      return;
    }
    if (action === 'reactivate-equipment') { await runAction(actionEl, 'reativarEquipamento', { id }, { successMsg: 'Equipamento reativado.', detailId: id }); return; }
    if (action === 'delete-equipment') {
      openConfirm({ title: 'Excluir equipamento', message: 'A exclusão definitiva só é permitida quando não há empréstimos, manutenções ou movimentações. Caso contrário, inative o equipamento.', confirmLabel: 'Excluir', danger: true, action: 'excluirEquipamento', payload: { id }, successMsg: 'Equipamento excluído.', onSuccess: closeDetail });
      return;
    }
    if (action === 'review-equipment') {
      const eq = state.detail && state.detail.equipamento;
      if (!eq) return;
      openConfirm({ title: 'Marcar como revisado', message: 'Confirma que os dados deste equipamento foram conferidos? A marcação “revisar” será removida e o motivo ficará registrado.', confirmLabel: 'Confirmar revisão', action: 'marcarRevisadoEquipamento', payload: { id: eq.id }, successMsg: 'Equipamento marcado como revisado.', detailId: eq.id });
      return;
    }
    if (action === 'return-loan') { openReturnModal(id); return; }
    if (action === 'transfer-loan') { openTransferModal(id); return; }
    if (action === 'conclude-maintenance') { openMaintenanceConclude(id); return; }
    if (action === 'edit-maintenance') { openMaintenanceEdit(id); return; }
    if (action === 'cancel-maintenance') { openMaintenanceCancel(id); return; }
    if (action === 'detail-tab') { state.detailTab = actionEl.getAttribute('data-tab'); renderDetailDrawer(); return; }
    if (action === 'show-import-notes') { openImportNotes(); return; }
    if (action === 'filter-review') { closeModal(); state.eqFilters.revisar = true; state.eqPage = 1; setView('equipamentos'); return; }
    if (action === 'go-equipamentos') { setView('equipamentos'); return; }
    if (action === 'go-movimentacoes') { setView('movimentacoes'); return; }
    if (action === 'go-manutencoes') { setView('manutencoes'); return; }
    if (action === 'stat-go-equip') { setView('equipamentos'); return; }
    if (action === 'stat-go-pending') { setView('movimentacoes'); return; }
    if (action === 'stat-go-man') { setView('manutencoes'); return; }
    if (action === 'filter-category') { state.eqFilters.categoria = id; state.eqFilters.q = ''; state.eqPage = 1; setView('equipamentos'); return; }
    if (action === 'filter-colaborador') { state.eqFilters.q = actionEl.getAttribute('data-name') || ''; state.eqFilters.categoria = ''; state.eqPage = 1; setView('equipamentos'); return; }
    if (action === 'eq-clear') { state.eqFilters = { q: '', categoria: '', status: '', conservacao: '', revisar: false }; state.eqPage = 1; renderEquipmentView(); return; }
    if (action === 'eq-page') { state.eqPage = Number(actionEl.getAttribute('data-page')) || 1; renderEquipmentList(); scrollTop(); return; }
    if (action === 'mov-page') { loadMovements(Number(actionEl.getAttribute('data-page')) || 1); scrollTop(); return; }
    if (action === 'audit-page') { loadAudit(Number(actionEl.getAttribute('data-page')) || 1); scrollTop(); return; }
    if (action === 'mov-clear') { state.movFilters = { tipo: '', busca: '', dataInicio: '', dataFim: '' }; state.movPage = 1; renderMovementsView(); return; }
    if (action === 'man-clear') { state.manFilters = { status: '', busca: '' }; renderMaintenanceView(); return; }
    if (action === 'change-password') { closeUserMenu(); openChangePassword(); return; }
    if (action === 'logout') { await doLogout(); return; }
    return;
  }
  if (ev.target.matches && ev.target.matches('[data-modal-backdrop]')) { closeModal(); return; }
  if (ev.target.id === 'sidebarBackdrop') { closeSidebar(); return; }
});

document.addEventListener('keydown', (ev) => {
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target && ev.target.matches && ev.target.matches('[role="button"][data-action]')) {
    ev.preventDefault();
    ev.target.click();
    return;
  }
  if (ev.key === 'Escape') {
    if ($('modalRoot') && $('modalRoot').innerHTML) { closeModal(); return; }
    if ($('detailRoot')) { closeDetail(); return; }
    if ($('sidebar').classList.contains('open')) { closeSidebar(); return; }
  }
  if (ev.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    const s = $('globalSearch'); if (s && s.offsetParent !== null) { ev.preventDefault(); s.focus(); }
  }
});

/* ---------- Logout / menu ---------- */
async function doLogout() {
  closeUserMenu();
  closeSidebar();
  try { await api('logout', {}, { requestId: genId() }); } catch (e) {}
  saveToken('');
  resetListCaches();
  state.data = null;
  state.user = null;
  state.syncRunning = false;
  state.postLoadScheduled = false;
  state.prefetchPromise = null;
  closeDetail();
  closeModal();
  hideApp();
  showAuth('login', 'Sessão encerrada.', 'success');
}
function closeUserMenu() { const m = $('userMenu'); if (m) m.classList.add('hidden'); }

/* ---------- Eventos estáticos / inicialização ---------- */
function bindStaticEvents() {
  $('loginForm').addEventListener('submit', doLogin);
  $('setupForm').addEventListener('submit', doSetup);
  $('recoveryForm').addEventListener('submit', doRecovery);
  $('signupForm').addEventListener('submit', doSignup);
  $('showRecovery').addEventListener('click', () => showAuth('recovery'));
  $('backToLogin').addEventListener('click', () => showAuth('login'));
  $('retrySetupStatus').addEventListener('click', checkInitial);
  $('retryConnection').addEventListener('click', checkInitial);
  $('connectionLogout').addEventListener('click', () => { saveToken(''); resetListCaches(); showAuth('login'); });
  $('helpBtn').addEventListener('click', () => openHelp());
  $('authInstallBtn').addEventListener('click', async () => {
    if (state.deferredPrompt) {
      state.deferredPrompt.prompt();
      await state.deferredPrompt.userChoice;
      state.deferredPrompt = null;
      $('installAppBtn').hidden = true;
    } else {
      openHelp('install');
    }
  });
  $('menuBtn').addEventListener('click', openSidebar);
  $('sidebarClose').addEventListener('click', closeSidebar);
  $('sidebarBackdrop').addEventListener('click', closeSidebar);
  $('refreshBtn').addEventListener('click', async () => { try { await refreshData(); showToast('Dados atualizados.', 'success'); } catch (e) {} });
  $('userMenuBtn').addEventListener('click', (e) => { e.stopPropagation(); $('userMenu').classList.toggle('hidden'); });
  $('topbarUser').addEventListener('click', (e) => { e.stopPropagation(); if (window.innerWidth <= 1020) openSidebar(); $('userMenu').classList.toggle('hidden'); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#userMenu') && !e.target.closest('#userMenuBtn') && !e.target.closest('#topbarUser')) closeUserMenu(); });
  $('changePasswordBtn').addEventListener('click', openChangePassword);
  $('logoutBtn').addEventListener('click', doLogout);
  document.querySelectorAll('.nav-item').forEach((b) => b.addEventListener('click', () => setView(b.getAttribute('data-view'))));
  document.querySelectorAll('[data-toggle-password]').forEach((b) => b.addEventListener('click', () => {
    const input = $(b.getAttribute('data-toggle-password'));
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    b.textContent = input.type === 'password' ? '◉' : '◌';
  }));
  const gs = $('globalSearch');
  if (gs) gs.addEventListener('input', debounce(() => {
    const q = gs.value.trim();
    if (!q) return;
    state.eqFilters = { q, categoria: '', status: '', conservacao: '', revisar: false };
    state.eqPage = 1;
    if (state.view !== 'equipamentos') setView('equipamentos');
    else renderEquipmentList();
  }, 320));
  window.addEventListener('hashchange', () => {
    const h = location.hash.replace(/^#\/?/, '');
    if (VIEW_META[h] && h !== state.view) { state.view = h; closeSidebar(); updateChrome(); renderCurrentView(); }
  });
  window.addEventListener('online', () => { $('offlineBanner').classList.add('hidden'); showToast('Conexão restabelecida.', 'success'); });
  window.addEventListener('offline', () => { $('offlineBanner').classList.remove('hidden'); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.data && state.token && !state.syncRunning && !$('modalRoot').innerHTML) {
      const last = state.data.atualizadoEm ? new Date(state.data.atualizadoEm.replace(' ', 'T')).getTime() : 0;
      if (!last || Date.now() - last > 300000) refreshData({ silent: true }).catch(() => {});
    }
  });
}

/* ---------- PWA ---------- */
function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      const showUpdate = (worker) => {
        if (!worker || !navigator.serviceWorker.controller) return;
        $('updateBanner').classList.remove('hidden');
        $('reloadAppBtn').onclick = () => { worker.postMessage('SKIP_WAITING'); setTimeout(() => location.reload(), 150); };
      };
      if (reg.waiting) showUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => { if (nw.state === 'installed') showUpdate(nw); });
      });
    }).catch(() => {});
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    $('installAppBtn').hidden = false;
    updateChrome();
  });
  window.addEventListener('appinstalled', () => {
    state.deferredPrompt = null;
    $('installAppBtn').hidden = true;
    showToast('Aplicativo instalado na tela inicial.', 'success');
  });
  $('installAppBtn').addEventListener('click', async () => {
    if (!state.deferredPrompt) { openHelp('install'); return; }
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;
    state.deferredPrompt = null;
    $('installAppBtn').hidden = true;
  });
}

/* ---------- Inicialização ---------- */
function init() {
  hydrateIcons(document);
  bindStaticEvents();
  initPWA();
  if (!API_URL) {
    showBoot(false);
    showAuth('login', 'O endereço da API não está configurado. Atualize o config.js com a URL publicada do Apps Script.', 'error');
    return;
  }
  checkInitial();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
