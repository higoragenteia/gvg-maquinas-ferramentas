# GVG & ARTEFAL — Controle de Máquinas e Ferramentas

Aplicativo web (PWA) para controlar máquinas, ferramentas, colaboradores, entregas, devoluções parciais, acessórios, transferências e manutenção.

**Aplicativo publicado:** https://higoragenteia.github.io/gvg-maquinas-ferramentas/  
**Repositório:** https://github.com/higoragenteia/gvg-maquinas-ferramentas  
**Backend:** Google Apps Script  
**Base de dados:** Google Sheets privada (o aplicativo não torna a planilha pública)

---

## O que está implementado

- Painel com disponibilidade, entregas, manutenção, pendências de devolução e acessórios.
- Cadastro de equipamentos por categoria, com código, modelo, marca, série, quantidade, conservação e acessórios.
- Entregas com validação de saldo, bloqueio de entrega duplicada e bloqueio de equipamento em manutenção.
- Devoluções totais e parciais, com controle de acessórios pendentes.
- Transferência de responsabilidade sem apagar o histórico.
- Sincronização das abas originais com responsável atual, datas, conservação, acessórios e cores.
- Entrega e transferência para nome digitado livremente, com criação automática do colaborador sem criar conta de acesso.
- Criação de nova categoria/aba diretamente pelo aplicativo.
- Auto cadastro na tela de login com aprovação do administrador.
- Celular da assistência no cadastro/edição de manutenção.
- Módulo de manutenção: envio, andamento, conclusão, cancelamento e custo.
- Cadastro de colaboradores separado das contas de acesso.
- Categorias com rótulo de item próprio.
- Perfis `ADMINISTRADOR` e `COLABORADOR` validados no servidor.
- Histórico de movimentações, empréstimos, manutenções e auditoria.
- Inativação/arquivamento para preservar histórico; exclusão definitiva só sem vínculos.
- PWA com manifesto, service worker, ícones Android/iPhone e instalação na tela inicial.
- Sessões com expiração, bloqueio por tentativas de login, hash de senha com sal e recuperação protegida do administrador.

## Acesso e primeiro administrador

A produção já possui administrador configurado pelo proprietário. O código de configuração inicial foi invalidado.

Para novos usuários, o administrador pode:

1. Criar a conta em **Usuários** → **Novo usuário**, ou
2. Permitir que a pessoa use **Cadastre-se** na tela de login. O cadastro fica **PENDENTE** até o administrador aprovar em **Usuários**.

O auto cadastro cria apenas uma conta de acesso com perfil de consulta. Ele não cria colaborador automaticamente e não concede permissão de administrador.

> Em uma instalação nova, o primeiro administrador é criado com o código de configuração privado. O código não fica no repositório e é invalidado após o uso.

## Perfis

| Perfil | Pode |
|---|---|
| **ADMINISTRADOR** | Cadastrar, editar, inativar, excluir sem histórico, entregar, devolver, transferir, manter, administrar usuários e consultar auditoria. |
| **COLABORADOR** | Visualizar, pesquisar e consultar. Não altera nada, nem por requisição manual: o servidor bloqueia. |

## Arquitetura

```text
GitHub Pages (HTML/CSS/JS/PWA)
        |
        | POST text/plain;charset=utf-8 (JSON)
        | token de sessão no corpo
        v
Google Apps Script (Web App)
        |
        | LockService + validação de perfil + idempotência
        v
Google Sheets privada
  abas originais preservadas
  + CATEGORIAS, COLABORADORES, EQUIPAMENTOS,
    EMPRESTIMOS, MOVIMENTACOES, MANUTENCOES,
    USUARIOS, SESSOES, AUDITORIA, CONFIG
```

- A interface **não** usa iframe nem a página do Apps Script.
- O Apps Script é chamado diretamente pelo GitHub Pages com `POST` e resposta JSON legível.
- `Content-Type: text/plain` evita o preflight CORS que o Apps Script não responde; `application/json` não funciona nesse endpoint.
- A planilha permanece privada. O script executa como o proprietário e valida a sessão do aplicativo.

## Sincronização com as abas originais

As abas do sistema continuam sendo a fonte de verdade. Depois de cada operação autorizada, o backend também atualiza a aba original da categoria:

- responsável atual (ou vazio quando devolvido);
- data da última entrega e da última devolução;
- conservação, código/modelo, quantidade e acessórios;
- observações;
- cor da coluna do colaborador: amarelo entregue, verde disponível, vermelho manutenção e cinza inativo.

O histórico completo permanece em `EMPRESTIMOS` e `MOVIMENTACOES`. Editar uma aba original manualmente pode ser sobrescrito pela próxima sincronização. Use **Sincronizar planilha** no painel ou a função `sincronizarPlanilhaEditor` no Apps Script para reparar.

## Estrutura do repositório

| Caminho | Conteúdo |
|---|---|
| `index.html`, `styles.css`, `app.js` | Interface SPA. |
| `config.js` | URL pública da implantação do Apps Script. |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA e ícones. |
| `backend/src/` | Código completo do Apps Script (com `SPREADSHEET_ID` para preencher). |
| `tools/importar_planilha.py` | Importador único da planilha original para as abas do sistema. |
| `docs/` | Manual, implantação, mapeamento de dados e relatório de testes. |

## Segurança

- Senhas armazenadas apenas como hash SHA-256 iterado com sal (1.500 iterações). Nunca em texto puro.
- Token de sessão aleatório; somente o hash do token é gravado na planilha. A sessão dura 10 anos e só é encerrada ao clicar em **Sair**, ao bloquear o usuário ou ao trocar o perfil. O F5 mantém a sessão.
- Bloqueio após 5 tentativas de login por 15 minutos.
- Código de setup e código de recuperação armazenados apenas como hash no `CONFIG`; o código em si não fica na planilha.
- Permissões conferidas no servidor em **todas** as operações.
- Nenhum segredo no GitHub, na URL ou no código da interface.
- A planilha não é pública.
- A interface escapa os dados exibidos; a sessão fica no `localStorage` do navegador.

## Limitações reais

- O Apps Script não é um servidor dedicado: há cotas e latência do Google.
- Não há atualização em tempo real. O aplicativo lê os dados ao abrir/atualizar; edições feitas diretamente nas abas do sistema aparecem ao recarregar. As abas originais são espelhos e podem ser sobrescritas pela sincronização.
- Não há envio de e-mail ou SMS. A recuperação do administrador é feita por código gerado no editor do Apps Script.
- A assinatura antiga da planilha não é tratada como assinatura digital; o conteúdo foi preservado como observação.
- Testes em Android/iPhone físicos dependem dos aparelhos do proprietário. O PWA foi preparado e testado em viewport móvel, mas a instalação real deve ser confirmada no aparelho.

## Documentação

- [Manual de uso](docs/MANUAL.md)
- [Implantação, primeira configuração e manutenção](docs/DEPLOY.md)
- [Mapeamento dos dados e decisões de importação](docs/DADOS-E-MAPEAMENTO.md)
- [Relatório de testes](docs/RELATORIO-TESTES.md)

## Situação

- Interface publicada no GitHub Pages.
- Backend publicado e integrado por CORS.
- Planilha de produção estruturada e com administrador configurado.
- Sincronização das abas originais implementada e testada em cópia.
- Testes de integração real feitos em uma cópia de teste, não na produção.
- O primeiro carregamento do administrador após a atualização executa a sincronização inicial das abas originais em segundo plano, sem bloquear a abertura do painel. O botão **Sincronizar planilha** continua disponível.
- Instalação em aparelhos Android/iPhone físicos ainda depende de teste do proprietário.
