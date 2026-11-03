# Manual de uso — Controle de Máquinas e Ferramentas

## 1. Entrar

1. Abra o endereço publicado.
2. Informe usuário/e-mail e senha.
3. Na tela de login também existe **Cadastre-se**. A pessoa informa usuário e senha; o cadastro fica **PENDENTE** até a aprovação do administrador.
4. O administrador aprova ou recusa em **Usuários**. A senha do auto cadastro pode ser simples, inclusive `12345`; contas administrativas devem usar senha forte.

O perfil **COLABORADOR** só consulta. Ele não vê os botões de alteração porque eles são ocultados, mas o bloqueio real é feito no servidor.

## 2. Visão geral

| Indicador | Significado |
|---|---|
| **Disponíveis** | Soma das quantidades disponíveis para entrega. |
| **Entregues** | Soma das quantidades em empréstimos abertos. |
| **Em manutenção** | Soma das quantidades de equipamentos em manutenção. |
| **Devoluções** | Empréstimos abertos; a legenda mostra os acessórios pendentes. |

A faixa de avisos mostra divergências da importação e equipamentos marcados para revisão. Clique em **Conferir agora** para ler os motivos.

A distribuição por categoria usa três cores: verde = disponível, amarelo = entregue, vermelho = manutenção.

## 3. Equipamentos

- **Buscar** por código, nome, marca, modelo, número de série, colaborador ou observação.
- **Filtrar** por categoria, situação, conservação e “somente para revisar”.
- **Abrir ficha** para ver dados, acessórios, pendências, histórico, empréstimos e manutenções.
- **Entregar** aparece quando há quantidade disponível e o item não está em manutenção.
- **Devolver** aparece quando há empréstimo aberto ou acessório pendente.
- **Inativar** esconde o item das operações sem apagar o histórico. Só é permitido sem empréstimo/manutenção aberta.
- **Excluir** só é permitido quando não existe nenhum empréstimo, manutenção ou movimentação. Caso contrário, use **Inativar**.
- **Sincronizar planilha** (no topo do painel) atualiza as abas originais com o estado atual: responsável, datas, conservação, acessórios e cor.

### Códigos e quantidades

- O código do equipamento é único. O código do modelo/acessório é preservado como texto, inclusive zeros à esquerda.
- Dois códigos de bateria separados por `/` são mantidos juntos e também separados para consulta. Não se assume que um código igual em outra categoria seja o mesmo item.
- **Conservação** e **disponibilidade** são campos separados. Um item disponível não é automaticamente novo.

## 4. Entregar

1. Abra **Equipamentos** e clique em **Entregar** (ou use **Nova entrega** no painel).
2. Escolha o equipamento, digite o responsável e a data. O nome pode ser novo; se não existir, será cadastrado automaticamente como colaborador, sem criar acesso ao sistema.
3. Informe a quantidade disponível e a conservação.
4. Selecione os acessórios que serão entregues. O sistema limita pela quantidade que não está pendente com outro colaborador.
5. Confirme.

O sistema bloqueia:

- entrega duplicada acima do saldo;
- equipamento em manutenção;
- equipamento inativo;
- acessório que já está pendente com outro colaborador;
- colaborador inativo.

## 5. Devolver (inclusive parcial)

1. Na ficha do equipamento, clique em **Devolver**; ou use a pendência no painel.
2. Escolha o empréstimo.
3. Informe a data, a quantidade devolvida e a conservação.
4. Informe os acessórios devolvidos. Deixe `0` no que ficou pendente.
5. Confirme.

Se a ferramenta voltar mas o carregador/bateria ficar com o colaborador:

- a ferramenta volta a ficar disponível;
- o empréstimo continua aberto somente pela pendência do acessório;
- o painel mostra **acessórios pendentes**;
- quando o acessório for devolvido, o empréstimo é encerrado.

## 6. Transferir responsável

1. Na ficha do equipamento, clique em **Transferir**.
2. Escolha o empréstimo aberto, digite o novo responsável e a data. O nome pode ser novo; ele será cadastrado automaticamente, sem criar acesso ao sistema.
3. Confirme.

O sistema encerra a responsabilidade anterior como **Transferido**, cria uma nova responsabilidade e registra uma movimentação de **Transferência**. O histórico anterior não é apagado.

> A transferência é do empréstimo inteiro. Para dividir quantidades, registre devolução parcial e uma nova entrega.

## 7. Manutenção

### Enviar

1. Abra **Manutenções** → **Nova manutenção**.
2. Escolha um equipamento **totalmente disponível**, sem empréstimo ou acessório pendente.
3. Informe data de envio, defeito/motivo, responsável/assistência, **celular da assistência** (opcional), previsão e custo.
4. Confirme.

Enquanto a manutenção estiver aberta, o equipamento fica **indisponível para entrega**.

### Atualizar

