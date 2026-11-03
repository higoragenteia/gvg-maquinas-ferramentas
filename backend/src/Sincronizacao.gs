/**
 * Sincronização das abas originais (PARAFUSADEIRA, MARTELETE etc.) com o
 * estado atual das abas do sistema, e criação de novas abas de categoria.
 *
 * A aba do sistema EQUIPAMENTOS continua sendo a fonte de verdade. As abas
 * originais são espelhos legíveis: responsável atual, datas, conservação,
 * acessórios e cor da linha. O histórico completo permanece em
 * MOVIMENTACOES/EMPRESTIMOS/MANUTENCOES.
 */

function sanitizarNomeAba(nome) {
  let s = normalizarTexto(nome);
  s = s.replace(/[:\\/?*\[\]]/g, '-').replace(/\s+/g, ' ').trim();
  s = s.replace(/^'+|'+$/g, '').trim();
  if (s.length > 90) s = s.slice(0, 90).trim();
  if (!s) fail('ABA_INVALIDA', 'O nome da aba não pode ficar vazio.');
  return s;
}

function criarAbaCategoria(nomeDesejado, campoItem, excetoCategoriaId) {
  const ss = getSpreadsheet();
  const nome = sanitizarNomeAba(nomeDesejado);
  const abas = ss.getSheets();
  for (let i = 0; i < abas.length; i++) {
    if (normalizarKey(abas[i].getName()) === normalizarKey(nome)) {
      fail('ABA_EM_USO', 'Já existe uma aba na planilha com o nome "' + nome + '". Escolha outro nome para a categoria.');
    }
  }
  const cats = lerTodasCategorias();
  for (let i = 0; i < cats.length; i++) {
    if (String(cats[i].ID) === String(excetoCategoriaId || '')) continue;
    if (String(cats[i].NOME_ABA || '').trim() && normalizarKey(cats[i].NOME_ABA) === normalizarKey(nome)) {
      fail('ABA_EM_USO', 'A aba "' + nome + '" já está vinculada a outra categoria.');
    }
  }
  let sh = null;
  try {
    sh = ss.insertSheet(nome);
    const titulo = sh.getRange(1, 1, 1, 12);
    titulo.merge();
    titulo.setValue(nome);
    titulo.setFontWeight('bold');
    titulo.setFontSize(14);
    titulo.setHorizontalAlignment('center');
    titulo.setVerticalAlignment('middle');
    titulo.setBackground('#0B1F3A');
    titulo.setFontColor('#FFFFFF');
    sh.setRowHeight(1, 34);
    sh.setRowHeight(2, 10);
    const headers = ['Nº', 'COLABORADOR', 'ESTADO', campoItem || nome, 'QT', 'CARREGADOR', 'QT', 'BATERIA', 'QT', 'ENTREGA', 'DEVOLUÇÃO', 'ASSINATURA'];
    const hr = sh.getRange(3, 1, 1, 12);
    hr.setValues([headers]);
    hr.setFontWeight('bold');
    hr.setBackground('#E8EEF7');
    hr.setFontColor('#0B1F3A');
    hr.setHorizontalAlignment('center');
    hr.setVerticalAlignment('middle');
    hr.setWrap(true);
    sh.setFrozenRows(3);
    const larguras = [70, 145, 85, 150, 45, 100, 45, 135, 45, 92, 92, 190];
    larguras.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
    const numeros = [];
    for (let i = 1; i <= 50; i++) numeros.push([String(i)]);
    const nr = sh.getRange(4, 1, 50, 1);
    nr.setValues(numeros);
    nr.setHorizontalAlignment('center');
    nr.setNumberFormat('@');
    sh.getRange(4, 4, 50, 1).setNumberFormat('@');
    sh.getRange(4, 6, 50, 1).setNumberFormat('@');
    sh.getRange(4, 8, 50, 1).setNumberFormat('@');
    sh.getRange(4, 10, 50, 2).setNumberFormat('dd/mm/yyyy');
    sh.getRange(4, 1, 50, 12).setVerticalAlignment('middle');
    sh.setTabColor('#1F5FA8');
    return { nome: nome, sheet: sh, criada: true };
  } catch (e) {
    if (sh) { try { ss.deleteSheet(sh); } catch (e2) {} }
    throw e;
  }
}

