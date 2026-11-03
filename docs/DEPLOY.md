# Implantação, configuração e manutenção

## 1. Endereços do projeto

| Item | Endereço |
|---|---|
| Aplicativo | https://higoragenteia.github.io/gvg-maquinas-ferramentas/ |
| Repositório | https://github.com/higoragenteia/gvg-maquinas-ferramentas |
| Backend (Web App) | `https://script.google.com/macros/s/AKfycbz7M0J9gMQ-T5gq5stchP2t7Y_mzXJAJAotDHg710AkocPKbnxICdIQ-gS0u1Pb_6Hldg/exec` |
| Editor do backend | https://script.google.com/d/1dHsd4cEfhvzdXJ8wvJ1zcrhs-jFIQnR3W38f5EScsxHiAqzL1pgMWZFf/edit |
| Planilha | privada, no Google Drive do proprietário (o ID não é publicado) |

A URL do Web App não é segredo. A autenticação é feita por e-mail e senha; o token de sessão vai no corpo da requisição, nunca na URL.

## 2. Estrutura da planilha

As 12 abas originais foram preservadas:

`PARAFUSADEIRA`, `APLICADOR DE SILICONE ELETRICO`, `MARTELETE`, `ESMERILHADEIRA`, `SERRA TICO TICO`, `FURADEIRA ELÉTRICA`, `SERRA CIRCULAR`, `SOPRADOR`, `REBITADEIRA`, `APLICADOR E ALINHADOR DE  FITA`, `POLICORTE`, `SERRA MARM 110MM`.

O aplicativo usa as abas auxiliares:

| Aba | Uso |
|---|---|
| `CATEGORIAS` | Categorias, prefixos e rótulos de item. |
| `COLABORADORES` | Pessoas, grupos e locais. Não são contas de acesso. |
| `EQUIPAMENTOS` | Cadastro atual, disponibilidade, conservação e acessórios. |
| `EMPRESTIMOS` | Empréstimos abertos/encerrados e acessórios pendentes. |
| `MOVIMENTACOES` | Histórico de entregas, devoluções, transferências e manutenção. |
| `MANUTENCOES` | Registros de manutenção. |
| `USUARIOS` | Contas de acesso e hashes de senha (aba oculta). |
| `SESSOES` | Sessões ativas (aba oculta). |
| `AUDITORIA` | Ações administrativas (aba oculta). |
| `CONFIG` | Configurações, hash do setup e da recuperação (aba oculta). |
| `LEIA-ME` | Instruções para o proprietário. |

> **Importante:** depois da importação, o aplicativo lê as abas do sistema, não as abas originais. Editar uma aba original não altera o aplicativo. Edite pelo aplicativo ou pelas abas do sistema e recarregue a tela.

## 3. Primeiro administrador (produção)

A planilha de produção foi entregue **sem administrador** e **sem movimentações de teste**.

1. Abra o aplicativo publicado.
2. A tela **Criar o administrador** aparece quando ainda não existe administrador.
3. Informe o **código de configuração inicial** entregue em arquivo privado (`GVG-MAQUINAS-SETUP.txt`).
4. Informe o nome, o e-mail do proprietário e uma senha com pelo menos 8 caracteres.
5. Confirme.

O código é de uso único. Depois da criação:

- o hash do código é apagado do `CONFIG`;
- a tela de setup deixa de aparecer;
- o arquivo privado pode ser apagado.

Se o código for perdido **antes** do primeiro administrador:

1. Abra o editor do Apps Script.
2. Selecione a função `gerarCodigoSetup`.
3. Execute.
4. O código aparece no log de execução.
5. Use-o na tela de setup.

## 4. Recuperação do administrador

Se o único administrador perder a senha:

1. Abra o editor do Apps Script.
2. Selecione a função `gerarCodigoRecuperacao`.
3. Execute.
4. Copie o código `REC-XXXX-XXXX` do log. Ele vale por **30 minutos**.
5. No aplicativo, clique em **Esqueci a senha do administrador**.
6. Informe o código, o e-mail do administrador e a nova senha.
7. Confirme.

A recuperação só funciona para um administrador ativo. O código é armazenado apenas como hash e expira.

## 5. Publicar o backend

O código completo está em `backend/src/`.

### 5.1 Criar/ligar o projeto

```bash
cd backend
clasp create-script --title "GVG Maquinas e Ferramentas - Backend" --type standalone --rootDir src
```

