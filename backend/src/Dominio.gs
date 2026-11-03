/**
 * Regras de negócio: equipamentos, colaboradores, categorias, empréstimos,
 * devoluções parciais, transferências e manutenção.
 */

function indexarPorId(arr) {
  const m = {};
  (arr || []).forEach(function (x) { if (x && x.ID) m[String(x.ID)] = x; });
  return m;
}

function contexto() {
  const cats = lerTodasCategorias();
  const cols = lerTodosColaboradores();
  const eqs = lerTodosEquipamentos();
  const loans = lerTodosEmprestimos();
  const mans = lerTodasManutencoes();
  return {
    cats: cats,
    cols: cols,
    eqs: eqs,
    loans: loans,
    mans: mans,
    catMap: indexarPorId(cats),
    colMap: indexarPorId(cols),
    eqMap: indexarPorId(eqs)
  };
}

function nomeEquipamento(eq, cat) {
  const categoria = cat ? cat.NOME : (eq.CATEGORIA_NOME || '');
  const detalhe = String(eq.MODELO || eq.CODIGO_MODELO || '').trim();
  const base = detalhe ? (categoria + ' ' + detalhe) : (categoria + ' ' + eq.CODIGO);
  return normalizarTexto(base);
}

function acessoriosTotais(eq) {
  const out = [];
  const cq = toInt(eq.CARREGADOR_QTD);
  const bq = toInt(eq.BATERIA_QTD);
  if (cq > 0 && String(eq.CARREGADOR_CODIGO || '').trim()) {
    out.push({ tipo: 'CARREGADOR', codigo: String(eq.CARREGADOR_CODIGO), codigos: String(eq.CARREGADOR_CODIGO).split('/').map(function (x) { return x.trim(); }).filter(Boolean), qtd: cq });
  }
  if (bq > 0 && String(eq.BATERIA_CODIGO || '').trim()) {
    out.push({ tipo: 'BATERIA', codigo: String(eq.BATERIA_CODIGO), codigos: String(eq.BATERIA_CODIGO).split('/').map(function (x) { return x.trim(); }).filter(Boolean), qtd: bq });
  }
  return out;
}

function somarAcessorios(lista) {
  const out = [];
  (lista || []).forEach(function (a) {
    if (!a || !a.tipo) return;
    const q = toInt(a.qtd);
    if (q <= 0) return;
    const key = String(a.tipo) + '|' + String(a.codigo || '');
    let achou = null;
    for (let i = 0; i < out.length; i++) if (out[i]._key === key) { achou = out[i]; break; }
    if (achou) achou.qtd += q;
    else out.push({ _key: key, tipo: a.tipo, codigo: a.codigo || '', codigos: a.codigos || String(a.codigo || '').split('/').map(function (x) { return x.trim(); }).filter(Boolean), qtd: q });
  });
  return out.map(function (a) { const o = Object.assign({}, a); delete o._key; return o; });
}

function pendentesPorTipo(lista) {
  const m = { CARREGADOR: 0, BATERIA: 0 };
  (lista || []).forEach(function (a) { if (a && a.tipo) m[a.tipo] = (m[a.tipo] || 0) + toInt(a.qtd); });
  return m;
}

function removerAcessorios(pendentes, devolvidos) {
  const restante = (pendentes || []).map(function (a) { return { tipo: a.tipo, codigo: a.codigo, codigos: a.codigos || [], qtd: toInt(a.qtd) }; });
  (devolvidos || []).forEach(function (d) {
    for (let i = 0; i < restante.length; i++) {
      if (String(restante[i].tipo) === String(d.tipo) && String(restante[i].codigo) === String(d.codigo)) {
        restante[i].qtd = Math.max(0, restante[i].qtd - toInt(d.qtd));
      }
    }
  });
  return restante.filter(function (a) { return a.qtd > 0; });
}

function equipamentoView(eq, ctx) {
  const cat = ctx.catMap[eq.CATEGORIA_ID] || null;
  const openLoans = (ctx.loans || []).filter(function (l) { return String(l.EQUIPAMENTO_ID) === String(eq.ID) && String(l.STATUS) === STATUS_LOAN.ABERTO; });
  const loansComQtd = openLoans.filter(function (l) { return toInt(l.QUANTIDADE) > 0; });
  const manOpen = (ctx.mans || []).filter(function (m) { return String(m.EQUIPAMENTO_ID) === String(eq.ID) && (String(m.STATUS) === STATUS_MAN.ABERTA || String(m.STATUS) === STATUS_MAN.EM_ANDAMENTO); })[0] || null;
  const pend = jsonParseSafe(eq.ACESSORIOS_PENDENTES, []);
  const total = toNumber(eq.QUANTIDADE_TOTAL);
  const disp = toNumber(eq.QUANTIDADE_DISPONIVEL);
  const emUso = loansComQtd.reduce(function (s, l) { return s + toInt(l.QUANTIDADE); }, 0);
  const pendTipo = pendentesPorTipo(pend);
  const totalAcc = acessoriosTotais(eq);
  const accDisp = totalAcc.map(function (a) {
    return { tipo: a.tipo, codigo: a.codigo, codigos: a.codigos, qtd: Math.max(0, a.qtd - (pendTipo[a.tipo] || 0)) };
  }).filter(function (a) { return a.qtd > 0; });
  const pendencias = openLoans.map(function (l) {
    const p = jsonParseSafe(l.ACESSORIOS_PENDENTES, []);
    return {
      emprestimoId: l.ID,
      colaboradorId: l.COLABORADOR_ID,
      colaborador: l.COLABORADOR_NOME,
      dataEntrega: l.DATA_ENTREGA,
      quantidade: toInt(l.QUANTIDADE),
      acessorios: p,
      totalItens: p.reduce(function (s, a) { return s + toInt(a.qtd); }, 0)
    };
  }).filter(function (p) { return p.totalItens > 0 || p.quantidade > 0; });
  const status = String(eq.STATUS || '');
  const ativo = status !== STATUS_EQ.INATIVO;
  const podeEntregar = ativo && status !== STATUS_EQ.MANUTENCAO && disp > 0;
  const podeManutencao = ativo && status === STATUS_EQ.DISPONIVEL && disp === total && openLoans.length === 0 && !manOpen;
  return {
    id: eq.ID,
    codigo: eq.CODIGO,
    categoriaId: eq.CATEGORIA_ID,
    categoria: cat ? cat.NOME : eq.CATEGORIA_NOME,
    nome: nomeEquipamento(eq, cat),
    codigoModelo: eq.CODIGO_MODELO || '',
    descricao: eq.DESCRICAO || '',
    marca: eq.MARCA || '',
    modelo: eq.MODELO || '',
    numeroSerie: eq.NUMERO_SERIE || '',
    quantidadeTotal: total,
    quantidadeDisponivel: disp,
    quantidadeEmUso: emUso,
    quantidadeManutencao: status === STATUS_EQ.MANUTENCAO ? total : 0,
    estadoConservacao: eq.ESTADO_CONSERVACAO || 'NAO_INFORMADO',
    estadoOrigem: eq.ESTADO_ORIGEM || '',
    status: status,
    colaboradorAtualId: eq.COLABORADOR_ATUAL_ID || '',
    colaboradorAtual: eq.COLABORADOR_ATUAL_NOME || '',
    dataEntregaAtual: eq.DATA_ENTREGA_ATUAL || '',
    carregador: { codigo: eq.CARREGADOR_CODIGO || '', qtd: toInt(eq.CARREGADOR_QTD) },
    bateria: { codigo: eq.BATERIA_CODIGO || '', qtd: toInt(eq.BATERIA_QTD) },
    acessorios: totalAcc,
    acessoriosDisponiveis: accDisp,
    acessoriosPendentes: pend,
    pendencias: pendencias,
    temPendencia: pend.length > 0,
    observacoes: eq.OBSERVACOES || '',
    origemAba: eq.ORIGEM_ABA || '',
    origemLinha: eq.ORIGEM_LINHA || '',
    origemNumero: eq.ORIGEM_NUMERO || '',
    revisar: String(eq.REVISAR) === 'SIM',
    motivoRevisao: eq.MOTIVO_REVISAO || '',
    criadoEm: eq.CRIADO_EM || '',
    atualizadoEm: eq.ATUALIZADO_EM || '',
    emprestimosAbertos: openLoans.length,
    manutencaoAberta: manOpen ? manutencaoView(manOpen, ctx) : null,
    podeEntregar: podeEntregar,
    podeDevolver: openLoans.length > 0,
    podeTransferir: loansComQtd.length > 0,
    podeManutencao: podeManutencao,
    podeInativar: ativo && openLoans.length === 0 && !manOpen,
    podeReativar: status === STATUS_EQ.INATIVO,
    podeExcluir: false
  };
}

function emprestimoView(l, ctx) {
  const eq = ctx.eqMap[l.EQUIPAMENTO_ID] || null;
  const pend = jsonParseSafe(l.ACESSORIOS_PENDENTES, []);
  return {
    id: l.ID,
    equipamentoId: l.EQUIPAMENTO_ID,
    equipamentoCodigo: l.EQUIPAMENTO_CODIGO,
    equipamentoNome: l.EQUIPAMENTO_NOME || (eq ? eq.CODIGO : ''),
    colaboradorId: l.COLABORADOR_ID,
    colaboradorNome: l.COLABORADOR_NOME,
    dataEntrega: l.DATA_ENTREGA || '',
    quantidade: toInt(l.QUANTIDADE),
    estadoEntrega: l.ESTADO_ENTREGA || '',
    acessoriosEntregues: jsonParseSafe(l.ACESSORIOS_ENTREGUES, []),
    acessoriosPendentes: pend,
    totalPendente: pend.reduce(function (s, a) { return s + toInt(a.qtd); }, 0),
    equipamentoDevolvido: String(l.EQUIPAMENTO_DEVOLVIDO) === 'SIM',
    dataDevolucaoEquipamento: l.DATA_DEVOLUCAO_EQUIPAMENTO || '',
    status: l.STATUS,
    origem: l.ORIGEM || '',
    observacoes: l.OBSERVACOES || '',
    criadoEm: l.CRIADO_EM || '',
    podeDevolver: String(l.STATUS) === STATUS_LOAN.ABERTO,
    podeTransferir: String(l.STATUS) === STATUS_LOAN.ABERTO && toInt(l.QUANTIDADE) > 0
  };
}

function manutencaoView(m, ctx) {
  const eq = ctx.eqMap[m.EQUIPAMENTO_ID] || null;
  return {
    id: m.ID,
    equipamentoId: m.EQUIPAMENTO_ID,
    equipamentoCodigo: m.EQUIPAMENTO_CODIGO,
    equipamentoNome: eq ? nomeEquipamento(eq, ctx.catMap[eq.CATEGORIA_ID]) : (m.EQUIPAMENTO_CODIGO || ''),
    categoriaNome: m.CATEGORIA_NOME || '',
    dataEnvio: m.DATA_ENVIO || '',
    defeito: m.DEFEITO || '',
    responsavel: m.RESPONSAVEL || '',
    celularResponsavel: m.CELULAR_RESPONSAVEL || '',
    status: m.STATUS,
    servico: m.SERVICO || '',
    custo: m.CUSTO === '' || m.CUSTO === null || m.CUSTO === undefined ? '' : toNumber(m.CUSTO),
    previsaoRetorno: m.PREVISAO_RETORNO || '',
    dataRetorno: m.DATA_RETORNO || '',
    estadoRetorno: m.ESTADO_RETORNO || '',
    observacoes: m.OBSERVACOES || '',
    origem: m.ORIGEM || '',
    criadoEm: m.CRIADO_EM || '',
    atualizadoEm: m.ATUALIZADO_EM || '',
    revisar: String(m.REVISAR) === 'SIM',
    motivoRevisao: m.MOTIVO_REVISAO || '',
    aberta: String(m.STATUS) === STATUS_MAN.ABERTA || String(m.STATUS) === STATUS_MAN.EM_ANDAMENTO
  };
}

function movimentoView(m) {
  return {
    id: m.ID,
    data: m.DATA || '',
    tipo: m.TIPO,
    equipamentoId: m.EQUIPAMENTO_ID,
    equipamentoCodigo: m.EQUIPAMENTO_CODIGO,
    categoriaNome: m.CATEGORIA_NOME,
    quantidade: toInt(m.QUANTIDADE),
    colaboradorOrigemId: m.COLABORADOR_ORIGEM_ID || '',
    colaboradorOrigemNome: m.COLABORADOR_ORIGEM_NOME || '',
    colaboradorDestinoId: m.COLABORADOR_DESTINO_ID || '',
    colaboradorDestinoNome: m.COLABORADOR_DESTINO_NOME || '',
    estadoConservacao: m.ESTADO_CONSERVACAO || '',
    acessoriosEntregues: jsonParseSafe(m.ACESSORIOS_ENTREGUES, []),
    acessoriosDevolvidos: jsonParseSafe(m.ACESSORIOS_DEVOLVIDOS, []),
    acessoriosPendentes: jsonParseSafe(m.ACESSORIOS_PENDENTES, []),
    observacoes: m.OBSERVACOES || '',
    emprestimoId: m.EMPRESTIMO_ID || '',
    manutencaoId: m.MANUTENCAO_ID || '',
    usuarioEmail: m.USUARIO_EMAIL || '',
    origem: m.ORIGEM || '',
    criadoEm: m.CRIADO_EM || ''
  };
}

