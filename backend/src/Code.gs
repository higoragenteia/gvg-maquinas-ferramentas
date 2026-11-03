/**
 * Roteador da API. Todas as operações de dados usam POST com corpo JSON.
 * O token de sessão vai no corpo, nunca na URL.
 */

const PUBLIC_ACTIONS = {
  status: function (payload, requestId) {
    return { app: APP_NOME, versao: API_VERSAO, status: 'online', hora: nowStamp() };
  },
  setupStatus: function () {
    return setupStatus();
  },
  setupAdmin: function (payload, requestId) {
    return setupAdmin(payload, requestId);
  },
  login: function (payload, requestId) {
    return login(payload, requestId);
  },
  autoCadastro: function (payload, requestId) {
    return autoCadastro(payload, requestId);
  },
  recuperarAdmin: function (payload, requestId) {
    return recuperarAdmin(payload, requestId);
  }
};

const AUTH_READ = {
  bootstrap: function (payload, session) { return dashboardData(session); },
  detalheEquipamento: function (payload, session) { return detalheEquipamento(payload, session); },
  listarMovimentacoes: function (payload, session) { return listarMovimentacoes(payload, session); },
  listarManutencoes: function (payload, session) { return listarManutencoes(payload, session); }
};

const AUTH_WRITE = {
  logout: function (payload, session, requestId) { return logout(session, requestId); },
  alterarMinhaSenha: function (payload, session, requestId) { return alterarMinhaSenha(payload, session, requestId); }
};

const ADMIN_READ = {
  listarUsuarios: function (payload, session) { return listarUsuarios(session, payload); },
  listarAuditoria: function (payload, session) { return listarAuditoria(payload, session); }
};

const ADMIN_WRITE = {
  criarEquipamento: criarEquipamento,
  editarEquipamento: editarEquipamento,
  marcarRevisadoEquipamento: marcarRevisadoEquipamento,
  inativarEquipamento: inativarEquipamento,
  reativarEquipamento: reativarEquipamento,
  excluirEquipamento: excluirEquipamento,
  criarColaborador: criarColaborador,
  editarColaborador: editarColaborador,
  inativarColaborador: inativarColaborador,
  reativarColaborador: reativarColaborador,
  excluirColaborador: excluirColaborador,
  criarCategoria: criarCategoria,
  editarCategoria: editarCategoria,
  inativarCategoria: inativarCategoria,
  reativarCategoria: reativarCategoria,
  excluirCategoria: excluirCategoria,
  registrarEntrega: registrarEntrega,
  registrarDevolucao: registrarDevolucao,
  registrarTransferencia: registrarTransferencia,
  abrirManutencao: abrirManutencao,
  atualizarManutencao: atualizarManutencao,
  concluirManutencao: concluirManutencao,
  cancelarManutencao: cancelarManutencao,
  criarUsuario: criarUsuario,
  editarUsuario: editarUsuario,
  resetarSenhaUsuario: resetarSenhaUsuario,
  bloquearUsuario: bloquearUsuario,
  desbloquearUsuario: desbloquearUsuario,
  aprovarUsuario: aprovarUsuario,
  sincronizarTudo: sincronizarTudo
};

function doGet(e) {
  return jsonOut({
    ok: true,
    data: {
      app: APP_NOME,
      versao: API_VERSAO,
      status: 'online',
      mensagem: 'API ativa. Use a interface publicada no GitHub Pages.',
      hora: nowStamp()
    }
  });
}

function doPost(e) {
  let body = null;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) ? e.postData.contents : '{}');
  } catch (err) {
    return jsonOut(respostaErro('JSON_INVALIDO', 'Corpo da requisição inválido.'));
  }
  try {
    const action = String((body && body.action) || '').trim();
    const payload = (body && body.payload && typeof body.payload === 'object') ? body.payload : {};
    const requestId = String((body && body.requestId) || '');
    if (!action) return jsonOut(respostaErro('ACAO_OBRIGATORIA', 'Informe a ação.'));

    if (PUBLIC_ACTIONS[action]) {
      return jsonOut({ ok: true, data: PUBLIC_ACTIONS[action](payload, requestId) });
    }

    const session = validarSessao(body.token);

    if (AUTH_READ[action]) {
      return jsonOut({ ok: true, data: AUTH_READ[action](payload, session) });
    }
    if (ADMIN_READ[action]) {
      exigirAdmin(session);
      return jsonOut({ ok: true, data: ADMIN_READ[action](payload, session) });
    }
    if (AUTH_WRITE[action]) {
      return jsonOut({ ok: true, data: AUTH_WRITE[action](payload, session, requestId) });
    }
    if (ADMIN_WRITE[action]) {
      exigirAdmin(session);
      const idReq = requireRequestId(requestId);
      const cached = cacheGet('idem_' + idReq);
      if (cached) {
        try { return jsonOut({ ok: true, data: JSON.parse(cached) }); } catch (e) {}
      }
      return jsonOut({ ok: true, data: ADMIN_WRITE[action](payload, session, requestId) });
    }
    return jsonOut(respostaErro('ACAO_INVALIDA', 'Ação não reconhecida.'));
  } catch (err) {
    if (err && err.code) {
      return jsonOut(respostaErro(err.code, err.message || 'Não foi possível concluir a operação.', err.details || null));
    }
    try { console.error(err && err.stack ? err.stack : String(err)); } catch (e) {}
    return jsonOut(respostaErro('ERRO_INTERNO', 'Não foi possível concluir a operação. Tente novamente.'));
  }
}
