/**
 * Utilitários de planilha, segurança, cache, locks e respostas.
 */

class ApiError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details || null;
  }
}

function fail(code, message, details) {
  throw new ApiError(code, message, details);
}

function assert(cond, code, message) {
  if (!cond) fail(code, message);
}

function getSpreadsheet() {
  const override = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return SpreadsheetApp.openById(override || SPREADSHEET_ID);
}

function getSheet(name) {
  const sh = getSpreadsheet().getSheetByName(name);
  if (!sh) fail('ESTRUTURA_AUSENTE', 'A aba ' + name + ' não existe. A estrutura da planilha precisa ser configurada.');
  return sh;
}

function sheetHeaders(name) {
  const sh = getSheet(name);
  const lastCol = Math.max(sh.getLastColumn(), (HEADERS[name] || []).length);
  if (lastCol < 1) return (HEADERS[name] || []).slice();
  const row = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const headers = row.map(function (h) { return String(h || '').trim(); }).filter(function (h) { return h; });
  return headers.length ? headers : (HEADERS[name] || []).slice();
}

function readObjects(name) {
  const sh = getSheet(name);
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 1) return [];
  const headers = values[0].map(function (h) { return String(h || '').trim(); });
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    let has = false;
    for (let j = 0; j < row.length; j++) {
      if (row[j] !== '' && row[j] !== null && row[j] !== undefined) { has = true; break; }
    }
    if (!has) continue;
    const o = { _row: i + 1 };
    for (let j = 0; j < headers.length; j++) {
      if (!headers[j]) continue;
      o[headers[j]] = normalizarValor(row[j]);
    }
    out.push(o);
  }
  return out;
}

function normalizarValor(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  if (v === null || v === undefined) return '';
  return v;
}

function objectToRow(name, obj) {
  const headers = HEADERS[name] || sheetHeaders(name);
  return headers.map(function (h) {
    const v = obj[h];
    if (v === null || v === undefined) return '';
    return v;
  });
}

function appendObject(name, obj) {
  const sh = getSheet(name);
  const headers = HEADERS[name] || sheetHeaders(name);
  const row = Math.max(2, sh.getLastRow() + 1);
  const values = objectToRow(name, obj);
  const target = sh.getRange(row, 1, 1, Math.max(headers.length, 1));
  target.setNumberFormat('@');
  target.setValues([values]);
  return row;
}

function updateObject(name, rowNumber, obj) {
  if (!rowNumber || rowNumber < 2) fail('REGISTRO_INVALIDO', 'Registro inválido para atualização.');
  const sh = getSheet(name);
  const headers = HEADERS[name] || sheetHeaders(name);
  const values = objectToRow(name, obj);
  const target = sh.getRange(rowNumber, 1, 1, Math.max(headers.length, 1));
  target.setNumberFormat('@');
  target.setValues([values]);
}

function deleteObject(name, rowNumber) {
  if (!rowNumber || rowNumber < 2) fail('REGISTRO_INVALIDO', 'Registro inválido para exclusão.');
  getSheet(name).deleteRow(rowNumber);
}

function nowStamp() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
}

function todayIso() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function newId(prefix) {
  return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 16).toUpperCase();
}

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizarTexto(txt) {
  return String(txt === null || txt === undefined ? '' : txt).trim().replace(/\s+/g, ' ');
}

function normalizarKey(txt) {
  return normalizarTexto(txt).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

function limparTexto(v, max) {
  let s = String(v === null || v === undefined ? '' : v).trim();
  if (s.slice(0, 1) === '=') fail('TEXTO_INVALIDO', 'Não use o sinal "=" no início de um texto.');
  if (max && s.length > max) fail('TEXTO_LONGO', 'O texto ultrapassou o limite de ' + max + ' caracteres.');
  return s;
}

function toNumber(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v === null || v === undefined ? '' : v).trim().replace(',', '.');
  if (!s) return 0;
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function toInt(v) {
  return Math.trunc(toNumber(v));
}

function isSim(v) {
  const s = String(v === null || v === undefined ? '' : v).trim().toUpperCase();
  return s === 'SIM' || s === 'TRUE' || s === '1' || v === true;
}

function boolText(b) {
  return b ? 'SIM' : 'NAO';
}

function jsonParseSafe(txt, fallback) {
  if (txt === null || txt === undefined || txt === '') return fallback;
  if (typeof txt === 'object') return txt;
  try { return JSON.parse(String(txt)); } catch (e) { return fallback; }
}

function jsonText(v) {
  try { return JSON.stringify(v === undefined ? null : v); } catch (e) { return 'null'; }
}

function sha256Hex(txt) {
  return bytesToHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(txt), Utilities.Charset.UTF_8));
}

function bytesToHex(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    out += ('0' + b.toString(16)).slice(-2);
  }
  return out;
}

function iguaisSeguro(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

function isIsoDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
  const p = String(s).split('-');
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return d.getFullYear() === Number(p[0]) && d.getMonth() === Number(p[1]) - 1 && d.getDate() === Number(p[2]);
}