function categoriaView(c, ctx) {
  const eqs = ctx.eqs.filter(function (e) { return String(e.CATEGORIA_ID) === String(c.ID) && String(e.STATUS) !== STATUS_EQ.INATIVO; });
  const total = eqs.reduce(function (s, e) { return s + toNumber(e.QUANTIDADE_TOTAL); }, 0);
  const disp = eqs.reduce(function (s, e) { return s + toNumber(e.QUANTIDADE_DISPONIVEL); }, 0);
  const man = eqs.filter(function (e) { return String(e.STATUS) === STATUS_EQ.MANUTENCAO; }).reduce(function (s, e) { return s + toNumber(e.QUANTIDADE_TOTAL); }, 0);
  return {
    id: c.ID,
    nome: c.NOME,
    nomeAba: c.NOME_ABA || '',
    campoItem: c.CAMPO_ITEM || 'ITEM',
    prefixo: c.PREFIXO || '',
    ordem: toInt(c.ORDEM),
    ativo: String(c.ATIVO) === 'SIM',
    observacaoOrigem: c.OBSERVACAO_ORIGEM || '',
    observacaoImportacao: c.OBSERVACAO_IMPORTACAO || '',
    criadoEm: c.CRIADO_EM || '',
    atualizadoEm: c.ATUALIZADO_EM || '',
    quantidadeEquipamentos: eqs.length,
    quantidadeTotal: total,
    quantidadeDisponivel: disp,
    quantidadeEntregue: Math.max(0, total - disp - man),
    quantidadeManutencao: man
  };
}

function colaboradorView(c, ctx) {
  const eqs = ctx.eqs.filter(function (e) {
    return String(e.COLABORADOR_ATUAL_ID) === String(c.ID) && String(e.STATUS) !== STATUS_EQ.INATIVO;
  });
  const loans = ctx.loans.filter(function (l) {
    return String(l.COLABORADOR_ID) === String(c.ID) && String(l.STATUS) === STATUS_LOAN.ABERTO;
  });
  const pend = loans.reduce(function (s, l) {
    return s + jsonParseSafe(l.ACESSORIOS_PENDENTES, []).reduce(function (x, a) { return x + toInt(a.qtd); }, 0);
  }, 0);
  const eqIds = {};
  eqs.forEach(function (e) { eqIds[e.ID] = true; });
  const pendEqIds = {};
  loans.forEach(function (l) { if (jsonParseSafe(l.ACESSORIOS_PENDENTES, []).length) pendEqIds[l.EQUIPAMENTO_ID] = true; });
  return {
    id: c.ID,
    nome: c.NOME,
    tipo: c.TIPO || 'NAO_INFORMADO',
    funcao: c.FUNCAO || '',
    telefone: c.TELEFONE || '',
    email: c.EMAIL || '',
    localObra: c.LOCAL_OBRA || '',
    setor: c.SETOR || '',
    ativo: String(c.ATIVO) === 'SIM',
    observacoes: c.OBSERVACOES || '',
    origem: c.ORIGEM || '',
    criadoEm: c.CRIADO_EM || '',
    atualizadoEm: c.ATUALIZADO_EM || '',
    equipamentosAtuais: Object.keys(eqIds).length,
    emprestimosAbertos: loans.filter(function (l) { return toInt(l.QUANTIDADE) > 0; }).length,
    acessoriosPendentes: pend,
    equipamentosComPendencia: Object.keys(pendEqIds).length
  };
}

function compararDataDesc(a, b) {
  const da = String(a.DATA || '');
  const db = String(b.DATA || '');
  if (da && db && da !== db) return db.localeCompare(da);
  if (da && !db) return -1;
  if (!da && db) return 1;
  return String(b.CRIADO_EM || '').localeCompare(String(a.CRIADO_EM || ''));
}

function dashboardData(session) {
  const ctx = contexto();
  const ativos = ctx.eqs.filter(function (e) { return String(e.STATUS) !== STATUS_EQ.INATIVO; });
  const disponiveis = ativos.reduce(function (s, e) { return s + toNumber(e.QUANTIDADE_DISPONIVEL); }, 0);
  const manutencao = ativos.filter(function (e) { return String(e.STATUS) === STATUS_EQ.MANUTENCAO; }).reduce(function (s, e) { return s + toNumber(e.QUANTIDADE_TOTAL); }, 0);
  const openLoans = ctx.loans.filter(function (l) { return String(l.STATUS) === STATUS_LOAN.ABERTO; });
  const entregues = openLoans.reduce(function (s, l) { return s + toInt(l.QUANTIDADE); }, 0);
  const pendDevolucao = openLoans.filter(function (l) { return toInt(l.QUANTIDADE) > 0; }).length;
  const pendAccLoans = openLoans.filter(function (l) { return jsonParseSafe(l.ACESSORIOS_PENDENTES, []).length > 0; });
  const pendAccItens = pendAccLoans.reduce(function (s, l) {
    return s + jsonParseSafe(l.ACESSORIOS_PENDENTES, []).reduce(function (x, a) { return x + toInt(a.qtd); }, 0);
  }, 0);
  const revisar = ativos.filter(function (e) { return String(e.REVISAR) === 'SIM'; }).length;
  const categorias = ctx.cats.map(function (c) { return categoriaView(c, ctx); }).sort(function (a, b) { return (a.ordem || 99) - (b.ordem || 99); });
  const colaboradores = ctx.cols.map(function (c) { return colaboradorView(c, ctx); }).sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
  const equipamentos = ctx.eqs.map(function (e) { return equipamentoView(e, ctx); }).sort(function (a, b) {
    const ca = (ctx.catMap[a.categoriaId] && toInt(ctx.catMap[a.categoriaId].ORDEM)) || 99;
    const cb = (ctx.catMap[b.categoriaId] && toInt(ctx.catMap[b.categoriaId].ORDEM)) || 99;
    if (ca !== cb) return ca - cb;
    return String(a.codigo).localeCompare(String(b.codigo), 'pt-BR');
  });
  const manutencoesAbertas = ctx.mans.filter(function (m) {
    return String(m.STATUS) === STATUS_MAN.ABERTA || String(m.STATUS) === STATUS_MAN.EM_ANDAMENTO;
  }).map(function (m) { return manutencaoView(m, ctx); }).sort(compararDataDesc);
  const emprestimosAbertos = openLoans.map(function (l) { return emprestimoView(l, ctx); }).sort(function (a, b) {
    return String(b.dataEntrega || '').localeCompare(String(a.dataEntrega || ''));
  });
  const movs = lerTodosMovimentos().map(movimentoView).sort(compararDataDesc);
  const avisos = [];
  categorias.forEach(function (c) {
    if (c.observacaoImportacao) avisos.push({ tipo: 'IMPORTACAO', titulo: c.nome, texto: c.observacaoImportacao });
  });
  if (revisar > 0) avisos.push({ tipo: 'REVISAO', titulo: 'Equipamentos para revisar', texto: revisar + ' equipamento(s) com informação ambígua na origem. Abra a ficha e confira.' });
  const porCategoria = categorias.filter(function (c) { return c.ativo || c.quantidadeEquipamentos > 0; }).map(function (c) {
    return { id: c.id, nome: c.nome, total: c.quantidadeTotal, disponivel: c.quantidadeDisponivel, entregue: c.quantidadeEntregue, manutencao: c.quantidadeManutencao, revisar: ctx.eqs.filter(function (e) { return String(e.CATEGORIA_ID) === String(c.id) && String(e.REVISAR) === 'SIM' && String(e.STATUS) !== STATUS_EQ.INATIVO; }).length };
  });
  const data = {
    usuario: { id: session.id, nome: session.nome, email: session.email, perfil: session.perfil },
    config: { appNome: APP_NOME, versao: API_VERSAO },
    stats: {
      totalEquipamentos: ativos.length,
      totalItens: ativos.reduce(function (s, e) { return s + toNumber(e.QUANTIDADE_TOTAL); }, 0),
      disponiveis: disponiveis,
      entregues: entregues,
      manutencao: manutencao,
      inativos: ctx.eqs.filter(function (e) { return String(e.STATUS) === STATUS_EQ.INATIVO; }).length,
      pendenciasDevolucao: pendDevolucao,
      pendenciasAcessorios: pendAccLoans.length,
      itensPendentesAcessorios: pendAccItens,
      revisar: revisar,
      categoriasComObservacao: categorias.filter(function (c) { return !!c.observacaoImportacao; }).length
    },
    categorias: categorias,
    colaboradores: colaboradores,
    equipamentos: equipamentos,
    emprestimosAbertos: emprestimosAbertos,
    manutencoesAbertas: manutencoesAbertas,
    movimentacoesRecentes: movs.slice(0, 10),
    porCategoria: porCategoria,
    avisos: avisos,
    atualizadoEm: nowStamp()
  };
  if (session.perfil === PERFIL.ADMIN) {
    try {
      if (configGet('SINCRONIZACAO_INICIAL') !== 'OK') {
        const lock = LockService.getScriptLock();
        if (lock.tryLock(5000)) {
          try {
            const sync = sincronizarTudoInterno(session, 'BOOTSTRAP-SYNC-' + Date.now());
            if (sync.erros && sync.erros.length) {
              data.avisos.push({ tipo: 'SINCRONIZACAO', titulo: 'Sincronização inicial', texto: sync.erros.length + ' item(ns) não puderam ser sincronizados com as abas originais. Use Sincronizar planilha.' });
            }
          } finally {
            try { lock.releaseLock(); } catch (e2) {}
          }
        }
      }
    } catch (e) {
      data.avisos.push({ tipo: 'SINCRONIZACAO', titulo: 'Sincronização inicial', texto: 'A sincronização automática falhou: ' + e.message + ' Use Sincronizar planilha.' });
    }
    data.usuarios = lerTodosUsuarios().map(usuarioPublico).sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
  }
  return data;
}

function detalheEquipamento(payload, session) {
  exigirAutenticado(session);
  const id = String((payload || {}).id || '').trim();
  const ctx = contexto();
  const eq = exigirRegistro(porId(ctx.eqs, id), 'EQUIPAMENTO_NAO_ENCONTRADO', 'Equipamento não encontrado.');
  const loans = ctx.loans.filter(function (l) { return String(l.EQUIPAMENTO_ID) === String(id); }).map(function (l) { return emprestimoView(l, ctx); }).sort(compararDataDesc);
  const mans = ctx.mans.filter(function (m) { return String(m.EQUIPAMENTO_ID) === String(id); }).map(function (m) { return manutencaoView(m, ctx); }).sort(compararDataDesc);
  const movs = lerTodosMovimentos().filter(function (m) { return String(m.EQUIPAMENTO_ID) === String(id); }).map(movimentoView).sort(compararDataDesc);
  const view = equipamentoView(eq, ctx);
  view.podeExcluir = loans.length === 0 && mans.length === 0 && movs.length === 0;
  return { equipamento: view, emprestimos: loans, manutencoes: mans, movimentacoes: movs };
}

function listarMovimentacoes(payload, session) {
  exigirAutenticado(session);
  payload = payload || {};
  const page = Math.max(1, toInt(payload.page) || 1);
  const pageSize = Math.min(100, Math.max(10, toInt(payload.pageSize) || 25));
  const tipo = String(payload.tipo || '').toUpperCase();
  const eqId = String(payload.equipamentoId || '');
  const colId = String(payload.colaboradorId || '');
  const busca = normalizarKey(payload.busca || '');
  const ini = String(payload.dataInicio || '');
  const fim = String(payload.dataFim || '');
  let arr = lerTodosMovimentos().map(movimentoView);
  if (tipo) arr = arr.filter(function (m) { return String(m.tipo) === tipo; });
  if (eqId) arr = arr.filter(function (m) { return String(m.equipamentoId) === eqId; });
  if (colId) arr = arr.filter(function (m) { return String(m.colaboradorOrigemId) === colId || String(m.colaboradorDestinoId) === colId; });
  if (ini) arr = arr.filter(function (m) { return m.data && m.data >= ini; });
  if (fim) arr = arr.filter(function (m) { return m.data && m.data <= fim; });
  if (busca) arr = arr.filter(function (m) { return normalizarKey([m.equipamentoCodigo, m.categoriaNome, m.colaboradorOrigemNome, m.colaboradorDestinoNome, m.observacoes].join(' ')).indexOf(busca) >= 0; });
  arr.sort(compararDataDesc);
  const total = arr.length;
  const items = arr.slice((page - 1) * pageSize, page * pageSize);
  return { items: items, total: total, page: page, pageSize: pageSize, totalPaginas: Math.max(1, Math.ceil(total / pageSize)) };
}

