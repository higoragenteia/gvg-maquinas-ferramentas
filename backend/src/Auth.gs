/**
 * Autenticação, sessões, usuários e procedimentos de configuração/recuperação.
 */

function hashSenha(senha, salt) {
  let h = sha256Hex(String(salt) + '|' + String(senha));
  for (let i = 1; i < PASSWORD_ITERACOES; i++) {
    h = sha256Hex(h + '|' + String(salt));
  }
  return String(PASSWORD_ITERACOES) + '$' + h;
}

function verificarSenha(senha, salt, armazenado) {
  const s = String(armazenado || '');
  let iter = PASSWORD_ITERACOES;
  let alvo = s;
  const p = s.indexOf('$');
  if (p > 0) {
    iter = Number(s.slice(0, p)) || PASSWORD_ITERACOES;
    alvo = s.slice(p + 1);
  }
  let h = sha256Hex(String(salt) + '|' + String(senha));
  for (let i = 1; i < iter; i++) h = sha256Hex(h + '|' + String(salt));
  return iguaisSeguro(h, alvo);
}

function validarSenha(senha, minimo) {
  const s = String(senha || '');
  const min = Number(minimo) || SENHA_MIN_ADMIN;
  assert(s.length >= min, 'SENHA_CURTA', 'A senha deve ter pelo menos ' + min + ' caracteres.');
  assert(s.length <= 128, 'SENHA_LONGA', 'A senha deve ter no máximo 128 caracteres.');
  assert(!/^\s+$/.test(s), 'SENHA_INVALIDA', 'A senha não pode ser só espaços.');
  return s;
}

function validarEmail(email) {
  const e = normalizarEmail(email);
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e), 'EMAIL_INVALIDO', 'Informe um e-mail válido.');
  return e;
}

function validarLogin(login) {
  const s = normalizarEmail(login);
  assert(s.length >= 3 && s.length <= 80, 'LOGIN_INVALIDO', 'O usuário deve ter entre 3 e 80 caracteres.');
  if (s.indexOf('@') >= 0) {
    assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), 'LOGIN_INVALIDO', 'Informe um e-mail válido ou um usuário sem espaços.');
    return s;
  }
  assert(/^[a-z0-9._-]+$/.test(s), 'LOGIN_INVALIDO', 'Use letras, números, ponto, hífen ou sublinhado no usuário.');
  return s;
}

function codigoHash(codigo) {
  return sha256Hex(String(codigo || '').trim().toUpperCase());
}

function usuarioPublico(u) {
  return {
    id: u.ID,
    nome: u.NOME,
    email: u.EMAIL,
    perfil: u.PERFIL,
    status: u.STATUS,
    criadoEm: u.CRIADO_EM,
    atualizadoEm: u.ATUALIZADO_EM,
    ultimoAcesso: u.ULTIMO_ACESSO,
    observacoes: u.OBSERVACOES || '',
    podeAdministrar: String(u.PERFIL) === PERFIL.ADMIN && String(u.STATUS) === 'ATIVO'
  };
}

function criarSessao(usuario, userAgent, requestId) {
  const token = (Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '')).toLowerCase();
  const tokenHash = sha256Hex(token);
  const criado = nowStamp();
  const expira = Utilities.formatDate(new Date(Date.now() + SESSION_HORAS * 3600 * 1000), TZ, 'yyyy-MM-dd HH:mm:ss');
  appendObject(SHEET.SESSOES, {
    TOKEN_HASH: tokenHash,
    USUARIO_ID: usuario.ID,
    CRIADO_EM: criado,
    EXPIRA_EM: expira,
    REVOGADO_EM: '',
    USER_AGENT: String(userAgent || '').slice(0, 250),
    ULTIMO_USO: criado,
    REQUEST_ID: String(requestId || '').slice(0, 80)
  });
  return { token: token, expiraEm: expira };
}