Se o projeto já existir, crie `.clasp.json` com:

```json
{
  "scriptId": "SEU_SCRIPT_ID",
  "rootDir": "src"
}
```

### 5.2 Configurar a planilha

Edite `backend/src/Config.gs`:

```js
const SPREADSHEET_ID = 'COLE_AQUI_O_ID_DA_PLANILHA_PRIVADA';
```

O ID é o trecho entre `/d/` e `/edit` na URL da planilha. A planilha continua privada; o script roda como o proprietário.

### 5.3 Manifesto

`backend/src/appsscript.json` deve conter:

```json
{
  "timeZone": "America/Recife",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets"
  ]
}
```

Sem o bloco `webapp`, o deployment não cria o ponto de entrada do Web App. Sem `oauthScopes`, o script pode pedir autorização de forma inconsistente.

### 5.4 Enviar e implantar

```bash
clasp push -f
clasp create-version "descrição da versão"
clasp create-deployment -V 1 -d "GVG Maquinas API"
```

Para atualizar uma implantação existente, mantenha o mesmo deployment ID:

```bash
clasp push -f
clasp create-version "descrição"
clasp update-deployment SEU_DEPLOYMENT_ID -V NUMERO_DA_VERSAO -d "descrição"
```

A URL `/exec` permanece a mesma quando a implantação é atualizada.

### 5.5 Autorizar uma vez

Na primeira publicação, o proprietário precisa autorizar o script:

1. Abra o editor do Apps Script com a conta correta.
2. Execute `testarEstrutura` (ou abra o link do Web App e clique em **Review Permissions**).
3. Revise a permissão de **Google Sheets**.
4. Se aparecer “app não verificado”, use **Avançado** → **Acessar ... (não seguro)**.
5. Permita.

Sem essa autorização, o Web App retorna “Acesso negado” ou “Authorization needed”. O script é do próprio proprietário; a permissão é somente para a planilha do projeto.

### 5.6 Testar

Execute no editor:

- `testarEstrutura()` — confere abas, cabeçalhos e contagens.
- `diagnosticoSetup()` — mostra se há administrador e se o setup está habilitado.
- `formatarAbasComoSistema()` — garante formato texto nas abas auxiliares.
- `limparSessoesAntigas()` — remove sessões expiradas há mais de 30 dias.

## 6. Publicar a interface no GitHub Pages

O frontend é estático, sem build.

1. `config.js` deve apontar para a URL `/exec` do Apps Script.
2. Envie os arquivos para o branch `main`.
3. No GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → main → / (root)**.
4. O arquivo `.nojekyll` já está incluído.
5. Aguarde a publicação e abra a URL.

### Atualizações

- Altere `sw.js` (versão do cache) quando mudar `app.js`/`styles.css` de forma relevante.
- O service worker guarda apenas a interface; respostas da API nunca são cacheadas.
- `config.js` é buscado primeiro na rede, para permitir trocar a URL do backend.

## 7. PWA (Android e iPhone)

Arquivos:

- `manifest.webmanifest`
- `sw.js`
- `icons/icone-192.png`
- `icons/icone-512.png`
- `icons/icone-512-maskable.png`
- `icons/icone-180.png` (apple-touch-icon)
- `icons/icone-32.png` e `icons/favicon.svg`

Instalação:

- **Android/Chrome:** menu ⋮ → **Instalar aplicativo** ou **Adicionar à tela inicial**.
- **iPhone/iPad/Safari:** **Compartilhar** → **Adicionar à Tela de Início** → **Adicionar**.

O `start_url` é `./index.html` e o `scope` é `./`, então funciona no subdiretório do GitHub Pages. O iPhone precisa usar o Safari para o comportamento de PWA.

**Teste real em aparelho:** a instalação e a abertura pelo ícone devem ser confirmadas em um Android e em um iPhone reais. O ambiente de desenvolvimento não tem esses aparelhos.

## 8. Importar novamente a planilha (uso controlado)

O importador está em `tools/importar_planilha.py`. Ele:

- lê as 12 abas originais e as cores reais;
- cria/atualiza as abas do sistema;
- preserva códigos como texto;
- marca casos ambíguos como `REVISAR`;
- cria empréstimos abertos/encerrados e manutenções a partir da origem;
- grava o hash do código de setup no `CONFIG`.

Antes de rodar em produção:

