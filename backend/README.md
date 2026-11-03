# Backend — Google Apps Script

Código do servidor que lê e grava na planilha privada e expõe a API para o GitHub Pages.

## Arquivos

| Arquivo | Função |
|---|---|
| `Config.gs` | Constantes, nomes das abas, cabeçalhos, perfis e status. **Preencha `SPREADSHEET_ID`.** |
| `Planilha.gs` | Leitura/escrita, locks, cache, idempotência, auditoria, hash e utilitários. |
| `Auth.gs` | Senhas, sessões, setup do administrador, recuperação e CRUD de usuários. |
| `Dominio.gs` | Equipamentos, colaboradores, categorias, empréstimos, devoluções, transferências e manutenção. |
| `Sincronizacao.gs` | Espelhamento das abas originais, criação de novas abas de categoria e sincronização em lote. |
| `Code.gs` | Roteador `doGet`/`doPost`, permissões e respostas JSON. |
| `Diagnostico.gs` | Funções de diagnóstico e manutenção no editor. |
| `appsscript.json` | Manifesto com Web App e escopo de planilha. |

## Implantação resumida

1. Crie um projeto standalone no Apps Script.
2. Substitua `COLE_AQUI_O_ID_DA_PLANILHA_PRIVADA` em `Config.gs`.
3. Envie com `clasp push -f`.
4. Crie uma versão e uma implantação Web App:
   - executar como: **proprietário que implantou**;
   - acesso: **qualquer pessoa, mesmo anônima**.
5. Autorize o script uma vez com a conta proprietária.
6. Copie a URL `/exec` para o `config.js` do frontend.

O passo a passo completo, incluindo autorização, primeiro administrador, recuperação e solução de problemas, está em [`../docs/DEPLOY.md`](../docs/DEPLOY.md).

## Funções de editor

Execute no editor do Apps Script (não são rotas públicas):

- `testarEstrutura()` — confere abas, cabeçalhos e contagens.
- `diagnosticoSetup()` — mostra se há administrador e se o setup está habilitado.
- `gerarCodigoSetup()` — gera um código inicial quando ainda não há administrador.
- `gerarCodigoRecuperacao()` — gera um código de 30 minutos para redefinir a senha de um administrador ativo.
- `formatarAbasComoSistema()` — aplica formato texto nas abas do sistema.
- `sincronizarPlanilhaEditor()` — sincroniza as abas originais sem abrir o app.
- `limparSessoesAntigas()` — remove sessões expiradas há mais de 30 dias.

## Segurança

- Nenhuma senha em texto puro.
- Hash SHA-256 iterado 1.500 vezes com sal aleatório.
- Sessões de 10 anos; somente o hash do token é gravado. O F5 mantém a sessão; ela só termina no logout, bloqueio ou troca de perfil.
- Permissões conferidas no servidor.
- Setup e recuperação com códigos de uso único/curta duração, guardados como hash.
- `LockService` nas escritas e idempotência por `requestId`.
- Auto cadastro público cria conta `PENDENTE`, perfil de consulta, sem sessão; o administrador aprova.
- Entrega/transferência aceitam nome livre e criam colaborador automaticamente, sem conta de acesso.
- Sincronização das abas originais e criação de nova aba/categoria.
- `COLABORADORES.SETOR` e `MANUTENCOES.CELULAR_RESPONSAVEL` são campos de texto; registros antigos ficam vazios.
- Planilha privada.

## CORS

O frontend deve chamar a API com:

```js
fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({ action, token, requestId, payload })
});
```

Não use `application/json`: o Apps Script não responde ao preflight. Não coloque o token na URL.

## Observação sobre o manifesto

O bloco `webapp` é obrigatório para o deployment ter um ponto de entrada Web App. Sem ele, a URL `/exec` retorna 404. O bloco `oauthScopes` com `spreadsheets` deve estar presente.