function validarSessao(token) {
  const t = String(token || '').trim();
  if (!t) fail('NAO_AUTENTICADO', 'Entre no aplicativo para continuar.');
  const hash = sha256Hex(t);
  const sessoes = readObjects(SHEET.SESSOES);
  let sessao = null;
  for (let i = 0; i < sessoes.length; i++) {
    if (iguaisSeguro(String(sessoes[i].TOKEN_HASH || ''), hash)) { sessao = sessoes[i]; break; }
  }
  if (!sessao) fail('NAO_AUTENTICADO', 'Sessão inválida. Entre novamente.');
  if (String(sessao.REVOGADO_EM || '').trim()) fail('NAO_AUTENTICADO', 'Sessão encerrada. Entre novamente.');
  if (String(sessao.EXPIRA_EM || '') <= nowStamp()) fail('SESSAO_EXPIRADA', 'Sua sessão expirou. Entre novamente.');
  const usuarios = lerTodosUsuarios();
  const u = porId(usuarios, sessao.USUARIO_ID);
  if (!u) fail('NAO_AUTENTICADO', 'Usuário não encontrado. Entre novamente.');
  if (String(u.STATUS) !== 'ATIVO') fail('CONTA_BLOQUEADA', 'Sua conta está bloqueada. Fale com o administrador.');
  return {
    id: u.ID,
    nome: u.NOME,
    email: u.EMAIL,
    perfil: u.PERFIL,
    status: u.STATUS,
    tokenHash: hash,
    sessaoRow: sessao._row
  };
}

function revogarSessao(session, requestId) {
  if (!session || !session.sessaoRow) return;
  const s = readObjects(SHEET.SESSOES).filter(function (x) { return x._row === session.sessaoRow; })[0];
  if (!s) return;
  s.REVOGADO_EM = nowStamp();
  updateObject(SHEET.SESSOES, s._row, s);
  audit(session, 'LOGOUT', 'SESSAO', session.tokenHash, null, requestId);
}

function revogarSessoesUsuario(usuarioId, excetoHash) {
  const sessoes = readObjects(SHEET.SESSOES);
  const agora = nowStamp();
  sessoes.forEach(function (s) {
    if (String(s.USUARIO_ID) !== String(usuarioId)) return;
    if (String(s.REVOGADO_EM || '').trim()) return;
    if (excetoHash && iguaisSeguro(String(s.TOKEN_HASH || ''), String(excetoHash))) return;
    s.REVOGADO_EM = agora;
    updateObject(SHEET.SESSOES, s._row, s);
  });
}

function contarAdminsAtivos() {
  return lerTodosUsuarios().filter(function (u) {
    return String(u.PERFIL) === PERFIL.ADMIN && String(u.STATUS) === 'ATIVO';
  }).length;
}

function contarAdmins() {
  return lerTodosUsuarios().filter(function (u) { return String(u.PERFIL) === PERFIL.ADMIN; }).length;
}

function setupStatus() {
  const cfg = getConfigMap();
  const admins = contarAdmins();
  const hash = String(cfg.SETUP_CODE_HASH || '').trim();
  const usado = String(cfg.SETUP_USADO_EM || '').trim();
  const precisa = admins === 0 && !!hash && !usado;
  return {
    precisaSetup: precisa,
    configuracaoPendente: admins === 0 && (!hash || !!usado),
    temAdministrador: admins > 0,
    appNome: APP_NOME,
    versao: API_VERSAO
  };
}