function garantirAbaCategoria(cat) {
  const ss = getSpreadsheet();
  const nomeAtual = String(cat.NOME_ABA || '').trim();
  if (nomeAtual) {
    const existente = ss.getSheetByName(nomeAtual);
    if (existente) return { nome: nomeAtual, sheet: existente, criada: false };
  }
  const aba = criarAbaCategoria(nomeAtual || cat.NOME, cat.CAMPO_ITEM || 'ITEM', cat.ID);
  cat.NOME_ABA = aba.nome;
  cat.ATUALIZADO_EM = nowStamp();
  if (cat._row) updateObject(SHEET.CATEGORIAS, cat._row, cat);
  return { nome: aba.nome, sheet: aba.sheet, criada: true };
}

function proximoNumeroAba(sh) {
  const last = Math.max(sh.getLastRow(), 4);
  const vals = sh.getRange(4, 1, last - 3, 1).getValues();
  let max = 0;
  vals.forEach(function (r) {
    const m = String(r[0] || '').trim().match(/^\d+$/);
    if (m) max = Math.max(max, Number(m[0]));
  });
  return String(max + 1);
}

function linhaAbaValida(sh, row, eq, eqs, catId) {
  if (!row || row < 4) return false;
  const last = Math.max(sh.getLastRow(), 4);
  if (row > last) return false;
  const vals = sh.getRange(row, 1, 1, 12).getValues()[0];
  if (normalizarKey(vals[1] || '').indexOf('OBS') === 0 && !String(vals[3] || '').trim()) return false;
  for (let i = 0; i < eqs.length; i++) {
    const e = eqs[i];
    if (String(e.ID) === String(eq.ID)) continue;
    if (String(e.CATEGORIA_ID) === String(catId) && toInt(e.ORIGEM_LINHA) === row) return false;
  }
  return true;
}

function alocarLinhaAba(sh, catId, eq, eqs) {
  const last = Math.max(sh.getLastRow(), 4);
  const vals = sh.getRange(4, 1, Math.max(1, last - 3), 12).getValues();
  const usadas = {};
  eqs.forEach(function (e) {
    if (String(e.CATEGORIA_ID) === String(catId) && String(e.ID) !== String(eq.ID) && toInt(e.ORIGEM_LINHA) > 0) {
      usadas[toInt(e.ORIGEM_LINHA)] = true;
    }
  });
  for (let i = 0; i < vals.length; i++) {
    const rowNumber = i + 4;
    if (usadas[rowNumber]) continue;
    const v = vals[i];
    const a = String(v[0] || '').trim();
    if (!a) continue;
    if (normalizarKey(v[1] || '').indexOf('OBS') === 0 && !String(v[3] || '').trim()) continue;
    let vazio = true;
    for (let c = 1; c < 12; c++) {
      if (String(v[c] === null || v[c] === undefined ? '' : v[c]).trim() !== '') { vazio = false; break; }
    }
    if (vazio) return { row: rowNumber, numero: a };
  }
  // usa uma linha sem numeração, antes do resumo se possível
  let resumoRow = 0;
  for (let i = 0; i < vals.length; i++) {
    const rowNumber = i + 4;
    if (usadas[rowNumber]) continue;
    const v = vals[i];
    if (normalizarKey(v[1] || '').indexOf('OBS') === 0) { resumoRow = rowNumber; break; }
    let vazio = true;
    for (let c = 0; c < 12; c++) {
      if (String(v[c] === null || v[c] === undefined ? '' : v[c]).trim() !== '') { vazio = false; break; }
    }
    if (vazio) return { row: rowNumber, numero: proximoNumeroAba(sh) };
  }
  const numero = proximoNumeroAba(sh);
  if (resumoRow > 0) {
    sh.insertRowBefore(resumoRow);
    return { row: resumoRow, numero: numero };
  }
  const row = Math.max(sh.getLastRow() + 1, 4);
  return { row: row, numero: numero };
}

function formatarLinhaAba(sh, row) {
  sh.getRange(row, 1).setNumberFormat('@');
  sh.getRange(row, 4).setNumberFormat('@');
  sh.getRange(row, 6).setNumberFormat('@');
  sh.getRange(row, 8).setNumberFormat('@');
  sh.getRange(row, 10, 1, 2).setNumberFormat('dd/mm/yyyy');
}