function listarManutencoes(payload, session) {
  exigirAutenticado(session);
  payload = payload || {};
  const ctx = contexto();
  const status = String(payload.status || '').toUpperCase();
  const busca = normalizarKey(payload.busca || '');
  let arr = ctx.mans.map(function (m) { return manutencaoView(m, ctx); });
  if (status) arr = arr.filter(function (m) { return String(m.status) === status; });
  if (payload.equipamentoId) arr = arr.filter(function (m) { return String(m.equipamentoId) === String(payload.equipamentoId); });
  if (busca) arr = arr.filter(function (m) { return normalizarKey([m.equipamentoCodigo, m.equipamentoNome, m.defeito, m.responsavel, m.servico, m.observacoes].join(' ')).indexOf(busca) >= 0; });
  arr.sort(compararDataDesc);
  return { items: arr, total: arr.length };
}

function listarAuditoria(payload, session) {
  exigirAdmin(session);
  payload = payload || {};
  const page = Math.max(1, toInt(payload.page) || 1);
  const pageSize = Math.min(100, Math.max(10, toInt(payload.pageSize) || 30));
  const busca = normalizarKey(payload.busca || '');
  let arr = readObjects(SHEET.AUDITORIA);
  if (busca) arr = arr.filter(function (a) { return normalizarKey([a.USUARIO_EMAIL, a.ACAO, a.ENTIDADE, a.ENTIDADE_ID, a.DETALHES].join(' ')).indexOf(busca) >= 0; });
  arr.sort(function (a, b) { return String(b.DATA || '').localeCompare(String(a.DATA || '')); });
  const total = arr.length;
  return { items: arr.slice((page - 1) * pageSize, page * pageSize), total: total, page: page, pageSize: pageSize, totalPaginas: Math.max(1, Math.ceil(total / pageSize)) };
}

/* =========================== ESCRITAS =========================== */

function codigoUnico(codigo, excetoId) {
  const c = String(codigo || '').trim().toUpperCase();
  if (!c) return true;
  const eqs = lerTodosEquipamentos();
  for (let i = 0; i < eqs.length; i++) {
    if (String(eqs[i].ID) === String(excetoId || '')) continue;
    if (String(eqs[i].CODIGO || '').trim().toUpperCase() === c) return false;
  }
  return true;
}

function proximoCodigo(cat) {
  const eqs = lerTodosEquipamentos().filter(function (e) { return String(e.CATEGORIA_ID) === String(cat.ID); });
  let max = 0;
  eqs.forEach(function (e) {
    const m = String(e.CODIGO || '').match(/-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  const seq = String(max + 1).padStart(3, '0');
  return String(cat.PREFIXO || 'EQP') + '-' + seq;
}

function validarConservacao(v, padrao) {
  const s = String(v || padrao || 'NAO_INFORMADO').trim().toUpperCase();
  assert(CONSERVACAO.indexOf(s) >= 0, 'CONSERVACAO_INVALIDA', 'Estado de conservação inválido.');
  return s;
}

function categoriaAtiva(id) {
  const c = porId(lerTodasCategorias(), id);
  if (!c) fail('CATEGORIA_NAO_ENCONTRADA', 'Categoria não encontrada.');
  if (String(c.ATIVO) !== 'SIM') fail('CATEGORIA_INATIVA', 'A categoria está inativa.');
  return c;
}

function colaboradorAtivo(id) {
  const c = porId(lerTodosColaboradores(), id);
  if (!c) fail('COLABORADOR_NAO_ENCONTRADO', 'Colaborador não encontrado.');
  if (String(c.ATIVO) !== 'SIM') fail('COLABORADOR_INATIVO', 'O colaborador está inativo.');
  return c;
}

function criarEquipamento(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  payload = payload || {};
  const cat = categoriaAtiva(payload.categoriaId);
  const total = Math.max(1, Math.min(9999, toInt(payload.quantidadeTotal) || 1));
  const conservacao = validarConservacao(payload.estadoConservacao, 'NAO_INFORMADO');
  const codigoInformado = limparTexto(payload.codigo, 40).toUpperCase();
  const codigo = codigoInformado || proximoCodigo(cat);
  assert(codigoUnico(codigo, null), 'CODIGO_EM_USO', 'Já existe um equipamento com esse código.');
  const carCod = limparTexto(payload.carregadorCodigo, 80);
  const batCod = limparTexto(payload.bateriaCodigo, 120);
  const carQtd = Math.max(0, Math.min(99, toInt(payload.carregadorQtd) || 0));
  const batQtd = Math.max(0, Math.min(99, toInt(payload.bateriaQtd) || 0));
  if (carQtd > 0) assert(carCod, 'ACESSORIO_INVALIDO', 'Informe o código do carregador ou zere a quantidade.');
  if (batQtd > 0) assert(batCod, 'ACESSORIO_INVALIDO', 'Informe o código da bateria ou zere a quantidade.');
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const agora = nowStamp();
      const eq = {
        ID: newId('EQP'),
        CODIGO: codigo,
        CATEGORIA_ID: cat.ID,
        CATEGORIA_NOME: cat.NOME,
        CODIGO_MODELO: limparTexto(payload.codigoModelo, 160),
        DESCRICAO: limparTexto(payload.descricao, 300),
        MARCA: limparTexto(payload.marca, 80),
        MODELO: limparTexto(payload.modelo, 160),
        NUMERO_SERIE: limparTexto(payload.numeroSerie, 120),
        QUANTIDADE_TOTAL: total,
        QUANTIDADE_DISPONIVEL: total,
        ESTADO_CONSERVACAO: conservacao,
        ESTADO_ORIGEM: '',
        STATUS: STATUS_EQ.DISPONIVEL,
        COLABORADOR_ATUAL_ID: '',
        COLABORADOR_ATUAL_NOME: '',
        CARREGADOR_CODIGO: carCod,
        CARREGADOR_QTD: carQtd,
        BATERIA_CODIGO: batCod,
        BATERIA_QTD: batQtd,
        DATA_ENTREGA_ATUAL: '',
        ACESSORIOS_PENDENTES: '[]',
        OBSERVACOES: limparTexto(payload.observacoes, 2000),
        ORIGEM_ABA: '',
        ORIGEM_LINHA: '',
        ORIGEM_NUMERO: '',
        REVISAR: 'NAO',
        MOTIVO_REVISAO: '',
        CRIADO_EM: agora,
        ATUALIZADO_EM: agora,
        CRIADO_POR: session.email,
        ATUALIZADO_POR: session.email
      };
      appendObject(SHEET.EQUIPAMENTOS, eq);
      const eq2 = porId(lerTodosEquipamentos(), eq.ID);
      const sync = sincronizarEquipamentoSeguro(eq2, { session: session, requestId: requestId });
      const avisos = sync.ok ? [] : ['Equipamento salvo no sistema, mas a aba ' + (sync.aba || 'da categoria') + ' não foi sincronizada: ' + sync.erro + ' Use Sincronizar planilha.'];
      audit(session, 'CRIAR_EQUIPAMENTO', 'EQUIPAMENTO', eq.ID, { codigo: eq.CODIGO, categoria: cat.NOME, total: total }, requestId);
      const ctx = contexto();
      return { equipamento: equipamentoView(porId(ctx.eqs, eq.ID), ctx), avisos: avisos };
    });
  });
}

function editarEquipamento(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  payload = payload || {};
  const id = String(payload.id || '').trim();
  assert(id, 'EQUIPAMENTO_OBRIGATORIO', 'Informe o equipamento.');
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const eq = exigirRegistro(porId(ctx.eqs, id), 'EQUIPAMENTO_NAO_ENCONTRADO', 'Equipamento não encontrado.');
      const catAnterior = ctx.catMap[eq.CATEGORIA_ID] || null;
      const categoriaMudou = payload.categoriaId !== undefined && String(payload.categoriaId) !== String(eq.CATEGORIA_ID);
      const abaAntiga = String(eq.ORIGEM_ABA || '');
      const linhaAntiga = toInt(eq.ORIGEM_LINHA);
      let cat = catAnterior;
      if (payload.categoriaId !== undefined && String(payload.categoriaId) !== String(eq.CATEGORIA_ID)) {
        cat = categoriaAtiva(payload.categoriaId);
      }
      if (!cat) fail('CATEGORIA_NAO_ENCONTRADA', 'Categoria do equipamento não encontrada.');
      const codigo = payload.codigo === undefined ? String(eq.CODIGO) : limparTexto(payload.codigo, 40).toUpperCase();
      assert(codigo, 'CODIGO_OBRIGATORIO', 'Informe o código do equipamento.');
      assert(codigoUnico(codigo, eq.ID), 'CODIGO_EM_USO', 'Já existe um equipamento com esse código.');
      const status = String(eq.STATUS || '');
      const totalAnterior = toNumber(eq.QUANTIDADE_TOTAL);
      const dispAnterior = toNumber(eq.QUANTIDADE_DISPONIVEL);
      const emUso = Math.max(0, totalAnterior - dispAnterior);
      let total = payload.quantidadeTotal === undefined ? totalAnterior : Math.max(1, Math.min(9999, toInt(payload.quantidadeTotal)));
      if (total !== totalAnterior) {
        assert(status !== STATUS_EQ.MANUTENCAO, 'EQUIPAMENTO_MANUTENCAO', 'Não altere a quantidade enquanto o equipamento estiver em manutenção.');
        assert(total >= emUso, 'QUANTIDADE_INVALIDA', 'A quantidade total não pode ser menor que a quantidade em uso (' + emUso + ').');
      }
      const carCod = payload.carregadorCodigo === undefined ? String(eq.CARREGADOR_CODIGO || '') : limparTexto(payload.carregadorCodigo, 80);
      const batCod = payload.bateriaCodigo === undefined ? String(eq.BATERIA_CODIGO || '') : limparTexto(payload.bateriaCodigo, 120);
      const carQtd = payload.carregadorQtd === undefined ? toInt(eq.CARREGADOR_QTD) : Math.max(0, Math.min(99, toInt(payload.carregadorQtd)));
      const batQtd = payload.bateriaQtd === undefined ? toInt(eq.BATERIA_QTD) : Math.max(0, Math.min(99, toInt(payload.bateriaQtd)));
      if (carQtd > 0) assert(carCod, 'ACESSORIO_INVALIDO', 'Informe o código do carregador ou zere a quantidade.');
      if (batQtd > 0) assert(batCod, 'ACESSORIO_INVALIDO', 'Informe o código da bateria ou zere a quantidade.');
      const pend = jsonParseSafe(eq.ACESSORIOS_PENDENTES, []);
      const pt = pendentesPorTipo(pend);
      if (carQtd < (pt.CARREGADOR || 0)) fail('ACESSORIO_PENDENTE', 'A quantidade de carregadores é menor que a pendência atual (' + (pt.CARREGADOR || 0) + ').');
      if (batQtd < (pt.BATERIA || 0)) fail('ACESSORIO_PENDENTE', 'A quantidade de baterias é menor que a pendência atual (' + (pt.BATERIA || 0) + ').');
      if (carCod !== String(eq.CARREGADOR_CODIGO || '') && (pt.CARREGADOR || 0) > 0) fail('ACESSORIO_PENDENTE', 'Há carregador pendente; devolva antes de trocar o código.');
      if (batCod !== String(eq.BATERIA_CODIGO || '') && (pt.BATERIA || 0) > 0) fail('ACESSORIO_PENDENTE', 'Há bateria pendente; devolva antes de trocar o código.');
      const antes = { codigo: eq.CODIGO, total: totalAnterior, categoria: eq.CATEGORIA_ID, conservacao: eq.ESTADO_CONSERVACAO };
      eq.CODIGO = codigo;
      eq.CATEGORIA_ID = cat.ID;
      eq.CATEGORIA_NOME = cat.NOME;
      eq.CODIGO_MODELO = payload.codigoModelo === undefined ? eq.CODIGO_MODELO : limparTexto(payload.codigoModelo, 160);
      eq.DESCRICAO = payload.descricao === undefined ? eq.DESCRICAO : limparTexto(payload.descricao, 300);
      eq.MARCA = payload.marca === undefined ? eq.MARCA : limparTexto(payload.marca, 80);
      eq.MODELO = payload.modelo === undefined ? eq.MODELO : limparTexto(payload.modelo, 160);
      eq.NUMERO_SERIE = payload.numeroSerie === undefined ? eq.NUMERO_SERIE : limparTexto(payload.numeroSerie, 120);
      eq.QUANTIDADE_TOTAL = total;
      eq.ESTADO_CONSERVACAO = payload.estadoConservacao === undefined ? eq.ESTADO_CONSERVACAO : validarConservacao(payload.estadoConservacao, eq.ESTADO_CONSERVACAO);
      eq.CARREGADOR_CODIGO = carCod;
      eq.CARREGADOR_QTD = carQtd;
      eq.BATERIA_CODIGO = batCod;
      eq.BATERIA_QTD = batQtd;
      eq.OBSERVACOES = payload.observacoes === undefined ? eq.OBSERVACOES : limparTexto(payload.observacoes, 2000);
      if (total !== totalAnterior) {
        const diff = total - totalAnterior;
        if (status === STATUS_EQ.INATIVO) eq.QUANTIDADE_DISPONIVEL = total;
        else eq.QUANTIDADE_DISPONIVEL = Math.max(0, dispAnterior + diff);
      }
      eq.ATUALIZADO_EM = nowStamp();
      eq.ATUALIZADO_POR = session.email;
      if (categoriaMudou) {
        eq.ORIGEM_ABA = '';
        eq.ORIGEM_LINHA = '';
        eq.ORIGEM_NUMERO = '';
      }
      if (status !== STATUS_EQ.INATIVO && status !== STATUS_EQ.MANUTENCAO) {
        atualizarDerivados(eq, ctx.loans, ctx.mans);
      }
      updateObject(SHEET.EQUIPAMENTOS, eq._row, eq);
      let avisoLimpeza = '';
      if (categoriaMudou) {
        try { limparLinhaAba(abaAntiga, linhaAntiga); } catch (e) { avisoLimpeza = 'A linha antiga da aba ' + abaAntiga + ' não pôde ser limpa: ' + e.message; }
      }
      if (String(antes.codigo) !== String(eq.CODIGO) || String(antes.categoria) !== String(eq.CATEGORIA_ID)) {
        const eqNome = nomeEquipamento(eq, cat);
        ctx.loans.forEach(function (l) {
          if (String(l.EQUIPAMENTO_ID) === String(eq.ID) && String(l.STATUS) === STATUS_LOAN.ABERTO) {
            l.EQUIPAMENTO_CODIGO = eq.CODIGO;
            l.EQUIPAMENTO_NOME = eqNome;
            updateObject(SHEET.EMPRESTIMOS, l._row, l);
          }
        });
      }
      audit(session, 'EDITAR_EQUIPAMENTO', 'EQUIPAMENTO', eq.ID, { antes: antes, depois: { codigo: eq.CODIGO, total: total, categoria: eq.CATEGORIA_ID, conservacao: eq.ESTADO_CONSERVACAO } }, requestId);
      const eqAtual = porId(lerTodosEquipamentos(), eq.ID);
      const sync = sincronizarEquipamentoSeguro(eqAtual, { session: session, requestId: requestId });
      const avisos = [];
      if (avisoLimpeza) avisos.push(avisoLimpeza);
      if (!sync.ok) avisos.push('Equipamento salvo no sistema, mas a aba ' + (sync.aba || 'da categoria') + ' não foi sincronizada: ' + sync.erro + ' Use Sincronizar planilha.');
      const ctx2 = contexto();
      return { equipamento: equipamentoView(porId(ctx2.eqs, eq.ID), ctx2), avisos: avisos };
    });
  });
}