function login(payload, requestId) {
  payload = payload || {};
  const email = normalizarEmail(payload.email);
  const senha = String(payload.senha || '');
  assert(email && senha, 'CREDENCIAIS_OBRIGATORIAS', 'Informe usuário/e-mail e senha.');
  const chave = 'login_fail_' + sha256Hex(email).slice(0, 24);
  const falhas = Number(cacheGet(chave) || 0);
  if (falhas >= MAX_TENTATIVAS_LOGIN) {
    fail('MUITAS_TENTATIVAS', 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.');
  }
  const usuarios = lerTodosUsuarios();
  let u = null;
  for (let i = 0; i < usuarios.length; i++) {
    if (normalizarEmail(usuarios[i].EMAIL) === email) { u = usuarios[i]; break; }
  }
  if (!u || !verificarSenha(senha, u.SENHA_SALT, u.SENHA_HASH)) {
    cachePut(chave, String(falhas + 1), BLOQUEIO_LOGIN_SEGUNDOS);
    audit(null, 'LOGIN_FALHA', 'USUARIO', u ? u.ID : email, { email: email }, requestId, 'APP');
    fail('CREDENCIAIS_INVALIDAS', 'Usuário/e-mail ou senha inválidos.');
  }
  if (String(u.STATUS) === 'PENDENTE') {
    fail('CADASTRO_PENDENTE', 'Cadastro aguardando aprovação do administrador.');
  }
  if (String(u.STATUS) !== 'ATIVO') {
    fail('CONTA_BLOQUEADA', 'Sua conta está bloqueada. Fale com o administrador.');
  }
  cacheRemove(chave);
  u.ULTIMO_ACESSO = nowStamp();
  updateObject(SHEET.USUARIOS, u._row, u);
  const sess = criarSessao(u, payload.userAgent, requestId);
  audit({ id: u.ID, email: u.EMAIL, perfil: u.PERFIL }, 'LOGIN', 'USUARIO', u.ID, { email: u.EMAIL }, requestId);
  return { token: sess.token, expiraEm: sess.expiraEm, usuario: usuarioPublico(u) };
}

function logout(session, requestId) {
  revogarSessao(session, requestId);
  return { ok: true };
}

function setupAdmin(payload, requestId) {
  payload = payload || {};
  requireRequestId(requestId);
  const falhas = Number(cacheGet('setup_fail') || 0);
  if (falhas >= MAX_TENTATIVAS_SETUP) {
    fail('MUITAS_TENTATIVAS', 'Muitas tentativas de configuração. Aguarde 15 minutos.');
  }
  const nome = limparTexto(payload.nome, 120);
  const email = validarLogin(payload.email);
  const senha = validarSenha(payload.senha);
  const codigo = String(payload.codigo || '').trim().toUpperCase();
  assert(nome.length >= 2, 'NOME_INVALIDO', 'Informe o nome do administrador.');
  assert(codigo, 'CODIGO_OBRIGATORIO', 'Informe o código de configuração inicial.');

  return withLock(function () {
    const admins = contarAdmins();
    if (admins > 0) fail('SETUP_INDISPONIVEL', 'O sistema já possui administrador. A configuração inicial está encerrada.');
    const cfg = getConfigMap();
    const hash = String(cfg.SETUP_CODE_HASH || '').trim();
    const usado = String(cfg.SETUP_USADO_EM || '').trim();
    if (!hash || usado) fail('SETUP_INDISPONIVEL', 'A configuração inicial não está habilitada. Solicite um novo código.');
    if (!iguaisSeguro(codigoHash(codigo), hash)) {
      cachePut('setup_fail', String(falhas + 1), BLOQUEIO_LOGIN_SEGUNDOS);
      fail('CODIGO_INVALIDO', 'Código de configuração inválido.');
    }
    const usuarios = lerTodosUsuarios();
    for (let i = 0; i < usuarios.length; i++) {
      if (normalizarEmail(usuarios[i].EMAIL) === email) fail('EMAIL_EM_USO', 'Já existe uma conta com esse usuário/e-mail.');
    }
    const salt = Utilities.getUuid() + Utilities.getUuid();
    const agora = nowStamp();
    const u = {
      ID: newId('USR'),
      NOME: nome,
      EMAIL: email,
      SENHA_HASH: hashSenha(senha, salt),
      SENHA_SALT: salt,
      PERFIL: PERFIL.ADMIN,
      STATUS: 'ATIVO',
      CRIADO_EM: agora,
      ATUALIZADO_EM: agora,
      ULTIMO_ACESSO: agora,
      CRIADO_POR: 'SETUP_INICIAL',
      OBSERVACOES: 'Conta de administrador criada na configuração inicial.'
    };
    appendObject(SHEET.USUARIOS, u);
    configSetMany({
      SETUP_CODE_HASH: '',
      SETUP_USADO_EM: agora,
      CONFIGURADO_EM: agora,
      CONFIGURADO_POR: email
    });
    cacheRemove('setup_fail');
    const sess = criarSessao(u, payload.userAgent, requestId);
    audit({ id: u.ID, email: u.EMAIL, perfil: u.PERFIL }, 'SETUP_ADMIN', 'USUARIO', u.ID, { email: email }, requestId);
    // A sincronização inicial roda em segundo plano após o painel abrir.
    return { token: sess.token, expiraEm: sess.expiraEm, usuario: usuarioPublico(u), avisos: [], precisaSincronizacao: true };
  });
}

function recuperarAdmin(payload, requestId) {
  payload = payload || {};
  const falhas = Number(cacheGet('reset_fail') || 0);
  if (falhas >= MAX_TENTATIVAS_SETUP) {
    fail('MUITAS_TENTATIVAS', 'Muitas tentativas. Aguarde 15 minutos.');
  }
  const email = validarEmail(payload.email);
  const senha = validarSenha(payload.senha);
  const codigo = String(payload.codigo || '').trim().toUpperCase();
  assert(codigo, 'CODIGO_OBRIGATORIO', 'Informe o código de recuperação.');
  return withLock(function () {
    const cfg = getConfigMap();
    const hash = String(cfg.RESET_CODE_HASH || '').trim();
    const expira = String(cfg.RESET_EXPIRA_EM || '').trim();
    if (!hash || !expira || expira <= nowStamp()) {
      fail('RECUPERACAO_INDISPONIVEL', 'A recuperação de administrador não está habilitada ou expirou.');
    }
    if (!iguaisSeguro(codigoHash(codigo), hash)) {
      cachePut('reset_fail', String(falhas + 1), BLOQUEIO_LOGIN_SEGUNDOS);
      fail('CODIGO_INVALIDO', 'Código de recuperação inválido.');
    }
    const usuarios = lerTodosUsuarios();
    let u = null;
    for (let i = 0; i < usuarios.length; i++) {
      if (normalizarEmail(usuarios[i].EMAIL) === email) { u = usuarios[i]; break; }
    }
    if (!u || String(u.PERFIL) !== PERFIL.ADMIN || String(u.STATUS) !== 'ATIVO') {
      fail('ADMIN_NAO_ENCONTRADO', 'Não há administrador ativo com esse usuário/e-mail.');
    }
    const salt = Utilities.getUuid() + Utilities.getUuid();
    u.SENHA_HASH = hashSenha(senha, salt);
    u.SENHA_SALT = salt;
    u.ATUALIZADO_EM = nowStamp();
    updateObject(SHEET.USUARIOS, u._row, u);
    revogarSessoesUsuario(u.ID, null);
    configSetMany({ RESET_CODE_HASH: '', RESET_EXPIRA_EM: '' });
    cacheRemove('reset_fail');
    audit({ id: '', email: 'RECUPERACAO', perfil: PERFIL.ADMIN }, 'RECUPERAR_ADMIN', 'USUARIO', u.ID, { email: email }, requestId);
    return { ok: true, mensagem: 'Senha do administrador redefinida. Entre com a nova senha.' };
  });
}

function alterarMinhaSenha(payload, session, requestId) {
  exigirAutenticado(session);
  payload = payload || {};
  const atual = String(payload.senhaAtual || '');
  const nova = validarSenha(payload.novaSenha);
  return withLock(function () {
    const usuarios = lerTodosUsuarios();
    const u = exigirRegistro(porId(usuarios, session.id), 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.');
    if (!verificarSenha(atual, u.SENHA_SALT, u.SENHA_HASH)) fail('SENHA_ATUAL_INVALIDA', 'A senha atual está incorreta.');
    const salt = Utilities.getUuid() + Utilities.getUuid();
    u.SENHA_HASH = hashSenha(nova, salt);
    u.SENHA_SALT = salt;
    u.ATUALIZADO_EM = nowStamp();
    updateObject(SHEET.USUARIOS, u._row, u);
    revogarSessoesUsuario(u.ID, null);
    const sess = criarSessao(u, payload.userAgent, requestId);
    audit({ id: u.ID, email: u.EMAIL, perfil: u.PERFIL }, 'ALTERAR_SENHA', 'USUARIO', u.ID, null, requestId);
    return { token: sess.token, expiraEm: sess.expiraEm, usuario: usuarioPublico(u) };
  });
}

function listarUsuarios(session, payload) {
  exigirAdmin(session);
  const usuarios = lerTodosUsuarios().map(usuarioPublico);
  usuarios.sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
  return { usuarios: usuarios };
}

function criarUsuario(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  payload = payload || {};
  const nome = limparTexto(payload.nome, 120);
  const email = validarLogin(payload.email);
  const senha = validarSenha(payload.senha);
  const perfil = String(payload.perfil || PERFIL.COLAB).toUpperCase();
  assert(perfil === PERFIL.ADMIN || perfil === PERFIL.COLAB, 'PERFIL_INVALIDO', 'Perfil inválido.');
  assert(nome.length >= 2, 'NOME_INVALIDO', 'Informe o nome do usuário.');
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const usuarios = lerTodosUsuarios();
      for (let i = 0; i < usuarios.length; i++) {
        if (normalizarEmail(usuarios[i].EMAIL) === email) fail('EMAIL_EM_USO', 'Já existe uma conta com esse usuário/e-mail.');
      }
      const salt = Utilities.getUuid() + Utilities.getUuid();
      const agora = nowStamp();
      const u = {
        ID: newId('USR'),
        NOME: nome,
        EMAIL: email,
        SENHA_HASH: hashSenha(senha, salt),
        SENHA_SALT: salt,
        PERFIL: perfil,
        STATUS: 'ATIVO',
        CRIADO_EM: agora,
        ATUALIZADO_EM: agora,
        ULTIMO_ACESSO: '',
        CRIADO_POR: session.email,
        OBSERVACOES: limparTexto(payload.observacoes, 1000)
      };
      appendObject(SHEET.USUARIOS, u);
      audit(session, 'CRIAR_USUARIO', 'USUARIO', u.ID, { nome: nome, email: email, perfil: perfil }, requestId);
      return { usuario: usuarioPublico(u) };
    });
  });
}