function validarData(v, obrigatoria, campo) {
  const s = String(v === null || v === undefined ? '' : v).trim();
  if (!s) {
    if (obrigatoria) fail('DATA_OBRIGATORIA', 'Informe ' + (campo || 'a data') + '.');
    return '';
  }
  if (!isIsoDate(s)) fail('DATA_INVALIDA', 'Data inválida em ' + (campo || 'data') + '. Use o formato AAAA-MM-DD.');
  return s;
}

function getConfigMap() {
  const rows = readObjects(SHEET.CONFIG);
  const map = {};
  rows.forEach(function (r) { map[String(r.CHAVE || '').trim()] = String(r.VALOR === null || r.VALOR === undefined ? '' : r.VALOR); });
  return map;
}

function configGet(key) {
  const map = getConfigMap();
  return map[String(key)] === undefined ? '' : map[String(key)];
}

function configSetMany(pairs) {
  const sh = getSheet(SHEET.CONFIG);
  const rows = readObjects(SHEET.CONFIG);
  const byKey = {};
  rows.forEach(function (r) { byKey[String(r.CHAVE || '').trim()] = r; });
  const now = nowStamp();
  Object.keys(pairs).forEach(function (k) {
    const val = pairs[k];
    if (byKey[k]) {
      const obj = byKey[k];
      obj.VALOR = val;
      obj.ATUALIZADO_EM = now;
      updateObject(SHEET.CONFIG, obj._row, obj);
    } else {
      appendObject(SHEET.CONFIG, { CHAVE: k, VALOR: val, ATUALIZADO_EM: now });
    }
  });
}

function configSet(key, value) {
  const p = {};
  p[key] = value;
  configSetMany(p);
}

function cacheGet(key) {
  try { return CacheService.getScriptCache().get(String(key)); } catch (e) { return null; }
}

function cachePut(key, value, seconds) {
  try { CacheService.getScriptCache().put(String(key), String(value), seconds || 60); } catch (e) {}
}

function cacheRemove(key) {
  try { CacheService.getScriptCache().remove(String(key)); } catch (e) {}
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function requireRequestId(requestId) {
  const s = String(requestId || '').trim();
  assert(/^[A-Za-z0-9_-]{8,80}$/.test(s), 'REQUISICAO_INVALIDA', 'Identificador da requisição inválido. Recarregue a tela e tente novamente.');
  return s;
}

function withIdempotencia(requestId, fn) {
  const id = requireRequestId(requestId);
  const key = 'idem_' + id;
  const cached = cacheGet(key);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }
  const result = fn();
  cachePut(key, JSON.stringify(result), IDEMPOTENCIA_SEGUNDOS);
  return result;
}

function audit(session, acao, entidade, entidadeId, detalhes, requestId, origem) {
  try {
    const s = session || {};
    appendObject(SHEET.AUDITORIA, {
      ID: newId('AUD'),
      DATA: nowStamp(),
      USUARIO_ID: s.id || '',
      USUARIO_EMAIL: s.email || 'SISTEMA',
      PERFIL: s.perfil || '',
      ACAO: String(acao || '').slice(0, 80),
      ENTIDADE: String(entidade || '').slice(0, 60),
      ENTIDADE_ID: String(entidadeId || '').slice(0, 80),
      DETALHES: String(typeof detalhes === 'string' ? detalhes : jsonText(detalhes)).slice(0, 4000),
      ORIGEM: origem || 'APP',
      REQUEST_ID: String(requestId || '').slice(0, 80)
    });
  } catch (e) {
    console.error('Falha ao gravar auditoria: ' + e);
  }
}

function respostaErro(code, message, details) {
  const err = { code: code || 'ERRO', message: message || 'Não foi possível concluir a operação.' };
  if (details) err.details = details;
  return { ok: false, error: err };
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function exigirAdmin(session) {
  assert(session && session.perfil === PERFIL.ADMIN, 'SEM_PERMISSAO', 'Esta operação é exclusiva do administrador.');
}

function exigirAutenticado(session) {
  assert(session && session.id, 'NAO_AUTENTICADO', 'Entre no aplicativo para continuar.');
}

function lerTodosEquipamentos() { return readObjects(SHEET.EQUIPAMENTOS); }
function lerTodosColaboradores() { return readObjects(SHEET.COLABORADORES); }
function lerTodasCategorias() { return readObjects(SHEET.CATEGORIAS); }
function lerTodosEmprestimos() { return readObjects(SHEET.EMPRESTIMOS); }
function lerTodasManutencoes() { return readObjects(SHEET.MANUTENCOES); }
function lerTodosMovimentos() { return readObjects(SHEET.MOVIMENTACOES); }
function lerTodosUsuarios() { return readObjects(SHEET.USUARIOS); }

function porId(arr, id) {
  const alvo = String(id || '');
  for (let i = 0; i < arr.length; i++) if (String(arr[i].ID || '') === alvo) return arr[i];
  return null;
}

function exigirRegistro(obj, code, msg) {
  if (!obj) fail(code || 'NAO_ENCONTRADO', msg || 'Registro não encontrado.');
  return obj;
}