function marcarRevisadoEquipamento(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  const id = String((payload || {}).id || '').trim();
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const eq = exigirRegistro(porId(ctx.eqs, id), 'EQUIPAMENTO_NAO_ENCONTRADO', 'Equipamento não encontrado.');
      const obs = limparTexto((payload || {}).observacao, 500);
      eq.REVISAR = 'NAO';
      eq.MOTIVO_REVISAO = normalizarTexto((eq.MOTIVO_REVISAO ? eq.MOTIVO_REVISAO + ' | ' : '') + 'Revisado por ' + session.email + ' em ' + nowStamp() + (obs ? ': ' + obs : ''));
      eq.ATUALIZADO_EM = nowStamp();
      eq.ATUALIZADO_POR = session.email;
      updateObject(SHEET.EQUIPAMENTOS, eq._row, eq);
      audit(session, 'REVISAR_EQUIPAMENTO', 'EQUIPAMENTO', eq.ID, { observacao: obs }, requestId);
      const ctx2 = contexto();
      return { equipamento: equipamentoView(porId(ctx2.eqs, eq.ID), ctx2) };
    });
  });
}

function inativarEquipamento(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  const id = String((payload || {}).id || '').trim();
  const motivo = limparTexto((payload || {}).motivo, 500);
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const eq = exigirRegistro(porId(ctx.eqs, id), 'EQUIPAMENTO_NAO_ENCONTRADO', 'Equipamento não encontrado.');
      if (String(eq.STATUS) === STATUS_EQ.INATIVO) fail('EQUIPAMENTO_INATIVO', 'O equipamento já está inativo.');
      const loans = ctx.loans.filter(function (l) { return String(l.EQUIPAMENTO_ID) === String(eq.ID) && String(l.STATUS) === STATUS_LOAN.ABERTO; });
      if (loans.length) fail('EQUIPAMENTO_EM_USO', 'Não é possível inativar: há empréstimo ou acessório pendente. Registre a devolução primeiro.');
      const man = ctx.mans.filter(function (m) { return String(m.EQUIPAMENTO_ID) === String(eq.ID) && (String(m.STATUS) === STATUS_MAN.ABERTA || String(m.STATUS) === STATUS_MAN.EM_ANDAMENTO); });
      if (man.length) fail('EQUIPAMENTO_MANUTENCAO', 'Não é possível inativar um equipamento em manutenção.');
      eq.STATUS = STATUS_EQ.INATIVO;
      eq.ATUALIZADO_EM = nowStamp();
      eq.ATUALIZADO_POR = session.email;
      if (motivo) eq.OBSERVACOES = normalizarTexto((eq.OBSERVACOES ? eq.OBSERVACOES + ' | ' : '') + 'Inativado: ' + motivo);
      updateObject(SHEET.EQUIPAMENTOS, eq._row, eq);
      const sync = sincronizarEquipamentoSeguro(eq, { session: session, requestId: requestId });
      const avisos = sync.ok ? [] : ['Inativação salva no sistema, mas a aba ' + (sync.aba || 'da categoria') + ' não foi sincronizada: ' + sync.erro + ' Use Sincronizar planilha.'];
      audit(session, 'INATIVAR_EQUIPAMENTO', 'EQUIPAMENTO', eq.ID, { motivo: motivo }, requestId);
      const ctx2 = contexto();
      return { equipamento: equipamentoView(porId(ctx2.eqs, eq.ID), ctx2), avisos: avisos };
    });
  });
}

function reativarEquipamento(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  const id = String((payload || {}).id || '').trim();
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const eq = exigirRegistro(porId(ctx.eqs, id), 'EQUIPAMENTO_NAO_ENCONTRADO', 'Equipamento não encontrado.');
      if (String(eq.STATUS) !== STATUS_EQ.INATIVO) fail('EQUIPAMENTO_ATIVO', 'O equipamento já está ativo.');
      eq.STATUS = STATUS_EQ.DISPONIVEL;
      eq.QUANTIDADE_DISPONIVEL = toNumber(eq.QUANTIDADE_TOTAL);
      atualizarDerivados(eq, ctx.loans, ctx.mans);
      eq.ATUALIZADO_EM = nowStamp();
      eq.ATUALIZADO_POR = session.email;
      updateObject(SHEET.EQUIPAMENTOS, eq._row, eq);
      const sync = sincronizarEquipamentoSeguro(eq, { session: session, requestId: requestId });
      const avisos = sync.ok ? [] : ['Reativação salva no sistema, mas a aba ' + (sync.aba || 'da categoria') + ' não foi sincronizada: ' + sync.erro + ' Use Sincronizar planilha.'];
      audit(session, 'REATIVAR_EQUIPAMENTO', 'EQUIPAMENTO', eq.ID, null, requestId);
      const ctx2 = contexto();
      return { equipamento: equipamentoView(porId(ctx2.eqs, eq.ID), ctx2), avisos: avisos };
    });
  });
}

function excluirEquipamento(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  const id = String((payload || {}).id || '').trim();
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const eq = exigirRegistro(porId(ctx.eqs, id), 'EQUIPAMENTO_NAO_ENCONTRADO', 'Equipamento não encontrado.');
      const loans = ctx.loans.filter(function (l) { return String(l.EQUIPAMENTO_ID) === String(eq.ID); });
      const mans = ctx.mans.filter(function (m) { return String(m.EQUIPAMENTO_ID) === String(eq.ID); });
      const movs = lerTodosMovimentos().filter(function (m) { return String(m.EQUIPAMENTO_ID) === String(eq.ID); });
      if (loans.length || mans.length || movs.length) {
        fail('EQUIPAMENTO_COM_HISTORICO', 'Este equipamento possui histórico. Use a inativação para preservar os registros.');
      }
      const avisos = [];
      try { limparLinhaAba(eq.ORIGEM_ABA, eq.ORIGEM_LINHA); } catch (e) { avisos.push('Equipamento excluído, mas a linha da aba ' + eq.ORIGEM_ABA + ' não pôde ser limpa: ' + e.message); }
      deleteObject(SHEET.EQUIPAMENTOS, eq._row);
      audit(session, 'EXCLUIR_EQUIPAMENTO', 'EQUIPAMENTO', eq.ID, { codigo: eq.CODIGO }, requestId);
      return { ok: true, avisos: avisos };
    });
  });
}

function criarColaborador(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  payload = payload || {};
  const nome = limparTexto(payload.nome, 120);
  assert(nome.length >= 2, 'NOME_INVALIDO', 'Informe o nome do colaborador.');
  const tipo = String(payload.tipo || 'NAO_INFORMADO').toUpperCase();
  assert(['PESSOA','GRUPO','LOCAL','NAO_INFORMADO'].indexOf(tipo) >= 0, 'TIPO_INVALIDO', 'Tipo inválido.');
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const cols = lerTodosColaboradores();
      for (let i = 0; i < cols.length; i++) if (normalizarKey(cols[i].NOME) === normalizarKey(nome)) fail('NOME_EM_USO', 'Já existe um colaborador com esse nome.');
      const agora = nowStamp();
      const c = {
        ID: newId('COL'), NOME: nome, TIPO: tipo,
        FUNCAO: limparTexto(payload.funcao, 120),
        TELEFONE: limparTexto(payload.telefone, 40),
        EMAIL: limparTexto(payload.email, 160),
        LOCAL_OBRA: limparTexto(payload.localObra, 160),
        SETOR: limparTexto(payload.setor, 120),
        ATIVO: 'SIM',
        OBSERVACOES: limparTexto(payload.observacoes, 1000),
        ORIGEM: 'APP', CRIADO_EM: agora, ATUALIZADO_EM: agora
      };
      appendObject(SHEET.COLABORADORES, c);
      audit(session, 'CRIAR_COLABORADOR', 'COLABORADOR', c.ID, { nome: nome }, requestId);
      const ctx = contexto();
      return { colaborador: colaboradorView(porId(ctx.cols, c.ID), ctx) };
    });
  });
}