function editarUsuario(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  payload = payload || {};
  const id = String(payload.id || '').trim();
  assert(id, 'USUARIO_OBRIGATORIO', 'Informe o usuário.');
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const usuarios = lerTodosUsuarios();
      const u = exigirRegistro(porId(usuarios, id), 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.');
      const nome = limparTexto(payload.nome === undefined ? u.NOME : payload.nome, 120);
      const email = validarLogin(payload.email === undefined ? u.EMAIL : payload.email);
      const perfil = String(payload.perfil === undefined ? u.PERFIL : payload.perfil).toUpperCase();
      assert(nome.length >= 2, 'NOME_INVALIDO', 'Informe o nome do usuário.');
      assert(perfil === PERFIL.ADMIN || perfil === PERFIL.COLAB, 'PERFIL_INVALIDO', 'Perfil inválido.');
      for (let i = 0; i < usuarios.length; i++) {
        if (usuarios[i].ID !== u.ID && normalizarEmail(usuarios[i].EMAIL) === email) fail('EMAIL_EM_USO', 'Já existe uma conta com esse usuário/e-mail.');
      }
      if (String(u.PERFIL) === PERFIL.ADMIN && perfil !== PERFIL.ADMIN) {
        assert(contarAdminsAtivos() > 1, 'ULTIMO_ADMIN', 'Não é possível remover o perfil do último administrador ativo.');
      }
      if (String(u.PERFIL) === PERFIL.ADMIN && String(u.STATUS) === 'ATIVO' && perfil !== PERFIL.ADMIN) {
        assert(contarAdminsAtivos() > 1, 'ULTIMO_ADMIN', 'Não é possível rebaixar o último administrador ativo.');
      }
      const perfilMudou = String(u.PERFIL) !== perfil;
      u.NOME = nome;
      u.EMAIL = email;
      u.PERFIL = perfil;
      u.OBSERVACOES = limparTexto(payload.observacoes === undefined ? u.OBSERVACOES : payload.observacoes, 1000);
      u.ATUALIZADO_EM = nowStamp();
      updateObject(SHEET.USUARIOS, u._row, u);
      if (perfilMudou) revogarSessoesUsuario(u.ID, null);
      audit(session, 'EDITAR_USUARIO', 'USUARIO', u.ID, { nome: nome, email: email, perfil: perfil }, requestId);
      return { usuario: usuarioPublico(u) };
    });
  });
}