1. Faça uma cópia da planilha.
2. Rode primeiro com `--dry-run` e confira as contagens.
3. Só depois rode com `--mode prod --setup-code ...`.

Exemplo:

```bash
export GVG_TOKEN_FILE=/tmp/opencode/maquinas-token.txt
python3 tools/importar_planilha.py \
  --sheet-id ID_DA_PLANILHA \
  --mode prod \
  --setup-code 'CODIGO-DE-SETUP' \
  --reset
```

> `--reset` apaga as abas do sistema antes de recriar. Use somente em uma cópia ou na primeira importação. Em produção com dados, **não** use `--reset`.

O importador foi usado uma única vez na produção. O resultado está documentado em `DADOS-E-MAPEAMENTO.md`.

## 9. Segurança e configuração

- A planilha deve continuar privada. Não compartilhe com colaboradores para “dar acesso ao app”.
- O acesso é por e-mail/senha no aplicativo.
- O token de sessão fica no `localStorage`; o servidor guarda somente o hash.
- Sessão de 12 horas.
- 5 tentativas de login erradas → bloqueio de 15 minutos.
- 10 tentativas de setup erradas → bloqueio de 15 minutos.
- A senha é hash SHA-256 iterado 1.500 vezes com sal aleatório.
- O último administrador ativo não pode ser rebaixado/bloqueado.
- Todas as operações de escrita chamam `exigirAdmin` e validam o perfil no servidor.
- A API usa `LockService` e idempotência por `requestId` para reduzir duplicidade em reenvios.

### O que não fazer

- Não use `Content-Type: application/json` no frontend: o Apps Script não responde ao preflight CORS. Use `text/plain;charset=utf-8`.
- Não coloque token na URL.
- Não torne a planilha pública.
- Não coloque senhas, códigos de setup ou chaves no GitHub.
- Não use iframe da página do Apps Script.

## 10. Backup e restauração

Backups feitos:

- Excel original preservado no computador e no Google Drive.
- Cópia da planilha antes da estruturação: **BASE - BACKUP 2026-11-02 ANTES DAS ABAS DO APP**.
- Cópia de teste: usada para testes de integração, separada da produção.
- Código do backend e frontend neste repositório e em backup local.

Para restaurar:

1. Abra a cópia de backup.
2. Confira as abas e os dados.
3. Se necessário, copie a planilha novamente e rode o importador.
4. Atualize `SPREADSHEET_ID` no backend e republique uma nova versão.

Não exclua a planilha original nem o Excel de origem.

## 11. Manutenção periódica

- **Diária/semanal:** abra o app, confira pendências de devolução e manutenções abertas.
- **Mensal:** execute `limparSessoesAntigas()` no editor.
- **Mensal:** execute `testarEstrutura()` e confira se há avisos.
- **Antes de mudanças:** faça uma cópia da planilha e uma versão do Apps Script.
- **Ao trocar o backend:** mantenha o mesmo deployment ID para não quebrar a URL do app.

## 12. Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| “Acesso negado” ao abrir o Web App | Autorização inicial não feita ou conta errada | Execute `testarEstrutura` no editor com a conta proprietária e permita o acesso. |
| CORS / “Failed to fetch” | `Content-Type: application/json` ou backend não publicado | Use `text/plain;charset=utf-8` e confirme a URL `/exec`. |
| “Estrutura ausente” | Abas auxiliares não criadas | Rode o importador ou `testarEstrutura`. |
| “A planilha não foi encontrada” | `SPREADSHEET_ID` errado ou planilha sem acesso | Confira o ID e a conta que executa o script. |
| Setup não aparece | Já existe administrador ou hash de setup apagado | Use a recuperação ou gere novo código com `gerarCodigoSetup` (somente sem admin). |
| “Sessão expirada” | 12 horas de validade | Entre novamente. |
| App antigo no celular | Cache do service worker | Toque em **Recarregar** no aviso de nova versão ou limpe o cache do site. |
| iPhone não instala | Navegador diferente do Safari | Abra no Safari e use **Adicionar à Tela de Início**. |

## 13. Limites conhecidos

- O Apps Script tem cotas de execução e tempo; o volume atual é pequeno (50 equipamentos, 25 movimentações importadas), mas o projeto foi paginado para crescer.
- Não há e-mail automático.
- Não há assinatura digital.
- Não há atualização em tempo real.
- A planilha precisa continuar privada.
- O teste de instalação em aparelhos físicos é uma pendência do proprietário.