function corStatusAba(status) {
  if (status === STATUS_EQ.MANUTENCAO) return '#FF0000';
  if (status === STATUS_EQ.INATIVO) return '#D9D9D9';
  if (status === STATUS_EQ.DISPONIVEL) return '#92D050';
  return '#FFFF00';
}

function estadoAba(valor) {
  const s = String(valor || '').toUpperCase();
  if (s === 'NAO_INFORMADO') return '';
  return s;
}

function dataParaIso(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  const s = String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}

function isoParaData(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

function notaPendenciasAba(loans) {
  const partes = [];
  (loans || []).forEach(function (l) {
    if (String(l.STATUS) !== STATUS_LOAN.ABERTO) return;
    const p = jsonParseSafe(l.ACESSORIOS_PENDENTES, []);
    if (!p.length) return;
    const itens = p.map(function (a) {
      const q = toInt(a.qtd);
      if (a.tipo === 'BATERIA') return q + ' ' + (q === 1 ? 'bateria' : 'baterias');
      return q + ' ' + (q === 1 ? 'carregador' : 'carregadores');
    }).join(', ');
    partes.push((l.COLABORADOR_NOME || 'Colaborador') + ': ' + itens);
  });
  return partes.length ? 'Acessórios pendentes — ' + partes.join('; ') : '';
}

function dadosAbaEquipamento(eq, rowAtual, loans) {
  rowAtual = rowAtual || [];
  const abertos = (loans || []).filter(function (l) { return String(l.STATUS) === STATUS_LOAN.ABERTO && toInt(l.QUANTIDADE) > 0; });
  const entregas = (loans || []).map(function (l) { return dataParaIso(l.DATA_ENTREGA); }).filter(Boolean).sort();
  const devolvidas = (loans || []).filter(function (l) {
    return String(l.EQUIPAMENTO_DEVOLVIDO) === 'SIM' && String(l.STATUS) !== STATUS_LOAN.TRANSFERIDO;
  }).map(function (l) { return dataParaIso(l.DATA_DEVOLUCAO_EQUIPAMENTO); }).filter(Boolean).sort();
  let jIso = '';
  let kIso = '';
  if ((loans || []).length > 0) {
    if (abertos.length > 0) {
      const datasAbertas = abertos.map(function (l) { return dataParaIso(l.DATA_ENTREGA); }).filter(Boolean).sort();
      jIso = datasAbertas.length ? datasAbertas[0] : (entregas.length ? entregas[entregas.length - 1] : '');
      kIso = '';
    } else {
      jIso = entregas.length ? entregas[entregas.length - 1] : '';
      kIso = devolvidas.length ? devolvidas[devolvidas.length - 1] : '';
    }
  } else {
    jIso = dataParaIso(rowAtual[9]);
    kIso = dataParaIso(rowAtual[10]);
  }
  const status = String(eq.STATUS || '');
  const b = status === STATUS_EQ.MANUTENCAO ? 'MANUTENÇÃO' : (status === STATUS_EQ.INATIVO ? '' : String(eq.COLABORADOR_ATUAL_NOME || ''));
  const c = estadoAba(eq.ESTADO_CONSERVACAO);
  const d = String(eq.CODIGO_MODELO || eq.MODELO || '');
  const e = toNumber(eq.QUANTIDADE_TOTAL);
  const f = toInt(eq.CARREGADOR_QTD) > 0 ? String(eq.CARREGADOR_CODIGO || '') : '0';
  const g = toInt(eq.CARREGADOR_QTD);
  const h = toInt(eq.BATERIA_QTD) > 0 ? String(eq.BATERIA_CODIGO || '') : '0';
  const i = toInt(eq.BATERIA_QTD);
  const l = String(eq.OBSERVACOES || '');
  return {
    numero: String(eq.ORIGEM_NUMERO || rowAtual[0] || '').trim(),
    b: b, c: c, d: d, e: e, f: f, g: g, h: h, i: i,
    jIso: jIso, kIso: kIso, j: isoParaData(jIso), k: isoParaData(kIso), l: l,
    cor: corStatusAba(status), nota: notaPendenciasAba(loans)
  };
}

function sincronizarEquipamento(eqOrId, opts) {
  opts = opts || {};
  const eq = typeof eqOrId === 'string' ? porId(lerTodosEquipamentos(), eqOrId) : eqOrId;
  assert(eq, 'EQUIPAMENTO_NAO_ENCONTRADO', 'Equipamento não encontrado para sincronização.');
  const cats = lerTodasCategorias();
  const cat = porId(cats, eq.CATEGORIA_ID);
  assert(cat, 'CATEGORIA_NAO_ENCONTRADA', 'Categoria do equipamento não encontrada.');
  const abaInfo = garantirAbaCategoria(cat);
  const sh = abaInfo.sheet;
  const eqs = lerTodosEquipamentos();
  const last = Math.max(sh.getLastRow(), 4);
  let row = toInt(eq.ORIGEM_LINHA);
  let numero = String(eq.ORIGEM_NUMERO || '').trim();
  if (!linhaAbaValida(sh, row, eq, eqs, cat.ID)) row = 0;
  if (!row) {
    const aloc = alocarLinhaAba(sh, cat.ID, eq, eqs);
    row = aloc.row;
    numero = String(aloc.numero || '').trim() || String(sh.getRange(row, 1).getValue() || '').trim();
    eq.ORIGEM_ABA = abaInfo.nome;
    eq.ORIGEM_LINHA = row;
    eq.ORIGEM_NUMERO = numero;
    if (eq._row) updateObject(SHEET.EQUIPAMENTOS, eq._row, eq);
  } else {
    if (!numero) numero = String(sh.getRange(row, 1).getValue() || '').trim();
    if (String(eq.ORIGEM_ABA || '') !== abaInfo.nome || toInt(eq.ORIGEM_LINHA) !== row || String(eq.ORIGEM_NUMERO || '') !== numero) {
      eq.ORIGEM_ABA = abaInfo.nome;
      eq.ORIGEM_LINHA = row;
      eq.ORIGEM_NUMERO = numero;
      if (eq._row) updateObject(SHEET.EQUIPAMENTOS, eq._row, eq);
    }
  }
  const rowAtual = sh.getRange(row, 1, 1, 12).getValues()[0];
  const loans = lerTodosEmprestimos().filter(function (l) { return String(l.EQUIPAMENTO_ID) === String(eq.ID); });
  const abertos = loans.filter(function (l) { return String(l.STATUS) === STATUS_LOAN.ABERTO && toInt(l.QUANTIDADE) > 0; });
  const entregas = loans.map(function (l) { return dataParaIso(l.DATA_ENTREGA); }).filter(Boolean).sort();
  const devolvidas = loans.filter(function (l) {
    return String(l.EQUIPAMENTO_DEVOLVIDO) === 'SIM' && String(l.STATUS) !== STATUS_LOAN.TRANSFERIDO;
  }).map(function (l) { return dataParaIso(l.DATA_DEVOLUCAO_EQUIPAMENTO); }).filter(Boolean).sort();
  let jIso = '';
  let kIso = '';
  if (loans.length > 0) {
    if (abertos.length > 0) {
      const datasAbertas = abertos.map(function (l) { return dataParaIso(l.DATA_ENTREGA); }).filter(Boolean).sort();
      jIso = datasAbertas.length ? datasAbertas[0] : (entregas.length ? entregas[entregas.length - 1] : '');
      kIso = '';
    } else {
      jIso = entregas.length ? entregas[entregas.length - 1] : '';
      kIso = devolvidas.length ? devolvidas[devolvidas.length - 1] : '';
    }
  } else {
    // Equipamento importado sem empréstimo reconstruído: preserva as datas da origem.
    jIso = dataParaIso(rowAtual[9]);
    kIso = dataParaIso(rowAtual[10]);
  }
  const status = String(eq.STATUS || '');
  const b = status === STATUS_EQ.MANUTENCAO ? 'MANUTENÇÃO' : (status === STATUS_EQ.INATIVO ? '' : String(eq.COLABORADOR_ATUAL_NOME || ''));
  const c = estadoAba(eq.ESTADO_CONSERVACAO);
  const d = String(eq.CODIGO_MODELO || eq.MODELO || '');
  const e = toNumber(eq.QUANTIDADE_TOTAL);
  const f = toInt(eq.CARREGADOR_QTD) > 0 ? String(eq.CARREGADOR_CODIGO || '') : '0';
  const g = toInt(eq.CARREGADOR_QTD);
  const h = toInt(eq.BATERIA_QTD) > 0 ? String(eq.BATERIA_CODIGO || '') : '0';
  const i = toInt(eq.BATERIA_QTD);
  const j = isoParaData(jIso);
  const k = isoParaData(kIso);
  const l = String(eq.OBSERVACOES || '');
  if (!numero) numero = String(rowAtual[0] || '').trim();
  formatarLinhaAba(sh, row);
  sh.getRange(row, 1, 1, 12).setValues([[numero, b, c, d, e, f, g, h, i, j, k, l]]);
  const cor = corStatusAba(status);
  sh.getRange(row, 2).setBackground(cor);
  const nota = notaPendenciasAba(loans);
  if (nota) sh.getRange(row, 2).setNote(nota); else sh.getRange(row, 2).clearNote();
  // Confirma a persistência na aba original.
  const lidos = sh.getRange(row, 1, 1, 12).getValues()[0];
  const problemas = [];
  const cmp = function (campo, esperado, lido) {
    if (String(esperado === null || esperado === undefined ? '' : esperado) !== String(lido === null || lido === undefined ? '' : lido)) {
      problemas.push(campo);
    }
  };
  cmp('Nº', numero, String(lidos[0] || '').trim());
  cmp('COLABORADOR', b, String(lidos[1] || '').trim());
  cmp('ESTADO', c, String(lidos[2] || '').trim());
  cmp('ITEM', d, String(lidos[3] || '').trim());
  cmp('QT', e, toNumber(lidos[4]));
  cmp('CARREGADOR', f, String(lidos[5] || '').trim());
  cmp('QT CARREGADOR', g, toNumber(lidos[6]));
  cmp('BATERIA', h, String(lidos[7] || '').trim());
  cmp('QT BATERIA', i, toNumber(lidos[8]));
  cmp('ENTREGA', jIso, dataParaIso(lidos[9]));
  cmp('DEVOLUÇÃO', kIso, dataParaIso(lidos[10]));
  cmp('ASSINATURA', l, String(lidos[11] || '').trim());
  if (String(sh.getRange(row, 2).getBackground() || '').toLowerCase() !== cor.toLowerCase()) problemas.push('COR');
  if (problemas.length) {
    fail('SINCRONIZACAO_FALHOU', 'A aba "' + abaInfo.nome + '" não confirmou a gravação dos campos: ' + problemas.join(', ') + '.');
  }
  return { aba: abaInfo.nome, linha: row, numero: numero };
}

function sincronizarEquipamentoSeguro(eqOrId, opts) {
  opts = opts || {};
  let eq = typeof eqOrId === 'string' ? porId(lerTodosEquipamentos(), eqOrId) : eqOrId;
  try {
    return Object.assign({ ok: true }, sincronizarEquipamento(eq, opts));
  } catch (e) {
    const aba = (() => {
      try {
        const cats = lerTodasCategorias();
        const c = porId(cats, eq && eq.CATEGORIA_ID);
        return c ? String(c.NOME_ABA || c.NOME || '') : '';
      } catch (e2) { return ''; }
    })();
    try {
      audit(opts.session, 'SINCRONIZACAO_FALHOU', 'EQUIPAMENTO', eq ? eq.ID : '', { erro: e.message, aba: aba, codigo: eq ? eq.CODIGO : '' }, opts.requestId);
    } catch (e2) {}
    try { console.error('Falha ao sincronizar aba: ' + e.message); } catch (e2) {}
    return { ok: false, erro: e.message, aba: aba };
  }
}

function limparLinhaAba(aba, linha) {
  const row = toInt(linha);
  if (!aba || row < 4) return;
  const sh = getSpreadsheet().getSheetByName(aba);
  if (!sh) return;
  const vals = sh.getRange(row, 1, 1, 12).getValues()[0];
  if (normalizarKey(vals[1] || '').indexOf('OBS') === 0 && !String(vals[3] || '').trim()) return;
  sh.getRange(row, 2, 1, 11).clearContent();
  sh.getRange(row, 2).setBackground('#FFFFFF').clearNote();
}

function sincronizarGrupoAba(sh, cat, grupo, todosEquipamentos, todosEmprestimos, opts) {
  const last = Math.max(sh.getLastRow(), 4);
  const data = sh.getRange(4, 1, last - 3, 12).getValues();
  const bgs = sh.getRange(4, 2, last - 3, 1).getBackgrounds();
  const notes = sh.getRange(4, 2, last - 3, 1).getNotes();
  let writeLen = data.length;
  for (let i = 0; i < data.length; i++) {
    if (normalizarKey(data[i][1] || '').indexOf('OBS') === 0 && !String(data[i][3] || '').trim()) { writeLen = i; break; }
  }
  const owner = {};
  todosEquipamentos.forEach(function (e) {
    if (String(e.CATEGORIA_ID) === String(cat.ID) && toInt(e.ORIGEM_LINHA) > 0) owner[toInt(e.ORIGEM_LINHA)] = e.ID;
  });
  const usados = {};
  Object.keys(owner).forEach(function (r) { usados[Number(r)] = true; });
  const erros = [];
  let ok = 0;
  const mudou = [];
  const escritos = {};
  for (let n = 0; n < grupo.length; n++) {
    const eq = grupo[n];
    let rowNumber = toInt(eq.ORIGEM_LINHA);
    let idx = rowNumber - 4;
    let valido = idx >= 0 && idx < writeLen && (owner[rowNumber] === eq.ID || !owner[rowNumber]);
    if (valido) {
      const atual = data[idx] || [];
      if (normalizarKey(atual[1] || '').indexOf('OBS') === 0 && !String(atual[3] || '').trim()) valido = false;
    }
    if (!valido) {
      let achou = -1;
      for (let i = 0; i < writeLen; i++) {
        const rn = i + 4;
        if (usados[rn]) continue;
        const a = String(data[i][0] || '').trim();
        if (!a) continue;
        if (normalizarKey(data[i][1] || '').indexOf('OBS') === 0 && !String(data[i][3] || '').trim()) continue;
        let vazio = true;
        for (let c = 1; c < 12; c++) {
          if (String(data[i][c] === null || data[i][c] === undefined ? '' : data[i][c]).trim() !== '') { vazio = false; break; }
        }
        if (vazio) { achou = i; break; }
      }
      if (achou < 0) {
        const r = sincronizarEquipamentoSeguro(eq, opts);
        if (r.ok) ok++; else erros.push({ codigo: eq.CODIGO, erro: r.erro });
        continue;
      }
      idx = achou;
      rowNumber = idx + 4;
      eq.ORIGEM_ABA = cat.NOME_ABA;
      eq.ORIGEM_LINHA = rowNumber;
      eq.ORIGEM_NUMERO = String(data[idx][0] || '').trim();
      mudou.push(eq);
    }
    usados[rowNumber] = true;
    const d = dadosAbaEquipamento(eq, data[idx] || [], (todosEmprestimos || []).filter(function (l) { return String(l.EQUIPAMENTO_ID) === String(eq.ID); }));
    if (!d.numero) d.numero = String((data[idx] || [])[0] || '').trim();
    data[idx] = [d.numero, d.b, d.c, d.d, d.e, d.f, d.g, d.h, d.i, d.j, d.k, d.l];
    bgs[idx][0] = d.cor;
    notes[idx][0] = d.nota;
    escritos[rowNumber] = { eq: eq, d: d };
    ok++;
  }
  if (writeLen > 0) {
    sh.getRange(4, 1, writeLen, 12).setValues(data.slice(0, writeLen));
    sh.getRange(4, 2, writeLen, 1).setBackgrounds(bgs.slice(0, writeLen));
    sh.getRange(4, 2, writeLen, 1).setNotes(notes.slice(0, writeLen).map(function (x) { return [x[0]]; }));
    sh.getRange(4, 1, writeLen, 1).setNumberFormat('@');
    sh.getRange(4, 4, writeLen, 1).setNumberFormat('@');
    sh.getRange(4, 6, writeLen, 1).setNumberFormat('@');
    sh.getRange(4, 8, writeLen, 1).setNumberFormat('@');
    sh.getRange(4, 10, writeLen, 2).setNumberFormat('dd/mm/yyyy');
    const lidos = sh.getRange(4, 1, writeLen, 12).getValues();
    const lidosBg = sh.getRange(4, 2, writeLen, 1).getBackgrounds();
    Object.keys(escritos).forEach(function (rn) {
      const i = Number(rn) - 4;
      if (i < 0 || i >= writeLen) return;
      const e = escritos[rn];
      const l = lidos[i];
      const problemas = [];
      const cmp = function (nome, esperado, lido) {
        if (String(esperado === null || esperado === undefined ? '' : esperado) !== String(lido === null || lido === undefined ? '' : lido)) problemas.push(nome);
      };
      cmp('Nº', e.d.numero, String(l[0] || '').trim());
      cmp('COLABORADOR', e.d.b, String(l[1] || '').trim());
      cmp('ESTADO', e.d.c, String(l[2] || '').trim());
      cmp('ITEM', e.d.d, String(l[3] || '').trim());
      cmp('QT', e.d.e, toNumber(l[4]));
      cmp('CARREGADOR', e.d.f, String(l[5] || '').trim());
      cmp('QT CARREGADOR', e.d.g, toNumber(l[6]));
      cmp('BATERIA', e.d.h, String(l[7] || '').trim());
      cmp('QT BATERIA', e.d.i, toNumber(l[8]));
      cmp('ENTREGA', e.d.jIso, dataParaIso(l[9]));
      cmp('DEVOLUÇÃO', e.d.kIso, dataParaIso(l[10]));
      cmp('ASSINATURA', e.d.l, String(l[11] || '').trim());
      if (String(lidosBg[i][0] || '').toLowerCase() !== e.d.cor.toLowerCase()) problemas.push('COR');
      if (problemas.length) erros.push({ codigo: e.eq.CODIGO, erro: 'Aba "' + cat.NOME_ABA + '" linha ' + rn + ' não confirmou: ' + problemas.join(', ') });
    });
  }
  mudou.forEach(function (e) { if (e._row) updateObject(SHEET.EQUIPAMENTOS, e._row, e); });
  return { ok: ok, erros: erros };
}

function sincronizarTudoInterno(session, requestId) {
  const cats = lerTodasCategorias();
  const eqs = lerTodosEquipamentos();
  const todosEmprestimos = lerTodosEmprestimos();
  const erros = [];
  let abasCriadas = 0;
  let ok = 0;
  const porCategoria = {};
  eqs.forEach(function (e) { (porCategoria[e.CATEGORIA_ID] = porCategoria[e.CATEGORIA_ID] || []).push(e); });
  cats.forEach(function (cat) {
    try {
      const r = garantirAbaCategoria(cat);
      if (r.criada) abasCriadas++;
      const grupo = porCategoria[cat.ID] || [];
      if (grupo.length) {
        const g = sincronizarGrupoAba(r.sheet, cat, grupo, eqs, todosEmprestimos, { session: session, requestId: requestId });
        ok += g.ok;
        g.erros.forEach(function (e) { erros.push(e); });
      }
    } catch (e) {
      erros.push({ categoria: cat.NOME, erro: e.message });
    }
  });
  eqs.forEach(function (e) {
    if (!porId(cats, e.CATEGORIA_ID)) erros.push({ codigo: e.CODIGO, erro: 'Categoria não encontrada' });
  });
  configSet('ULTIMA_SINCRONIZACAO', nowStamp());
  if (!erros.length) configSet('SINCRONIZACAO_INICIAL', 'OK');
  audit(session, 'SINCRONIZAR_PLANILHA', 'PLANILHA', '', { equipamentos: ok, total: eqs.length, abasCriadas: abasCriadas, erros: erros.length }, requestId);
  return {
    equipamentosSincronizados: ok,
    total: eqs.length,
    abasCriadas: abasCriadas,
    erros: erros,
    quando: nowStamp()
  };
}

function sincronizarTudo(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      return sincronizarTudoInterno(session, requestId);
    });
  });
}