function resetarSenhaUsuario(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  payload = payload || {};
  const id = String(payload.id || '').trim();
  const nova = validarSenha(payload.novaSenha);
  assert(id, 'USUARIO_OBRIGATORIO', 'Informe o usuário.');
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const usuarios = lerTodosUsuarios();
      const u = exigirRegistro(porId(usuarios, id), 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.');
      const salt = Utilities.getUuid() + Utilities.getUuid();
      u.SENHA_HASH = hashSenha(nova, salt);
      u.SENHA_SALT = salt;
      u.ATUALIZADO_EM = nowStamp();
      updateObject(SHEET.USUARIOS, u._row, u);
      revogarSessoesUsuario(u.ID, null);
      audit(session, 'RESETAR_SENHA', 'USUARIO', u.ID, { email: u.EMAIL }, requestId);
      return { ok: true };
    });
  });
}

function bloquearUsuario(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  const id = String((payload || {}).id || '').trim();
  assert(id, 'USUARIO_OBRIGATORIO', 'Informe o usuário.');
  assert(id !== session.id, 'ACAO_INVALIDA', 'Você não pode bloquear a própria conta.');
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const usuarios = lerTodosUsuarios();
      const u = exigirRegistro(porId(usuarios, id), 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.');
      if (String(u.PERFIL) === PERFIL.ADMIN && String(u.STATUS) === 'ATIVO') {
        assert(contarAdminsAtivos() > 1, 'ULTIMO_ADMIN', 'Não é possível bloquear o último administrador ativo.');
      }
      u.STATUS = 'BLOQUEADO';
      u.ATUALIZADO_EM = nowStamp();
      updateObject(SHEET.USUARIOS, u._row, u);
      revogarSessoesUsuario(u.ID, null);
      audit(session, 'BLOQUEAR_USUARIO', 'USUARIO', u.ID, { email: u.EMAIL }, requestId);
      return { usuario: usuarioPublico(u) };
    });
  });
}

