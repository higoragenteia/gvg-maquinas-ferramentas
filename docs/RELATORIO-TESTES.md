# Relatório de testes

Data dos testes: 02/11/2026  
Ambiente: navegador Chromium 1148 (headless), backend Apps Script real, Google Sheets de teste e planilha de produção estruturada.

## 1. Resumo

| Área | Resultado |
|---|---|
| Conversão da planilha | 12/12 abas preservadas; 8.208 células comparadas; 0 divergência de dados. |
| Backend (testes automatizados) | Todos os cenários planejados passaram. |
| Integração real Google | Setup, login, leitura, cadastro, entrega, recarga, devolução e logout passaram. |
| Interface desktop | Dashboard, equipamentos, ficha, entrega, movimentações, manutenções, colaboradores, categorias, usuários e auditoria. |
| Interface mobile (viewport) | Dashboard, menu, lista de equipamentos e ficha. |
| CORS | `POST` com `text/plain` e leitura da resposta JSON funcionando. |
| PWA | Manifesto, ícones, service worker e apple-touch-icon preparados. |
| Instalação em aparelho físico | **Pendente** (sem Android/iPhone disponíveis no ambiente). |
| Primeiro administrador de produção | **Pendente por decisão de segurança**; a planilha de produção está sem administrador e sem movimentos de teste. |

## 2. Conversão e importação

- 612 linhas não vazias analisadas.
- 50 equipamentos reais importados.
- 18 colaboradores/grupos.
- 12 categorias.
- 22 empréstimos reconstruídos (21 abertos, 1 encerrado).
- 25 movimentações.
- 2 manutenções abertas.
- 14 equipamentos marcados para revisão.
- 9 categorias com aviso de total declarado diferente do importado.

Detalhes em `DADOS-E-MAPEAMENTO.md`.

## 3. Testes automatizados do backend

Foi criado um ambiente de planilha em memória para executar o mesmo código do Apps Script sem tocar na planilha real. Todos os passos abaixo passaram:

- `setupStatus` antes/depois do setup.
- Criação protegida do primeiro administrador.
- Bloqueio de setup repetido.
- Login, logout e invalidação de token.
- Bootstrap com 50 equipamentos e estatísticas 27/22/2/21.
- Criação de colaborador e equipamento.
- Entrega de 1 unidade com acessórios.
- Segunda entrega e bloqueio de saldo insuficiente.
- Devolução parcial com bateria pendente.
- Devolução total e devolução apenas de acessório.
- Manutenção: abertura, bloqueio de entrega e conclusão.
- Transferência entre colaboradores e bloqueio de transferência repetida.
- Inativação com empréstimo (bloqueada), inativação sem empréstimo, reativação.
- Exclusão com histórico (bloqueada) e exclusão sem histórico.
- Permissões: colaborador não cria equipamento, não lista usuários e não lista auditoria.
- Redefinição de senha, bloqueio/desbloqueio de usuário.
- Proteção do último administrador.
- Recuperação de administrador com código de 30 minutos.
- Idempotência: duas chamadas com o mesmo `requestId` não duplicam o cadastro.
- CRUD de categoria e colaborador.
- Auditoria e listagem paginada.
- Marcação de equipamento como revisado.

## 4. Integração real com Google

Executada em uma **cópia de teste**, com o backend real apontando para essa cópia:

1. A tela de setup real apareceu.
2. Administrador de teste criado com o código da cópia.
3. Dashboard carregou os 50 equipamentos e as estatísticas 27 disponíveis / 22 entregues / 2 em manutenção / 21 devoluções.
4. Colaborador `TESTE REAL` criado pelo aplicativo.
5. Equipamento `REAL-001` criado pelo aplicativo com carregador e bateria.
6. Entrega registrada; ficha passou a **Entregue / 0 de 1**.
7. Página recarregada; a sessão continuou válida e o equipamento permaneceu **Entregue**, confirmando persistência.
8. Devolução registrada; ficha voltou para **Disponível / 1 de 1**.
9. Logout e novo login funcionaram.
10. Nenhum erro de console ou de página foi capturado.