function editarColaborador(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  payload = payload || {};
  const id = String(payload.id || '').trim();
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const c = exigirRegistro(porId(ctx.cols, id), 'COLABORADOR_NAO_ENCONTRADO', 'Colaborador não encontrado.');
      const nome = payload.nome === undefined ? c.NOME : limparTexto(payload.nome, 120);
      assert(nome.length >= 2, 'NOME_INVALIDO', 'Informe o nome do colaborador.');
      ctx.cols.forEach(function (x) { if (x.ID !== c.ID && normalizarKey(x.NOME) === normalizarKey(nome)) fail('NOME_EM_USO', 'Já existe um colaborador com esse nome.'); });
      const tipo = payload.tipo === undefined ? (c.TIPO || 'NAO_INFORMADO') : String(payload.tipo).toUpperCase();
      assert(['PESSOA','GRUPO','LOCAL','NAO_INFORMADO'].indexOf(tipo) >= 0, 'TIPO_INVALIDO', 'Tipo inválido.');
      const antes = c.NOME;
      c.NOME = nome; c.TIPO = tipo;
      c.FUNCAO = payload.funcao === undefined ? c.FUNCAO : limparTexto(payload.funcao, 120);
      c.TELEFONE = payload.telefone === undefined ? c.TELEFONE : limparTexto(payload.telefone, 40);
      c.EMAIL = payload.email === undefined ? c.EMAIL : limparTexto(payload.email, 160);
      c.LOCAL_OBRA = payload.localObra === undefined ? c.LOCAL_OBRA : limparTexto(payload.localObra, 160);
      c.SETOR = payload.setor === undefined ? c.SETOR : limparTexto(payload.setor, 120);
      c.OBSERVACOES = payload.observacoes === undefined ? c.OBSERVACOES : limparTexto(payload.observacoes, 1000);
      c.ATUALIZADO_EM = nowStamp();
      updateObject(SHEET.COLABORADORES, c._row, c);
      const afetados = {};
      if (normalizarKey(antes) !== normalizarKey(nome)) {
        ctx.eqs.forEach(function (e) {
          if (String(e.COLABORADOR_ATUAL_ID) === String(c.ID)) {
            e.COLABORADOR_ATUAL_NOME = nome;
            e.ATUALIZADO_EM = nowStamp();
            updateObject(SHEET.EQUIPAMENTOS, e._row, e);
            afetados[e.ID] = true;
          }
        });
        ctx.loans.forEach(function (l) {
          if (String(l.COLABORADOR_ID) === String(c.ID) && String(l.STATUS) === STATUS_LOAN.ABERTO) {
            l.COLABORADOR_NOME = nome;
            l.ATUALIZADO_EM = nowStamp();
            updateObject(SHEET.EMPRESTIMOS, l._row, l);
            afetados[l.EQUIPAMENTO_ID] = true;
          }
        });
      }
      audit(session, 'EDITAR_COLABORADOR', 'COLABORADOR', c.ID, { antes: antes, depois: nome }, requestId);
      const ctx2 = contexto();
      const avisos = [];
      Object.keys(afetados).forEach(function (eqId) {
        const eq = porId(ctx2.eqs, eqId);
        if (!eq) return;
        const s = sincronizarEquipamentoSeguro(eq, { session: session, requestId: requestId });
        if (!s.ok) avisos.push('Aba de ' + eq.CODIGO + ' não sincronizada: ' + s.erro);
      });
      return { colaborador: colaboradorView(porId(ctx2.cols, c.ID), ctx2), avisos: avisos };
    });
  });
}

function inativarColaborador(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  const id = String((payload || {}).id || '').trim();
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const c = exigirRegistro(porId(ctx.cols, id), 'COLABORADOR_NAO_ENCONTRADO', 'Colaborador não encontrado.');
      const loans = ctx.loans.filter(function (l) { return String(l.COLABORADOR_ID) === String(c.ID) && String(l.STATUS) === STATUS_LOAN.ABERTO; });
      if (loans.length) fail('COLABORADOR_COM_PENDENCIA', 'Não é possível inativar: há equipamento ou acessório pendente com este colaborador.');
      c.ATIVO = 'NAO'; c.ATUALIZADO_EM = nowStamp();
      updateObject(SHEET.COLABORADORES, c._row, c);
      audit(session, 'INATIVAR_COLABORADOR', 'COLABORADOR', c.ID, null, requestId);
      const ctx2 = contexto();
      return { colaborador: colaboradorView(porId(ctx2.cols, c.ID), ctx2) };
    });
  });
}

function reativarColaborador(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  const id = String((payload || {}).id || '').trim();
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const c = exigirRegistro(porId(ctx.cols, id), 'COLABORADOR_NAO_ENCONTRADO', 'Colaborador não encontrado.');
      c.ATIVO = 'SIM'; c.ATUALIZADO_EM = nowStamp();
      updateObject(SHEET.COLABORADORES, c._row, c);
      audit(session, 'REATIVAR_COLABORADOR', 'COLABORADOR', c.ID, null, requestId);
      const ctx2 = contexto();
      return { colaborador: colaboradorView(porId(ctx2.cols, c.ID), ctx2) };
    });
  });
}

function excluirColaborador(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  const id = String((payload || {}).id || '').trim();
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const c = exigirRegistro(porId(ctx.cols, id), 'COLABORADOR_NAO_ENCONTRADO', 'Colaborador não encontrado.');
      const temEq = ctx.eqs.some(function (e) { return String(e.COLABORADOR_ATUAL_ID) === String(c.ID); });
      const temLoan = ctx.loans.some(function (l) { return String(l.COLABORADOR_ID) === String(c.ID); });
      const temMov = lerTodosMovimentos().some(function (m) { return String(m.COLABORADOR_ORIGEM_ID) === String(c.ID) || String(m.COLABORADOR_DESTINO_ID) === String(c.ID); });
      if (temEq || temLoan || temMov) fail('COLABORADOR_COM_HISTORICO', 'Este colaborador possui histórico. Use a inativação.');
      deleteObject(SHEET.COLABORADORES, c._row);
      audit(session, 'EXCLUIR_COLABORADOR', 'COLABORADOR', c.ID, { nome: c.NOME }, requestId);
      return { ok: true };
    });
  });
}

function criarCategoria(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  payload = payload || {};
  const nome = limparTexto(payload.nome, 120);
  const prefixo = limparTexto(payload.prefixo, 6).toUpperCase().replace(/[^A-Z0-9]/g, '');
  assert(nome.length >= 2, 'NOME_INVALIDO', 'Informe o nome da categoria.');
  assert(/^[A-Z0-9]{2,6}$/.test(prefixo), 'PREFIXO_INVALIDO', 'O prefixo deve ter de 2 a 6 letras/números.');
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const cats = lerTodasCategorias();
      cats.forEach(function (c) {
        if (normalizarKey(c.NOME) === normalizarKey(nome)) fail('NOME_EM_USO', 'Já existe uma categoria com esse nome.');
        if (String(c.PREFIXO || '').toUpperCase() === prefixo) fail('PREFIXO_EM_USO', 'Já existe uma categoria com esse prefixo.');
      });
      const agora = nowStamp();
      const campoItem = limparTexto(payload.campoItem, 60) || 'ITEM';
      const aba = criarAbaCategoria(nome, campoItem, null);
      const c = {
        ID: newId('CAT'), NOME: nome, NOME_ABA: aba.nome, CAMPO_ITEM: campoItem,
        PREFIXO: prefixo, ORDEM: toInt(payload.ordem) || (cats.length + 1), ATIVO: 'SIM',
        OBSERVACAO_ORIGEM: '', OBSERVACAO_IMPORTACAO: 'Aba "' + aba.nome + '" criada pelo aplicativo em ' + agora + '.',
        CRIADO_EM: agora, ATUALIZADO_EM: agora
      };
      try {
        appendObject(SHEET.CATEGORIAS, c);
      } catch (e) {
        try { getSpreadsheet().deleteSheet(aba.sheet); } catch (e2) {}
        throw e;
      }
      audit(session, 'CRIAR_CATEGORIA', 'CATEGORIA', c.ID, { nome: nome, prefixo: prefixo, aba: aba.nome }, requestId);
      const ctx = contexto();
      return { categoria: categoriaView(porId(ctx.cats, c.ID), ctx), aba: aba.nome };
    });
  });
}

function editarCategoria(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  payload = payload || {};
  const id = String(payload.id || '').trim();
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const c = exigirRegistro(porId(ctx.cats, id), 'CATEGORIA_NAO_ENCONTRADA', 'Categoria não encontrada.');
      const nome = payload.nome === undefined ? c.NOME : limparTexto(payload.nome, 120);
      const prefixo = payload.prefixo === undefined ? String(c.PREFIXO || '') : limparTexto(payload.prefixo, 6).toUpperCase().replace(/[^A-Z0-9]/g, '');
      assert(nome.length >= 2, 'NOME_INVALIDO', 'Informe o nome da categoria.');
      assert(/^[A-Z0-9]{2,6}$/.test(prefixo), 'PREFIXO_INVALIDO', 'O prefixo deve ter de 2 a 6 letras/números.');
      ctx.cats.forEach(function (x) {
        if (x.ID !== c.ID && normalizarKey(x.NOME) === normalizarKey(nome)) fail('NOME_EM_USO', 'Já existe uma categoria com esse nome.');
        if (x.ID !== c.ID && String(x.PREFIXO || '').toUpperCase() === prefixo) fail('PREFIXO_EM_USO', 'Já existe uma categoria com esse prefixo.');
      });
      if (prefixo !== String(c.PREFIXO || '')) {
        const temEq = ctx.eqs.some(function (e) { return String(e.CATEGORIA_ID) === String(c.ID); });
        if (temEq) fail('PREFIXO_COM_EQUIPAMENTOS', 'Não altere o prefixo de uma categoria que já possui equipamentos.');
      }
      const antes = c.NOME;
      c.NOME = nome;
      c.PREFIXO = prefixo;
      c.CAMPO_ITEM = payload.campoItem === undefined ? c.CAMPO_ITEM : (limparTexto(payload.campoItem, 60) || 'ITEM');
      c.ORDEM = payload.ordem === undefined ? toInt(c.ORDEM) : toInt(payload.ordem);
      c.ATUALIZADO_EM = nowStamp();
      updateObject(SHEET.CATEGORIAS, c._row, c);
      try {
        const shAba = getSpreadsheet().getSheetByName(c.NOME_ABA);
        if (shAba) {
          shAba.getRange(1, 1).setValue(nome);
          shAba.getRange(3, 4).setValue(c.CAMPO_ITEM || 'ITEM');
        }
      } catch (e) {}
      if (normalizarKey(antes) !== normalizarKey(nome)) {
        ctx.eqs.forEach(function (e) {
          if (String(e.CATEGORIA_ID) === String(c.ID)) {
            e.CATEGORIA_NOME = nome;
            e.ATUALIZADO_EM = nowStamp();
            updateObject(SHEET.EQUIPAMENTOS, e._row, e);
            ctx.loans.forEach(function (l) {
              if (String(l.EQUIPAMENTO_ID) === String(e.ID) && String(l.STATUS) === STATUS_LOAN.ABERTO) {
                l.EQUIPAMENTO_NOME = nomeEquipamento(e, c);
                l.ATUALIZADO_EM = nowStamp();
                updateObject(SHEET.EMPRESTIMOS, l._row, l);
              }
            });
          }
        });
      }
      audit(session, 'EDITAR_CATEGORIA', 'CATEGORIA', c.ID, { antes: antes, depois: nome }, requestId);
      const ctx2 = contexto();
      return { categoria: categoriaView(porId(ctx2.cats, c.ID), ctx2) };
    });
  });
}

function inativarCategoria(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  const id = String((payload || {}).id || '').trim();
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const c = exigirRegistro(porId(ctx.cats, id), 'CATEGORIA_NAO_ENCONTRADA', 'Categoria não encontrada.');
      const ativos = ctx.eqs.filter(function (e) { return String(e.CATEGORIA_ID) === String(c.ID) && String(e.STATUS) !== STATUS_EQ.INATIVO; });
      if (ativos.length) fail('CATEGORIA_COM_EQUIPAMENTOS', 'Não é possível inativar: existem equipamentos ativos nesta categoria.');
      c.ATIVO = 'NAO'; c.ATUALIZADO_EM = nowStamp();
      updateObject(SHEET.CATEGORIAS, c._row, c);
      audit(session, 'INATIVAR_CATEGORIA', 'CATEGORIA', c.ID, null, requestId);
      const ctx2 = contexto();
      return { categoria: categoriaView(porId(ctx2.cats, c.ID), ctx2) };
    });
  });
}

function reativarCategoria(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  const id = String((payload || {}).id || '').trim();
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const c = exigirRegistro(porId(ctx.cats, id), 'CATEGORIA_NAO_ENCONTRADA', 'Categoria não encontrada.');
      c.ATIVO = 'SIM'; c.ATUALIZADO_EM = nowStamp();
      updateObject(SHEET.CATEGORIAS, c._row, c);
      audit(session, 'REATIVAR_CATEGORIA', 'CATEGORIA', c.ID, null, requestId);
      const ctx2 = contexto();
      return { categoria: categoriaView(porId(ctx2.cats, c.ID), ctx2) };
    });
  });
}

function excluirCategoria(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  const id = String((payload || {}).id || '').trim();
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const c = exigirRegistro(porId(ctx.cats, id), 'CATEGORIA_NAO_ENCONTRADA', 'Categoria não encontrada.');
      const temEq = ctx.eqs.some(function (e) { return String(e.CATEGORIA_ID) === String(c.ID); });
      if (temEq) fail('CATEGORIA_COM_EQUIPAMENTOS', 'Esta categoria possui equipamentos. Use a inativação.');
      deleteObject(SHEET.CATEGORIAS, c._row);
      audit(session, 'EXCLUIR_CATEGORIA', 'CATEGORIA', c.ID, { nome: c.NOME }, requestId);
      return { ok: true };
    });
  });
}