Use **Editar** para mudar situação (Aberta/Em andamento), responsável, celular da assistência, serviço, previsão, custo e observações.

### Concluir

Use **Concluir**, informe a data de retorno, o serviço, o custo final e o estado de conservação. O equipamento volta a ficar disponível e o retorno é registrado no histórico.

### Cancelar

Use **Cancelar** com motivo e data. O equipamento é liberado e o registro fica como cancelado.

## 8. Colaboradores

- Cadastre pessoa, grupo ou local, com tipo, função, contato, local/obra, setor e observações.
- O cadastro de colaborador **não cria conta de acesso**.
- Ao inativar, o colaborador deixa de aparecer em novas entregas. Só é permitido sem pendências.
- **Excluir** só é permitido sem histórico; caso contrário, use **Inativar**.
- **Ver equipamentos** filtra a lista pelo nome do colaborador.

## 9. Categorias

- Cada categoria tem nome, prefixo, ordem e rótulo do item.
- **Nova categoria/aba** cria uma nova aba na planilha com o layout das abas originais e já deixa a categoria disponível em **Novo equipamento**.
- O prefixo é usado na geração automática de códigos (ex.: `PAR-001`).
- Não é possível trocar o prefixo de uma categoria que já possui equipamentos.
- Categoria com equipamentos não pode ser excluída; use **Inativar**.

## 10. Usuários e permissões

Somente o administrador vê esta área.

- **Novo usuário**: nome, usuário/e-mail, perfil e senha inicial.
- **Aprovar**: libera o acesso de um cadastro feito pela tela de login. O cadastro fica pendente até essa ação.
- **Recusar**: bloqueia o cadastro pendente. Use **Desbloquear** depois, se necessário.
- **Editar**: nome, e-mail e perfil. Alterar o perfil encerra as sessões abertas.
- **Redefinir senha**: define uma nova senha e encerra as sessões antigas.
- **Bloquear/Desbloquear**: bloqueia o login.
- **Ocultar lista**: esconde os cartões para não ocupar a tela quando há muitos usuários. O botão **Mostrar lista** reabre.
- O último administrador ativo não pode ser rebaixado, bloqueado ou removido.
- Você não pode bloquear a própria conta.

### Minha conta

No rodapé do menu, clique nos três pontos → **Alterar minha senha**. A sessão é renovada.

## 11. Auditoria

Mostra data, usuário, perfil, ação, entidade, detalhes e origem. É exclusiva do administrador. As movimentações operacionais ficam em **Movimentações**; a auditoria registra também ações de cadastro e permissões.

## 12. Instalar no celular

### Android

1. Abra o endereço no **Chrome**.
2. Menu ⋮ → **Instalar aplicativo** ou **Adicionar à tela inicial**.
3. Confirme.

### iPhone / iPad

1. Abra o endereço no **Safari**.
2. Toque em **Compartilhar** (quadrado com seta).
3. **Adicionar à Tela de Início** → **Adicionar**.

No iPhone, use o Safari; outros navegadores podem não instalar o PWA da mesma forma. O ícone abre o endereço do GitHub Pages.

## 13. Atualização dos dados

- O aplicativo lê os dados ao abrir e ao tocar em **Atualizar**.
- Alterações feitas diretamente nas abas do sistema aparecem ao recarregar.
- As abas originais são espelhadas pelo aplicativo. Se você editá-las manualmente, a próxima sincronização pode sobrescrever o estado atual.
- Use **Sincronizar planilha** para conferir e reparar as abas originais.
- Não há promessa de atualização instantânea.
- Se o aplicativo avisar **“Nova versão disponível”**, toque em **Recarregar**.

## 14. Erros comuns

| Mensagem | O que fazer |
|---|---|
| **Saldo insuficiente** | Atualize a tela; outra pessoa pode ter entregado. Verifique a quantidade disponível. |
| **Equipamento em manutenção** | Conclua ou cancele a manutenção antes de entregar. |
| **Equipamento em uso** | Registre a devolução (inclusive acessórios pendentes) antes de inativar ou enviar para manutenção. |
| **Equipamento com histórico** | Use **Inativar**; a exclusão definitiva preserva o histórico. |
| **Último administrador ativo** | Crie/promova outro administrador antes de rebaixar ou bloquear este. |
| **Sessão expirada** | Entre novamente. A sessão dura 12 horas. |
| **Muitas tentativas** | Aguarde 15 minutos. |
| **Acesso negado / Authorization needed** | A autorização inicial do Apps Script precisa ser feita pelo proprietário. Veja `DEPLOY.md`. |

## 15. O que não é feito pelo sistema

- Não envia e-mail/SMS automaticamente.
- Não trata nome digitado como assinatura digital.
- Não inventa datas, responsáveis, quantidades ou históricos que não existiam na planilha.
- Não apaga automaticamente o histórico de quem já teve movimentação.