A produção **não** recebeu esse equipamento, esse colaborador, esse administrador ou essas movimentações. A cópia de teste é separada.

## 5. Interface

Testes de navegador desktop (1440×1000):

- Tela de setup.
- Dashboard com cards, avisos, categorias, pendências, movimentações, manutenções e ações rápidas.
- Lista de equipamentos com busca, filtros, tabela, paginação e cartões móveis.
- Ficha do equipamento com abas Resumo, Histórico, Empréstimos e Manutenções.
- Modal de entrega com limites de quantidade e acessórios.
- Modal de devolução com devolução parcial.
- Modal de manutenção e conclusão.
- Movimentações com filtros e paginação no servidor.
- Manutenções com cartões e ações.
- Colaboradores, categorias e usuários.
- Botão **Ocultar lista / Mostrar lista** na área de usuários.
- Auditoria.
- Logout/login.

Testes de viewport móvel (iPhone 13 em emulação):

- Dashboard.
- Menu lateral.
- Lista de equipamentos em cartões.
- Ficha do equipamento.

Teste estendido de botões e formulários, em uma segunda execução do frontend contra o backend simulado:

- Criar categoria.
- Criar dois colaboradores.
- Criar equipamento com carregador e bateria.
- Entregar.
- Transferir para outro colaborador.
- Devolver.
- Enviar para manutenção.
- Editar manutenção para “Em andamento”.
- Concluir manutenção.
- Editar equipamento.
- Inativar e reativar equipamento.
- Criar e excluir equipamento sem histórico.
- Criar e excluir colaborador sem histórico.
- Criar e excluir categoria sem histórico.
- Criar usuário, editar nome, redefinir senha, bloquear e desbloquear.
- Ocultar a lista de usuários.
- Consultar a auditoria (25 registros após o teste).

Todos os passos produziram o toast de sucesso esperado e nenhum erro de console/página foi registrado.

## 6. Publicação no GitHub Pages

No endereço público `https://higoragenteia.github.io/gvg-maquinas-ferramentas/`:

- A tela de setup de produção apareceu corretamente.
- `config.js` carregou a URL real do Apps Script.
- `manifest.webmanifest` respondeu 200 com nome, escopo, `start_url` e ícones.
- Todos os ícones (192, 512, 512 maskable, 180 e favicon) responderam 200.
- O service worker registrou e ficou ativo no escopo do subdiretório.
- Nenhum erro de console ou de página no desktop e no viewport móvel.

O fluxo autenticado completo foi testado contra o mesmo backend a partir de uma origem local; a produção está sem administrador de propósito, então não foi criada uma sessão de produção.

## 7. CORS e comunicação

Teste real a partir de uma página em `http://127.0.0.1`:

- `POST` com `Content-Type: text/plain;charset=utf-8` → resposta JSON lida pelo navegador.
- `POST` com `Content-Type: application/json` → preflight bloqueado; **não é usado**.
- A interface publicada usa `fetch` com `text/plain`, sem cabeçalhos personalizados e com o token no corpo.

O Web App foi publicado com:

- `executeAs: USER_DEPLOYING`
- `access: ANYONE_ANONYMOUS`

Foi necessária uma autorização única do proprietário no Apps Script. Sem ela, o Google retorna “Acesso negado”/“Authorization needed”. Depois da autorização e da correção do manifesto, a leitura anônima funcionou.

## 8. Permissões

- O backend exige sessão em todas as ações de dados.
- O perfil `COLABORADOR` é bloqueado no servidor para ações de escrita.
- O frontend também oculta os botões, mas isso não é a única proteção.
- O último administrador ativo não pode ser rebaixado, bloqueado ou removido.
- Bloqueio de sessões ao redefinir senha, bloquear usuário ou mudar perfil.

O teste de escrita bloqueada para colaborador foi executado no ambiente automatizado do backend. Na produção não foi criada uma conta de teste para não inserir dados fictícios.

## 9. Bugs encontrados e corrigidos durante os testes