function acessoriosSolicitados(payload, eq, pend) {
  const acc = (payload && payload.acessorios && typeof payload.acessorios === 'object') ? payload.acessorios : {};
  const car = acc.CARREGADOR !== undefined ? toInt(acc.CARREGADOR) : toInt((payload || {}).carregadorQtd || 0);
  const bat = acc.BATERIA !== undefined ? toInt(acc.BATERIA) : toInt((payload || {}).bateriaQtd || 0);
  assert(car >= 0 && bat >= 0, 'ACESSORIO_INVALIDO', 'Quantidade de acessório inválida.');
  const pt = pendentesPorTipo(pend);
  const total = acessoriosTotais(eq);
  const out = [];
  total.forEach(function (a) {
    const pedido = a.tipo === 'CARREGADOR' ? car : bat;
    if (pedido <= 0) return;
    const disponivel = Math.max(0, a.qtd - (pt[a.tipo] || 0));
    assert(pedido <= disponivel, 'ACESSORIO_INDISPONIVEL', 'Só há ' + disponivel + ' ' + a.tipo.toLowerCase() + '(es) disponível(is) para entrega.');
    out.push({ tipo: a.tipo, codigo: a.codigo, codigos: a.codigos, qtd: pedido });
  });
  if (car > 0 && !out.some(function (a) { return a.tipo === 'CARREGADOR'; })) fail('ACESSORIO_INEXISTENTE', 'Este equipamento não possui carregador cadastrado.');
  if (bat > 0 && !out.some(function (a) { return a.tipo === 'BATERIA'; })) fail('ACESSORIO_INEXISTENTE', 'Este equipamento não possui bateria cadastrada.');
  return out;
}

function acessoriosDevolvidos(payload, loan) {
  const acc = (payload && payload.acessorios && typeof payload.acessorios === 'object') ? payload.acessorios : {};
  const car = acc.CARREGADOR !== undefined ? toInt(acc.CARREGADOR) : toInt((payload || {}).carregadorQtd || 0);
  const bat = acc.BATERIA !== undefined ? toInt(acc.BATERIA) : toInt((payload || {}).bateriaQtd || 0);
  assert(car >= 0 && bat >= 0, 'ACESSORIO_INVALIDO', 'Quantidade de acessório inválida.');
  const pend = jsonParseSafe(loan.ACESSORIOS_PENDENTES, []);
  const pt = pendentesPorTipo(pend);
  assert(car <= (pt.CARREGADOR || 0), 'DEVOLUCAO_INVALIDA', 'A quantidade de carregadores devolvida é maior que a pendente.');
  assert(bat <= (pt.BATERIA || 0), 'DEVOLUCAO_INVALIDA', 'A quantidade de baterias devolvida é maior que a pendente.');
  const devolvidos = [];
  pend.forEach(function (a) {
    const q = a.tipo === 'CARREGADOR' ? car : (a.tipo === 'BATERIA' ? bat : 0);
    if (q > 0) devolvidos.push({ tipo: a.tipo, codigo: a.codigo, codigos: a.codigos || [], qtd: q });
  });
  const restantes = removerAcessorios(pend, devolvidos);
  return { devolvidos: devolvidos, restantes: restantes };
}

function atualizarDerivados(eq, loans, mans) {
  if (String(eq.STATUS) === STATUS_EQ.INATIVO) return eq;
  const open = (loans || []).filter(function (l) { return String(l.EQUIPAMENTO_ID) === String(eq.ID) && String(l.STATUS) === STATUS_LOAN.ABERTO; });
  const man = (mans || []).filter(function (m) { return String(m.EQUIPAMENTO_ID) === String(eq.ID) && (String(m.STATUS) === STATUS_MAN.ABERTA || String(m.STATUS) === STATUS_MAN.EM_ANDAMENTO); })[0];
  if (man) {
    eq.STATUS = STATUS_EQ.MANUTENCAO;
    eq.QUANTIDADE_DISPONIVEL = 0;
    eq.COLABORADOR_ATUAL_ID = '';
    eq.COLABORADOR_ATUAL_NOME = '';
    eq.DATA_ENTREGA_ATUAL = '';
    eq.ACESSORIOS_PENDENTES = '[]';
    return eq;
  }
  const comQtd = open.filter(function (l) { return toInt(l.QUANTIDADE) > 0; });
  const emUso = comQtd.reduce(function (s, l) { return s + toInt(l.QUANTIDADE); }, 0);
  const total = toNumber(eq.QUANTIDADE_TOTAL);
  const disp = Math.max(0, total - emUso);
  eq.QUANTIDADE_DISPONIVEL = disp;
  eq.STATUS = emUso <= 0 ? STATUS_EQ.DISPONIVEL : (disp > 0 ? STATUS_EQ.PARCIAL : STATUS_EQ.ENTREGUE);
  const nomes = {};
  comQtd.forEach(function (l) { if (l.COLABORADOR_NOME) nomes[l.COLABORADOR_NOME] = l.COLABORADOR_ID; });
  const chaves = Object.keys(nomes);
  if (chaves.length === 1) {
    eq.COLABORADOR_ATUAL_NOME = chaves[0];
    eq.COLABORADOR_ATUAL_ID = nomes[chaves[0]];
  } else if (chaves.length > 1) {
    eq.COLABORADOR_ATUAL_NOME = 'VÁRIOS';
    eq.COLABORADOR_ATUAL_ID = '';
  } else {
    eq.COLABORADOR_ATUAL_NOME = '';
    eq.COLABORADOR_ATUAL_ID = '';
  }
  const datas = comQtd.map(function (l) { return String(l.DATA_ENTREGA || ''); }).filter(Boolean).sort();
  eq.DATA_ENTREGA_ATUAL = datas.length ? datas[0] : '';
  let pend = [];
  open.forEach(function (l) { pend = pend.concat(jsonParseSafe(l.ACESSORIOS_PENDENTES, [])); });
  eq.ACESSORIOS_PENDENTES = jsonText(somarAcessorios(pend));
  return eq;
}

function resolverColaboradorOperacao(payload, cfg) {
  payload = payload || {};
  cfg = cfg || {};
  const nomeInformado = limparTexto(payload[cfg.campoNome], 120);
  const id = String(payload[cfg.campoId] || '').trim();
  const cols = lerTodosColaboradores();
  const base = id ? porId(cols, id) : null;
  const nome = nomeInformado || (base ? base.NOME : '');
  assert(nome.length >= 2, 'COLABORADOR_OBRIGATORIO', 'Informe o responsável.');
  const chave = normalizarKey(nome);
  let existente = null;
  if (base && normalizarKey(base.NOME) === chave) existente = base;
  if (!existente) {
    for (let i = 0; i < cols.length; i++) {
      if (normalizarKey(cols[i].NOME) === chave) { existente = cols[i]; break; }
    }
  }
  if (existente) {
    if (String(existente.ATIVO) !== 'SIM') {
      fail('COLABORADOR_INATIVO', 'O responsável "' + existente.NOME + '" está inativo. Reative o cadastro ou informe outro nome.');
    }
    return existente;
  }
  const agora = nowStamp();
  const origem = String(cfg.origem || 'OPERACAO');
  const novo = {
    ID: newId('COL'), NOME: nome, TIPO: 'NAO_INFORMADO', FUNCAO: '', TELEFONE: '', EMAIL: '',
    LOCAL_OBRA: '', SETOR: '', ATIVO: 'SIM',
    OBSERVACOES: 'Criado automaticamente ao registrar ' + origem.toLowerCase() + '. Não possui acesso ao sistema.',
    ORIGEM: 'AUTO_' + origem, CRIADO_EM: agora, ATUALIZADO_EM: agora
  };
  appendObject(SHEET.COLABORADORES, novo);
  audit(cfg.session, 'CRIAR_COLABORADOR_AUTO', 'COLABORADOR', novo.ID, { nome: nome, origem: origem }, cfg.requestId);
  return novo;
}

function registrarEntrega(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  payload = payload || {};
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const eq = exigirRegistro(porId(ctx.eqs, payload.equipamentoId), 'EQUIPAMENTO_NAO_ENCONTRADO', 'Equipamento não encontrado.');
      const col = resolverColaboradorOperacao(payload, { campoNome: 'colaboradorNome', campoId: 'colaboradorId', origem: 'ENTREGA', session: session, requestId: requestId });
      if (String(eq.STATUS) === STATUS_EQ.INATIVO) fail('EQUIPAMENTO_INATIVO', 'Equipamento inativo não pode ser entregue.');
      if (String(eq.STATUS) === STATUS_EQ.MANUTENCAO) fail('EQUIPAMENTO_MANUTENCAO', 'Equipamento em manutenção não pode ser entregue.');
      const qtd = Math.max(1, toInt(payload.quantidade) || 1);
      const disp = toNumber(eq.QUANTIDADE_DISPONIVEL);
      assert(qtd <= disp, 'SALDO_INSUFICIENTE', 'Saldo insuficiente. Disponível: ' + disp + ' unidade(s).');
      const data = validarData(payload.data, true, 'a data de entrega');
      const conservacao = validarConservacao(payload.estadoConservacao, eq.ESTADO_CONSERVACAO);
      const pend = jsonParseSafe(eq.ACESSORIOS_PENDENTES, []);
      const acc = acessoriosSolicitados(payload, eq, pend);
      const cat = ctx.catMap[eq.CATEGORIA_ID] || null;
      const agora = nowStamp();
      const loanId = newId('EMP');
      const movId = newId('MOV');
      const loan = {
        ID: loanId, EQUIPAMENTO_ID: eq.ID, EQUIPAMENTO_CODIGO: eq.CODIGO, EQUIPAMENTO_NOME: nomeEquipamento(eq, cat),
        COLABORADOR_ID: col.ID, COLABORADOR_NOME: col.NOME, DATA_ENTREGA: data, QUANTIDADE: qtd,
        ESTADO_ENTREGA: conservacao, ACESSORIOS_ENTREGUES: jsonText(acc), ACESSORIOS_PENDENTES: jsonText(acc),
        EQUIPAMENTO_DEVOLVIDO: 'NAO', DATA_DEVOLUCAO_EQUIPAMENTO: '', STATUS: STATUS_LOAN.ABERTO,
        MOVIMENTO_ENTREGA_ID: movId, MOVIMENTO_ENCERRAMENTO_ID: '',
        OBSERVACOES: limparTexto(payload.observacoes, 2000), ORIGEM: 'APP', CRIADO_EM: agora, ATUALIZADO_EM: agora, USUARIO: session.email
      };
      appendObject(SHEET.EMPRESTIMOS, loan);
      appendObject(SHEET.MOVIMENTACOES, {
        ID: movId, DATA: data, TIPO: 'ENTREGA', EQUIPAMENTO_ID: eq.ID, EQUIPAMENTO_CODIGO: eq.CODIGO,
        CATEGORIA_NOME: cat ? cat.NOME : eq.CATEGORIA_NOME, QUANTIDADE: qtd,
        COLABORADOR_ORIGEM_ID: '', COLABORADOR_ORIGEM_NOME: '', COLABORADOR_DESTINO_ID: col.ID, COLABORADOR_DESTINO_NOME: col.NOME,
        ESTADO_CONSERVACAO: conservacao, ACESSORIOS_ENTREGUES: jsonText(acc), ACESSORIOS_DEVOLVIDOS: '[]', ACESSORIOS_PENDENTES: jsonText(acc),
        OBSERVACOES: limparTexto(payload.observacoes, 2000), EMPRESTIMO_ID: loanId, MANUTENCAO_ID: '', USUARIO_ID: session.id,
        USUARIO_EMAIL: session.email, ORIGEM: 'APP', REQUEST_ID: requestId, CRIADO_EM: agora
      });
      const eq2 = porId(lerTodosEquipamentos(), eq.ID);
      eq2.ESTADO_CONSERVACAO = conservacao;
      atualizarDerivados(eq2, lerTodosEmprestimos(), lerTodasManutencoes());
      eq2.ATUALIZADO_EM = agora; eq2.ATUALIZADO_POR = session.email;
      updateObject(SHEET.EQUIPAMENTOS, eq2._row, eq2);
      const sync = sincronizarEquipamentoSeguro(eq2, { session: session, requestId: requestId });
      const avisos = sync.ok ? [] : ['Entrega salva no sistema, mas a aba ' + (sync.aba || 'da categoria') + ' não foi sincronizada: ' + sync.erro + ' Use Sincronizar planilha.'];
      audit(session, 'REGISTRAR_ENTREGA', 'EMPRESTIMO', loanId, { equipamento: eq.CODIGO, colaborador: col.NOME, quantidade: qtd, acessorios: acc }, requestId);
      const ctx2 = contexto();
      return { equipamento: equipamentoView(porId(ctx2.eqs, eq.ID), ctx2), emprestimo: emprestimoView(porId(ctx2.loans, loanId), ctx2), avisos: avisos };
    });
  });
}