function desbloquearUsuario(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  const id = String((payload || {}).id || '').trim();
  assert(id, 'USUARIO_OBRIGATORIO', 'Informe o usuário.');
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const usuarios = lerTodosUsuarios();
      const u = exigirRegistro(porId(usuarios, id), 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.');
      u.STATUS = 'ATIVO';
      u.ATUALIZADO_EM = nowStamp();
      updateObject(SHEET.USUARIOS, u._row, u);
      audit(session, 'DESBLOQUEAR_USUARIO', 'USUARIO', u.ID, { email: u.EMAIL }, requestId);
      return { usuario: usuarioPublico(u) };
    });
  });
}

function autoCadastro(payload, requestId) {
  payload = payload || {};
  const login = validarLogin(payload.usuario || payload.login || payload.email);
  const senha = validarSenha(payload.senha, SENHA_MIN_AUTO);
  const nome = limparTexto(payload.nome, 120) || login;
  const hora = Utilities.formatDate(new Date(), TZ, 'yyyyMMddHH');
  const rateKey = 'auto_reg_' + hora;
  const qtd = Number(cacheGet(rateKey) || 0);
  if (qtd >= AUTO_CADASTRO_POR_HORA) {
    fail('MUITOS_CADASTROS', 'Muitos cadastros nesta hora. Tente novamente mais tarde.');
  }
  return withLock(function () {
    const usuarios = lerTodosUsuarios();
    for (let i = 0; i < usuarios.length; i++) {
      if (normalizarEmail(usuarios[i].EMAIL) === login) {
        if (String(usuarios[i].STATUS) === 'PENDENTE') {
          fail('CADASTRO_PENDENTE', 'Já existe um cadastro com esse usuário aguardando aprovação do administrador.');
        }
        fail('LOGIN_EM_USO', 'Já existe uma conta com esse usuário/e-mail.');
      }
    }
    const salt = Utilities.getUuid() + Utilities.getUuid();
    const agora = nowStamp();
    const u = {
      ID: newId('USR'),
      NOME: nome,
      EMAIL: login,
      SENHA_HASH: hashSenha(senha, salt),
      SENHA_SALT: salt,
      PERFIL: PERFIL.COLAB,
      STATUS: 'PENDENTE',
      CRIADO_EM: agora,
      ATUALIZADO_EM: agora,
      ULTIMO_ACESSO: '',
      CRIADO_POR: 'AUTO_CADASTRO',
      OBSERVACOES: 'Cadastro enviado pelo próprio usuário. Aguardando aprovação do administrador. Não possui cadastro de colaborador automaticamente.'
    };
    appendObject(SHEET.USUARIOS, u);
    cachePut(rateKey, String(qtd + 1), 3600);
    audit(null, 'AUTO_CADASTRO', 'USUARIO', u.ID, { login: login }, requestId, 'APP');
    return {
      mensagem: 'Cadastro enviado. Aguarde a aprovação do administrador.',
      status: 'PENDENTE',
      login: login
    };
  });
}