- Linha de append calculada pelo número de colunas em vez da última linha da planilha.
- Clique dentro do modal fechava o modal antes do envio do formulário.
- Botão de confirmação no rodapé do modal não era encontrado pelo manipulador de envio.
- Botão “Devolver” da ficha passava o ID do equipamento em vez do ID do empréstimo.
- Botão “Transferir” da ficha tinha o mesmo problema.
- Botão “Concluir” no dashboard não encontrava a manutenção fora da tela de manutenções.
- Chamada idempotente repetida era validada antes de consultar o cache de idempotência.
- Formulário de conclusão de manutenção iniciava o estado de retorno em “Novo” em vez de partir da conservação atual do equipamento.

Todos foram corrigidos e os testes finais passaram.

## 10. O que não foi testado

- Instalação e abertura reais em Android e iPhone físicos.
- Criação do administrador **de produção** (deliberadamente não feita; a produção está limpa).
- Escrita real na produção (para não inserir movimentações fictícias).
- Teste de colaborador real na produção (foi validado no ambiente automatizado).
- Envio de e-mail/SMS (não implementado).
- Atualização instantânea após edição direta na planilha (o aplicativo atualiza ao recarregar).
- Recuperação de senha por e-mail (não usada; a recuperação é por código no editor).
- Volume muito alto de registros (o projeto foi paginado, mas o volume atual é pequeno).

## 11. Ajustes de sincronização, cadastro e nova aba (03/11/2026)

Testes executados em cópia de teste com backend real e frontend de teste:

- Setup com sincronização em lote: concluído em **28,6 segundos** para 51 equipamentos; o frontend aguarda até 120 segundos.
- Aba original `MARTELETE` linha do PEDA: responsável atual removido, cor verde, data de devolução preservada.
- Aba original `PARAFUSADEIRA`: responsável/entrega/devolução atualizados a partir do empréstimo; nome histórico mantido em `EMPRESTIMOS`/`MOVIMENTACOES`.
- Entrega para `JOÃO DA OBRA`, nome que não existia: colaborador criado automaticamente, sem conta de usuário.
- Nome repetido com diferença de caixa/espaços: reaproveitou o colaborador existente, sem duplicar.
- Colaborador inativo: entrega bloqueada com `COLABORADOR_INATIVO`.
- Transferência para `OUTRO NOVO`: colaborador criado automaticamente e aba original atualizada.
- Nova categoria `BETONEIRA UI` / prefixo `BEU`: aba criada com cabeçalho `BETONEIRA`, 50 linhas numeradas e equipamento `BEU-001` sincronizado.
- Devolução completa: aba da nova categoria com responsável vazio, cor verde, `ENTREGA` e `DEVOLUÇÃO` corretas.
- Manutenção com celular `(11) 99999-0000`, edição para `(11) 98888-1111` e conclusão com `(11) 97777-2222`: gravado na coluna `CELULAR_RESPONSAVEL`.
- Auto cadastro de teste com senha simples `12345`: criado como `PENDENTE`; login bloqueado com “aguardando aprovação”; aprovado pelo administrador; login liberado; sem acesso de escrita.
- Botão **Sincronizar planilha**: relatório 51/51, 0 erros; abas originais confirmadas.
- Datas corrigidas para não deslocar um dia entre o fuso do Apps Script e o da planilha.
- Layout: ações rápidas no topo no desktop e no celular; instalação do app na tela de login; cadastro abaixo do login; lista de usuários com pendentes e botão de ocultar.

A produção já possui administrador criado pelo proprietário. A sincronização inicial das abas originais da produção é executada automaticamente na primeira abertura do administrador após esta atualização; não foi criada uma sessão de teste na produção.

## 12. Conclusão

O que foi implementado e testado está funcional no ambiente real de teste. A produção foi estruturada com os dados importados e está pronta para o primeiro administrador, sem dados de teste. As pendências reais são a criação do administrador de produção pelo proprietário e a confirmação de instalação nos aparelhos físicos Android/iPhone.