function registrarDevolucao(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  payload = payload || {};
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const loan = exigirRegistro(porId(ctx.loans, payload.emprestimoId), 'EMPRESTIMO_NAO_ENCONTRADO', 'Empréstimo não encontrado.');
      if (String(loan.STATUS) !== STATUS_LOAN.ABERTO) fail('EMPRESTIMO_ENCERRADO', 'Este empréstimo não está aberto.');
      const eq = exigirRegistro(porId(ctx.eqs, loan.EQUIPAMENTO_ID), 'EQUIPAMENTO_NAO_ENCONTRADO', 'Equipamento não encontrado.');
      const data = validarData(payload.data, true, 'a data de devolução');
      const conservacao = validarConservacao(payload.estadoConservacao, eq.ESTADO_CONSERVACAO);
      const qtdDev = payload.quantidade === undefined ? toInt(loan.QUANTIDADE) : Math.max(0, toInt(payload.quantidade));
      assert(qtdDev <= toInt(loan.QUANTIDADE), 'DEVOLUCAO_INVALIDA', 'A quantidade devolvida é maior que a quantidade do empréstimo.');
      const acc = acessoriosDevolvidos(payload, loan);
      assert(qtdDev > 0 || acc.devolvidos.length > 0, 'DEVOLUCAO_VAZIA', 'Informe a devolução de pelo menos um equipamento ou acessório.');
      const novaQtd = Math.max(0, toInt(loan.QUANTIDADE) - qtdDev);
      const novoPend = acc.restantes;
      const encerrado = novaQtd === 0 && novoPend.length === 0;
      const agora = nowStamp();
      const movId = newId('MOV');
      loan.QUANTIDADE = novaQtd;
      loan.ACESSORIOS_PENDENTES = jsonText(novoPend);
      loan.EQUIPAMENTO_DEVOLVIDO = novaQtd === 0 ? 'SIM' : 'NAO';
      loan.DATA_DEVOLUCAO_EQUIPAMENTO = novaQtd === 0 ? data : '';
      loan.STATUS = encerrado ? STATUS_LOAN.ENCERRADO : STATUS_LOAN.ABERTO;
      loan.MOVIMENTO_ENCERRAMENTO_ID = encerrado ? movId : (loan.MOVIMENTO_ENCERRAMENTO_ID || '');
      loan.ATUALIZADO_EM = agora;
      if (payload.observacoes) loan.OBSERVACOES = normalizarTexto((loan.OBSERVACOES ? loan.OBSERVACOES + ' | ' : '') + 'Devolução ' + data + ': ' + limparTexto(payload.observacoes, 1000));
      updateObject(SHEET.EMPRESTIMOS, loan._row, loan);
      appendObject(SHEET.MOVIMENTACOES, {
        ID: movId, DATA: data, TIPO: 'DEVOLUCAO', EQUIPAMENTO_ID: eq.ID, EQUIPAMENTO_CODIGO: eq.CODIGO,
        CATEGORIA_NOME: (ctx.catMap[eq.CATEGORIA_ID] || {}).NOME || eq.CATEGORIA_NOME, QUANTIDADE: qtdDev,
        COLABORADOR_ORIGEM_ID: loan.COLABORADOR_ID, COLABORADOR_ORIGEM_NOME: loan.COLABORADOR_NOME, COLABORADOR_DESTINO_ID: '', COLABORADOR_DESTINO_NOME: '',
        ESTADO_CONSERVACAO: conservacao, ACESSORIOS_ENTREGUES: '[]', ACESSORIOS_DEVOLVIDOS: jsonText(acc.devolvidos), ACESSORIOS_PENDENTES: jsonText(novoPend),
        OBSERVACOES: limparTexto(payload.observacoes, 2000), EMPRESTIMO_ID: loan.ID, MANUTENCAO_ID: '', USUARIO_ID: session.id,
        USUARIO_EMAIL: session.email, ORIGEM: 'APP', REQUEST_ID: requestId, CRIADO_EM: agora
      });
      eq.ESTADO_CONSERVACAO = conservacao;
      eq.ATUALIZADO_EM = agora; eq.ATUALIZADO_POR = session.email;
      atualizarDerivados(eq, lerTodosEmprestimos(), lerTodasManutencoes());
      updateObject(SHEET.EQUIPAMENTOS, eq._row, eq);
      const sync = sincronizarEquipamentoSeguro(eq, { session: session, requestId: requestId });
      const avisos = sync.ok ? [] : ['Devolução salva no sistema, mas a aba ' + (sync.aba || 'da categoria') + ' não foi sincronizada: ' + sync.erro + ' Use Sincronizar planilha.'];
      audit(session, 'REGISTRAR_DEVOLUCAO', 'EMPRESTIMO', loan.ID, { equipamento: eq.CODIGO, quantidade: qtdDev, acessorios: acc.devolvidos, encerrado: encerrado }, requestId);
      const ctx2 = contexto();
      return { equipamento: equipamentoView(porId(ctx2.eqs, eq.ID), ctx2), emprestimo: emprestimoView(porId(ctx2.loans, loan.ID), ctx2), avisos: avisos };
    });
  });
}

function registrarTransferencia(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  payload = payload || {};
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const loan = exigirRegistro(porId(ctx.loans, payload.emprestimoId), 'EMPRESTIMO_NAO_ENCONTRADO', 'Empréstimo não encontrado.');
      if (String(loan.STATUS) !== STATUS_LOAN.ABERTO || toInt(loan.QUANTIDADE) <= 0) fail('TRANSFERENCIA_INVALIDA', 'Só é possível transferir um empréstimo aberto com equipamento em posse do colaborador.');
      const novo = resolverColaboradorOperacao(payload, { campoNome: 'novoColaboradorNome', campoId: 'novoColaboradorId', origem: 'TRANSFERENCIA', session: session, requestId: requestId });
      if (String(novo.ID) === String(loan.COLABORADOR_ID)) fail('TRANSFERENCIA_INVALIDA', 'O novo responsável é o mesmo colaborador atual.');
      const data = validarData(payload.data, true, 'a data da transferência');
      const eq = exigirRegistro(porId(ctx.eqs, loan.EQUIPAMENTO_ID), 'EQUIPAMENTO_NAO_ENCONTRADO', 'Equipamento não encontrado.');
      const agora = nowStamp();
      const novoLoanId = newId('EMP');
      const movId = newId('MOV');
      const transf = jsonParseSafe(loan.ACESSORIOS_PENDENTES, []);
      const oldColab = { id: loan.COLABORADOR_ID, nome: loan.COLABORADOR_NOME };
      loan.ACESSORIOS_PENDENTES = '[]';
      loan.STATUS = STATUS_LOAN.TRANSFERIDO;
      loan.EQUIPAMENTO_DEVOLVIDO = 'SIM';
      loan.DATA_DEVOLUCAO_EQUIPAMENTO = data;
      loan.MOVIMENTO_ENCERRAMENTO_ID = movId;
      loan.ATUALIZADO_EM = agora;
      updateObject(SHEET.EMPRESTIMOS, loan._row, loan);
      const novoLoan = {
        ID: novoLoanId, EQUIPAMENTO_ID: eq.ID, EQUIPAMENTO_CODIGO: eq.CODIGO,
        EQUIPAMENTO_NOME: nomeEquipamento(eq, ctx.catMap[eq.CATEGORIA_ID] || null),
        COLABORADOR_ID: novo.ID, COLABORADOR_NOME: novo.NOME, DATA_ENTREGA: data, QUANTIDADE: toInt(loan.QUANTIDADE),
        ESTADO_ENTREGA: eq.ESTADO_CONSERVACAO, ACESSORIOS_ENTREGUES: jsonText(transf), ACESSORIOS_PENDENTES: jsonText(transf),
        EQUIPAMENTO_DEVOLVIDO: 'NAO', DATA_DEVOLUCAO_EQUIPAMENTO: '', STATUS: STATUS_LOAN.ABERTO,
        MOVIMENTO_ENTREGA_ID: movId, MOVIMENTO_ENCERRAMENTO_ID: '',
        OBSERVACOES: 'Transferido de ' + oldColab.nome + '.' + (payload.observacoes ? ' ' + limparTexto(payload.observacoes, 1000) : ''),
        ORIGEM: 'TRANSFERENCIA', CRIADO_EM: agora, ATUALIZADO_EM: agora, USUARIO: session.email
      };
      appendObject(SHEET.EMPRESTIMOS, novoLoan);
      appendObject(SHEET.MOVIMENTACOES, {
        ID: movId, DATA: data, TIPO: 'TRANSFERENCIA', EQUIPAMENTO_ID: eq.ID, EQUIPAMENTO_CODIGO: eq.CODIGO,
        CATEGORIA_NOME: (ctx.catMap[eq.CATEGORIA_ID] || {}).NOME || eq.CATEGORIA_NOME, QUANTIDADE: toInt(loan.QUANTIDADE),
        COLABORADOR_ORIGEM_ID: oldColab.id, COLABORADOR_ORIGEM_NOME: oldColab.nome, COLABORADOR_DESTINO_ID: novo.ID, COLABORADOR_DESTINO_NOME: novo.NOME,
        ESTADO_CONSERVACAO: eq.ESTADO_CONSERVACAO, ACESSORIOS_ENTREGUES: '[]', ACESSORIOS_DEVOLVIDOS: '[]', ACESSORIOS_PENDENTES: jsonText(transf),
        OBSERVACOES: limparTexto(payload.observacoes, 2000), EMPRESTIMO_ID: novoLoanId, MANUTENCAO_ID: '', USUARIO_ID: session.id,
        USUARIO_EMAIL: session.email, ORIGEM: 'APP', REQUEST_ID: requestId, CRIADO_EM: agora
      });
      eq.ATUALIZADO_EM = agora; eq.ATUALIZADO_POR = session.email;
      atualizarDerivados(eq, lerTodosEmprestimos(), lerTodasManutencoes());
      updateObject(SHEET.EQUIPAMENTOS, eq._row, eq);
      const sync = sincronizarEquipamentoSeguro(eq, { session: session, requestId: requestId });
      const avisos = sync.ok ? [] : ['Transferência salva no sistema, mas a aba ' + (sync.aba || 'da categoria') + ' não foi sincronizada: ' + sync.erro + ' Use Sincronizar planilha.'];
      audit(session, 'TRANSFERIR', 'EMPRESTIMO', loan.ID, { equipamento: eq.CODIGO, de: oldColab.nome, para: novo.NOME, acessorios: transf }, requestId);
      const ctx2 = contexto();
      return { equipamento: equipamentoView(porId(ctx2.eqs, eq.ID), ctx2), emprestimo: emprestimoView(porId(ctx2.loans, novoLoanId), ctx2), avisos: avisos };
    });
  });
}

