/**
 * Diagnóstico e manutenção da estrutura. Execute pelo editor do Apps Script.
 */

function testarEstrutura() {
  const ss = getSpreadsheet();
  const problemas = [];
  Object.keys(SHEET).forEach(function (k) {
    const nome = SHEET[k];
    const sh = ss.getSheetByName(nome);
    if (!sh) { problemas.push('Aba ausente: ' + nome); return; }
    const esperado = HEADERS[nome] || [];
    const atual = sh.getRange(1, 1, 1, Math.max(1, esperado.length)).getValues()[0].map(function (x) { return String(x || '').trim(); });
    for (let i = 0; i < esperado.length; i++) {
      if (String(atual[i] || '') !== String(esperado[i] || '')) {
        problemas.push(nome + ' coluna ' + (i + 1) + ': esperado "' + esperado[i] + '", encontrado "' + atual[i] + '"');
      }
    }
  });
  const resumo = {
    equipamentos: lerTodosEquipamentos().length,
    colaboradores: lerTodosColaboradores().length,
    categorias: lerTodasCategorias().length,
    emprestimos: lerTodosEmprestimos().length,
    movimentacoes: lerTodosMovimentos().length,
    manutencoes: lerTodasManutencoes().length,
    usuarios: lerTodosUsuarios().length,
    sessoes: readObjects(SHEET.SESSOES).length,
    auditoria: readObjects(SHEET.AUDITORIA).length,
    configKeys: Object.keys(getConfigMap()).length
  };
  Logger.log('RESUMO: ' + JSON.stringify(resumo));
  if (problemas.length) Logger.log('PROBLEMAS:\n' + problemas.join('\n'));
  else Logger.log('Estrutura OK: todas as abas e cabeçalhos conferem.');
  return { resumo: resumo, problemas: problemas };
}

/**
 * Garante que as células de dados das abas do sistema sejam texto.
 * Isso evita que observações iniciadas por "=" virem fórmula e preserva códigos.
 */
function formatarAbasComoSistema() {
  const ss = getSpreadsheet();
  Object.keys(SHEET).forEach(function (k) {
    const nome = SHEET[k];
    const sh = ss.getSheetByName(nome);
    if (!sh) return;
    const ncol = Math.max(1, (HEADERS[nome] || []).length);
    sh.getRange(2, 1, Math.max(1, sh.getMaxRows() - 1), ncol).setNumberFormat('@');
    Logger.log('Formato texto aplicado em ' + nome);
  });
}

/**
 * Verifica se há administrador ativo e se o setup está habilitado.
 */
function diagnosticoSetup() {
  const st = setupStatus();
  const cfg = getConfigMap();
  Logger.log(JSON.stringify({
    setup: st,
    setupCriadoEm: cfg.SETUP_CRIADO_EM || '',
    setupUsadoEm: cfg.SETUP_USADO_EM || '',
    resetExpiraEm: cfg.RESET_EXPIRA_EM || '',
    importacao: cfg.IMPORTACAO_CONCLUIDA_EM || '',
    modo: cfg.IMPORTACAO_MODO || ''
  }, null, 2));
  return st;
}

/**
 * Executa a sincronização das abas originais pelo editor, sem precisar do app.
 * Use depois de uma manutenção manual na planilha.
 */
function sincronizarPlanilhaEditor() {
  const r = sincronizarTudoInterno(
    { id: 'EDITOR', email: 'EDITOR', perfil: PERFIL.ADMIN },
    'EDITOR-' + Date.now()
  );
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}