function aprovarUsuario(payload, session, requestId) {
  exigirAdmin(session);
  requireRequestId(requestId);
  const id = String((payload || {}).id || '').trim();
  assert(id, 'USUARIO_OBRIGATORIO', 'Informe o usuário.');
  return withIdempotencia(requestId, function () {
    return withLock(function () {
      const usuarios = lerTodosUsuarios();
      const u = exigirRegistro(porId(usuarios, id), 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.');
      if (String(u.STATUS) === 'ATIVO') return { usuario: usuarioPublico(u) };
      if (String(u.STATUS) !== 'PENDENTE') {
        fail('USUARIO_BLOQUEADO', 'Este cadastro está bloqueado. Use Desbloquear para liberar o acesso.');
      }
      u.STATUS = 'ATIVO';
      u.ATUALIZADO_EM = nowStamp();
      u.OBSERVACOES = normalizarTexto((u.OBSERVACOES ? u.OBSERVACOES + ' | ' : '') + 'Aprovado por ' + session.email + ' em ' + nowStamp());
      updateObject(SHEET.USUARIOS, u._row, u);
      audit(session, 'APROVAR_USUARIO', 'USUARIO', u.ID, { login: u.EMAIL }, requestId);
      return { usuario: usuarioPublico(u) };
    });
  });
}

/**
 * Função de editor (não exposta na API).
 * Use no Apps Script: Executar > gerarCodigoSetup.
 * O código aparece no log de execução. Ele só funciona se ainda não existir administrador.
 */
function gerarCodigoSetup() {
  const admins = contarAdmins();
  if (admins > 0) throw new Error('Já existe administrador. Use gerarCodigoRecuperacao para redefinir a senha.');
  const codigo = 'CFG-' + Utilities.getUuid().replace(/-/g, '').slice(0, 4).toUpperCase() + '-' + Utilities.getUuid().replace(/-/g, '').slice(4, 8).toUpperCase();
  configSetMany({
    SETUP_CODE_HASH: codigoHash(codigo),
    SETUP_CRIADO_EM: nowStamp(),
    SETUP_USADO_EM: ''
  });
  Logger.log('CÓDIGO DE CONFIGURAÇÃO INICIAL: ' + codigo);
  Logger.log('Válido até a criação do primeiro administrador. Não compartilhe.');
  return codigo;
}

/**
 * Função de editor (não exposta na API).
 * Use no Apps Script: Executar > gerarCodigoRecuperacao.
 * Gera um código de 30 minutos para redefinir a senha de um administrador ativo.
 */
function gerarCodigoRecuperacao() {
  assert(contarAdminsAtivos() > 0, 'SEM_ADMIN', 'Não há administrador ativo para recuperar.');
  const codigo = 'REC-' + Utilities.getUuid().replace(/-/g, '').slice(0, 4).toUpperCase() + '-' + Utilities.getUuid().replace(/-/g, '').slice(4, 8).toUpperCase();
  const expira = Utilities.formatDate(new Date(Date.now() + 30 * 60 * 1000), TZ, 'yyyy-MM-dd HH:mm:ss');
  configSetMany({
    RESET_CODE_HASH: codigoHash(codigo),
    RESET_EXPIRA_EM: expira
  });
  Logger.log('CÓDIGO DE RECUPERAÇÃO DE ADMINISTRADOR: ' + codigo);
  Logger.log('Válido até: ' + expira + ' (horário ' + TZ + '). Não compartilhe.');
  return codigo;
}

/**
 * Função de manutenção (editor): remove sessões expiradas há mais de 30 dias.
 */
function limparSessoesAntigas() {
  const limite = Utilities.formatDate(new Date(Date.now() - 30 * 24 * 3600 * 1000), TZ, 'yyyy-MM-dd HH:mm:ss');
  const sessoes = readObjects(SHEET.SESSOES);
  let removidas = 0;
  sessoes.forEach(function (s) {
    if (String(s.EXPIRA_EM || '') < limite) {
      deleteObject(SHEET.SESSOES, s._row - removidas);
      removidas++;
    }
  });
  Logger.log('Sessões removidas: ' + removidas);
  return removidas;
}