function abrirManutencao(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  payload = payload || {};
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const eq = exigirRegistro(porId(ctx.eqs, payload.equipamentoId), 'EQUIPAMENTO_NAO_ENCONTRADO', 'Equipamento não encontrado.');
      if (String(eq.STATUS) === STATUS_EQ.INATIVO) fail('EQUIPAMENTO_INATIVO', 'Equipamento inativo.');
      if (String(eq.STATUS) === STATUS_EQ.MANUTENCAO) fail('EQUIPAMENTO_MANUTENCAO', 'Equipamento já está em manutenção.');
      const openLoans = ctx.loans.filter(function (l) { return String(l.EQUIPAMENTO_ID) === String(eq.ID) && String(l.STATUS) === STATUS_LOAN.ABERTO; });
      if (openLoans.length) fail('EQUIPAMENTO_EM_USO', 'Registre a devolução completa antes de enviar para manutenção.');
      if (toNumber(eq.QUANTIDADE_DISPONIVEL) !== toNumber(eq.QUANTIDADE_TOTAL)) fail('EQUIPAMENTO_EM_USO', 'O equipamento não está totalmente disponível.');
      const data = validarData(payload.dataEnvio, true, 'a data de envio para manutenção');
      const previsao = validarData(payload.previsaoRetorno, false, 'a previsão de retorno');
      const custo = payload.custo === undefined || payload.custo === '' ? '' : Math.max(0, toNumber(payload.custo));
      const agora = nowStamp();
      const manId = newId('MAN');
      const movId = newId('MOV');
      const man = {
        ID: manId, EQUIPAMENTO_ID: eq.ID, EQUIPAMENTO_CODIGO: eq.CODIGO,
        CATEGORIA_NOME: (ctx.catMap[eq.CATEGORIA_ID] || {}).NOME || eq.CATEGORIA_NOME,
        DATA_ENVIO: data, DEFEITO: limparTexto(payload.defeito, 1000), RESPONSAVEL: limparTexto(payload.responsavel, 200),
        CELULAR_RESPONSAVEL: limparTexto(payload.celularResponsavel, 40),
        STATUS: STATUS_MAN.ABERTA, SERVICO: '', CUSTO: custo, PREVISAO_RETORNO: previsao, DATA_RETORNO: '', ESTADO_RETORNO: '',
        OBSERVACOES: limparTexto(payload.observacoes, 2000), ORIGEM: 'APP', USUARIO: session.email,
        CRIADO_EM: agora, ATUALIZADO_EM: agora, REVISAR: 'NAO', MOTIVO_REVISAO: ''
      };
      appendObject(SHEET.MANUTENCOES, man);
      eq.STATUS = STATUS_EQ.MANUTENCAO;
      eq.QUANTIDADE_DISPONIVEL = 0;
      eq.COLABORADOR_ATUAL_ID = '';
      eq.COLABORADOR_ATUAL_NOME = '';
      eq.DATA_ENTREGA_ATUAL = '';
      eq.ACESSORIOS_PENDENTES = '[]';
      eq.ATUALIZADO_EM = agora; eq.ATUALIZADO_POR = session.email;
      updateObject(SHEET.EQUIPAMENTOS, eq._row, eq);
      const sync = sincronizarEquipamentoSeguro(eq, { session: session, requestId: requestId });
      const avisos = sync.ok ? [] : ['Manutenção salva no sistema, mas a aba ' + (sync.aba || 'da categoria') + ' não foi sincronizada: ' + sync.erro + ' Use Sincronizar planilha.'];
      appendObject(SHEET.MOVIMENTACOES, {
        ID: movId, DATA: data, TIPO: 'SAIDA_MANUTENCAO', EQUIPAMENTO_ID: eq.ID, EQUIPAMENTO_CODIGO: eq.CODIGO,
        CATEGORIA_NOME: man.CATEGORIA_NOME, QUANTIDADE: toNumber(eq.QUANTIDADE_TOTAL),
        COLABORADOR_ORIGEM_ID: '', COLABORADOR_ORIGEM_NOME: '', COLABORADOR_DESTINO_ID: '', COLABORADOR_DESTINO_NOME: '',
        ESTADO_CONSERVACAO: eq.ESTADO_CONSERVACAO, ACESSORIOS_ENTREGUES: '[]', ACESSORIOS_DEVOLVIDOS: '[]', ACESSORIOS_PENDENTES: '[]',
        OBSERVACOES: limparTexto(payload.defeito, 2000), EMPRESTIMO_ID: '', MANUTENCAO_ID: manId, USUARIO_ID: session.id,
        USUARIO_EMAIL: session.email, ORIGEM: 'APP', REQUEST_ID: requestId, CRIADO_EM: agora
      });
      audit(session, 'ABRIR_MANUTENCAO', 'MANUTENCAO', manId, { equipamento: eq.CODIGO, defeito: man.DEFEITO }, requestId);
      const ctx2 = contexto();
      return { equipamento: equipamentoView(porId(ctx2.eqs, eq.ID), ctx2), manutencao: manutencaoView(porId(ctx2.mans, manId), ctx2), avisos: avisos };
    });
  });
}

function atualizarManutencao(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  payload = payload || {};
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const man = exigirRegistro(porId(lerTodasManutencoes(), payload.id), 'MANUTENCAO_NAO_ENCONTRADA', 'Manutenção não encontrada.');
      if (String(man.STATUS) !== STATUS_MAN.ABERTA && String(man.STATUS) !== STATUS_MAN.EM_ANDAMENTO) fail('MANUTENCAO_ENCERRADA', 'Esta manutenção não está aberta.');
      const status = payload.status === undefined ? man.STATUS : String(payload.status).toUpperCase();
      assert(status === STATUS_MAN.ABERTA || status === STATUS_MAN.EM_ANDAMENTO, 'STATUS_INVALIDO', 'Use a conclusão para encerrar a manutenção.');
      man.STATUS = status;
      man.DEFEITO = payload.defeito === undefined ? man.DEFEITO : limparTexto(payload.defeito, 1000);
      man.RESPONSAVEL = payload.responsavel === undefined ? man.RESPONSAVEL : limparTexto(payload.responsavel, 200);
      man.CELULAR_RESPONSAVEL = payload.celularResponsavel === undefined ? man.CELULAR_RESPONSAVEL : limparTexto(payload.celularResponsavel, 40);
      man.SERVICO = payload.servico === undefined ? man.SERVICO : limparTexto(payload.servico, 1000);
      man.CUSTO = payload.custo === undefined ? man.CUSTO : (payload.custo === '' ? '' : Math.max(0, toNumber(payload.custo)));
      man.PREVISAO_RETORNO = payload.previsaoRetorno === undefined ? man.PREVISAO_RETORNO : validarData(payload.previsaoRetorno, false, 'a previsão de retorno');
      man.OBSERVACOES = payload.observacoes === undefined ? man.OBSERVACOES : limparTexto(payload.observacoes, 2000);
      man.ATUALIZADO_EM = nowStamp();
      updateObject(SHEET.MANUTENCOES, man._row, man);
      audit(session, 'ATUALIZAR_MANUTENCAO', 'MANUTENCAO', man.ID, { status: status }, requestId);
      const ctx = contexto();
      return { manutencao: manutencaoView(porId(ctx.mans, man.ID), ctx) };
    });
  });
}

function concluirManutencao(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  payload = payload || {};
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const man = exigirRegistro(porId(ctx.mans, payload.id), 'MANUTENCAO_NAO_ENCONTRADA', 'Manutenção não encontrada.');
      if (String(man.STATUS) !== STATUS_MAN.ABERTA && String(man.STATUS) !== STATUS_MAN.EM_ANDAMENTO) fail('MANUTENCAO_ENCERRADA', 'Esta manutenção não está aberta.');
      const eq = exigirRegistro(porId(ctx.eqs, man.EQUIPAMENTO_ID), 'EQUIPAMENTO_NAO_ENCONTRADO', 'Equipamento não encontrado.');
      const data = validarData(payload.dataRetorno, true, 'a data de retorno');
      const estado = payload.estadoRetorno === undefined || payload.estadoRetorno === '' ? (eq.ESTADO_CONSERVACAO || 'NAO_INFORMADO') : validarConservacao(payload.estadoRetorno, eq.ESTADO_CONSERVACAO);
      const agora = nowStamp();
      man.STATUS = STATUS_MAN.CONCLUIDA;
      man.CELULAR_RESPONSAVEL = payload.celularResponsavel === undefined ? man.CELULAR_RESPONSAVEL : limparTexto(payload.celularResponsavel, 40);
      man.SERVICO = payload.servico === undefined ? man.SERVICO : limparTexto(payload.servico, 1000);
      man.CUSTO = payload.custo === undefined ? man.CUSTO : (payload.custo === '' ? '' : Math.max(0, toNumber(payload.custo)));
      man.DATA_RETORNO = data;
      man.ESTADO_RETORNO = estado;
      man.OBSERVACOES = payload.observacoes === undefined ? man.OBSERVACOES : limparTexto(payload.observacoes, 2000);
      man.ATUALIZADO_EM = agora;
      updateObject(SHEET.MANUTENCOES, man._row, man);
      eq.STATUS = STATUS_EQ.DISPONIVEL;
      eq.QUANTIDADE_DISPONIVEL = toNumber(eq.QUANTIDADE_TOTAL);
      eq.ESTADO_CONSERVACAO = estado;
      eq.ATUALIZADO_EM = agora; eq.ATUALIZADO_POR = session.email;
      updateObject(SHEET.EQUIPAMENTOS, eq._row, eq);
      const sync = sincronizarEquipamentoSeguro(eq, { session: session, requestId: requestId });
      const avisos = sync.ok ? [] : ['Manutenção concluída no sistema, mas a aba ' + (sync.aba || 'da categoria') + ' não foi sincronizada: ' + sync.erro + ' Use Sincronizar planilha.'];
      appendObject(SHEET.MOVIMENTACOES, {
        ID: newId('MOV'), DATA: data, TIPO: 'RETORNO_MANUTENCAO', EQUIPAMENTO_ID: eq.ID, EQUIPAMENTO_CODIGO: eq.CODIGO,
        CATEGORIA_NOME: man.CATEGORIA_NOME, QUANTIDADE: toNumber(eq.QUANTIDADE_TOTAL),
        COLABORADOR_ORIGEM_ID: '', COLABORADOR_ORIGEM_NOME: '', COLABORADOR_DESTINO_ID: '', COLABORADOR_DESTINO_NOME: '',
        ESTADO_CONSERVACAO: estado, ACESSORIOS_ENTREGUES: '[]', ACESSORIOS_DEVOLVIDOS: '[]', ACESSORIOS_PENDENTES: '[]',
        OBSERVACOES: 'Retorno da manutenção.' + (payload.observacoes ? ' ' + limparTexto(payload.observacoes, 1500) : ''), EMPRESTIMO_ID: '', MANUTENCAO_ID: man.ID,
        USUARIO_ID: session.id, USUARIO_EMAIL: session.email, ORIGEM: 'APP', REQUEST_ID: requestId, CRIADO_EM: agora
      });
      audit(session, 'CONCLUIR_MANUTENCAO', 'MANUTENCAO', man.ID, { equipamento: eq.CODIGO, data: data, estado: estado }, requestId);
      const ctx2 = contexto();
      return { equipamento: equipamentoView(porId(ctx2.eqs, eq.ID), ctx2), manutencao: manutencaoView(porId(ctx2.mans, man.ID), ctx2), avisos: avisos };
    });
  });
}

function cancelarManutencao(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  payload = payload || {};
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const ctx = contexto();
      const man = exigirRegistro(porId(ctx.mans, payload.id), 'MANUTENCAO_NAO_ENCONTRADA', 'Manutenção não encontrada.');
      if (String(man.STATUS) !== STATUS_MAN.ABERTA && String(man.STATUS) !== STATUS_MAN.EM_ANDAMENTO) fail('MANUTENCAO_ENCERRADA', 'Esta manutenção não está aberta.');
      const eq = exigirRegistro(porId(ctx.eqs, man.EQUIPAMENTO_ID), 'EQUIPAMENTO_NAO_ENCONTRADO', 'Equipamento não encontrado.');
      const data = validarData(payload.dataRetorno, false, 'a data de retorno') || todayIso();
      const motivo = limparTexto(payload.motivo, 1000);
      const agora = nowStamp();
      man.STATUS = STATUS_MAN.CANCELADA;
      man.DATA_RETORNO = data;
      man.OBSERVACOES = normalizarTexto((man.OBSERVACOES ? man.OBSERVACOES + ' | ' : '') + 'Manutenção cancelada em ' + data + (motivo ? ': ' + motivo : ''));
      man.ATUALIZADO_EM = agora;
      updateObject(SHEET.MANUTENCOES, man._row, man);
      eq.STATUS = STATUS_EQ.DISPONIVEL;
      eq.QUANTIDADE_DISPONIVEL = toNumber(eq.QUANTIDADE_TOTAL);
      eq.ATUALIZADO_EM = agora; eq.ATUALIZADO_POR = session.email;
      updateObject(SHEET.EQUIPAMENTOS, eq._row, eq);
      const sync = sincronizarEquipamentoSeguro(eq, { session: session, requestId: requestId });
      const avisos = sync.ok ? [] : ['Cancelamento salvo no sistema, mas a aba ' + (sync.aba || 'da categoria') + ' não foi sincronizada: ' + sync.erro + ' Use Sincronizar planilha.'];
      appendObject(SHEET.MOVIMENTACOES, {
        ID: newId('MOV'), DATA: data, TIPO: 'AJUSTE', EQUIPAMENTO_ID: eq.ID, EQUIPAMENTO_CODIGO: eq.CODIGO,
        CATEGORIA_NOME: man.CATEGORIA_NOME, QUANTIDADE: toNumber(eq.QUANTIDADE_TOTAL),
        COLABORADOR_ORIGEM_ID: '', COLABORADOR_ORIGEM_NOME: '', COLABORADOR_DESTINO_ID: '', COLABORADOR_DESTINO_NOME: '',
        ESTADO_CONSERVACAO: eq.ESTADO_CONSERVACAO, ACESSORIOS_ENTREGUES: '[]', ACESSORIOS_DEVOLVIDOS: '[]', ACESSORIOS_PENDENTES: '[]',
        OBSERVACOES: 'Manutenção cancelada.' + (motivo ? ' ' + motivo : ''), EMPRESTIMO_ID: '', MANUTENCAO_ID: man.ID,
        USUARIO_ID: session.id, USUARIO_EMAIL: session.email, ORIGEM: 'APP', REQUEST_ID: requestId, CRIADO_EM: agora
      });
      audit(session, 'CANCELAR_MANUTENCAO', 'MANUTENCAO', man.ID, { equipamento: eq.CODIGO, motivo: motivo }, requestId);
      const ctx2 = contexto();
      return { equipamento: equipamentoView(porId(ctx2.eqs, eq.ID), ctx2), manutencao: manutencaoView(porId(ctx2.mans, man.ID), ctx2), avisos: avisos };
    });
  });
}
