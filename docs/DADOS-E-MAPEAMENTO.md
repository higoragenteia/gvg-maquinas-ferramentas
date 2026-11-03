# Dados, conversão e mapeamento

## 1. Origem

Arquivo Excel localizado em `Downloads`:

- Nome: **CONTROLE  PARAFUSADEIRA.xlsx**
- Tamanho: 68.260 bytes
- Data de modificação observada: 02/11/2026
- Original preservado no computador e no Google Drive.

O arquivo foi convertido para Google Sheets. As 12 abas originais foram mantidas na planilha de produção e uma cópia de teste foi usada para a integração real.

## 2. Conferência da conversão

| Item | Resultado |
|---|---|
| Abas | 12 de 12 preservadas. |
| Células comparadas | 8.208 (12 abas × 57 linhas × 12 colunas). |
| Divergências de valores | 132, todas na linha 1 mesclada: o Excel repete o título em B1:L1 e o Google Sheets mantém o valor apenas em A1. **Nenhuma divergência nos dados.** |
| Fórmulas | Nenhuma fórmula na origem. |
| Datas | 22 células de data; valores preservados. |
| Mesclagens | `A1:L1` preservada em todas as abas. |
| Congelamento | Linha 3 congelada em todas as abas. |
| Cores | 18 amarelas, 30 verdes e 2 vermelhas na coluna B; contagem igual à origem. |
| Larguras | Aproximadas pelo Google Sheets; sem impacto nos dados. |
| Formato de data | A origem usava `mm-dd-yy`; as abas originais foram ajustadas para `dd/mm/yyyy` para leitura brasileira, **sem alterar os valores**. |
| Códigos | Colunas A, D, F e H foram formatadas como texto para preservar zeros à esquerda. |
| Aba `SERRA MARM 110MM` | A linha 1 da origem diz `POLICORTE` e A3 diz `Nº154971`; foi adotado o nome da aba. Registrado na observação da categoria. |
| Aba `APLICADOR E ALINHADOR DE  FITA` | O nome da aba tem dois espaços; preservado. |

> A conferência foi feita célula a célula entre o Excel e o Google Sheets. As diferenças encontradas foram apenas de mesclagem do título e de formato de exibição, não de conteúdo.

## 3. Linhas da origem

A planilha tem 612 linhas não vazias nas 12 abas:

- **50 equipamentos reais** importados;
- **12 linhas de resumo** de categoria (ex.: “OBS: TOTAL : 10 UNIDADES”), guardadas em `CATEGORIAS.OBSERVACAO_ORIGEM`;
- **550 linhas apenas numeradas**, sem item, colaborador, cor ou data, que não foram inventadas como equipamentos.

Das 50 importadas:

- 46 têm código/modelo na origem;
- 4 não têm código/modelo: `AAF-001`, `AAF-002`, `POL-002`, `SMA-001` — marcadas para revisão.

## 4. Contagens importadas

| Categoria | Equipamentos | Disponível | Entregue | Manutenção |
|---|---:|---:|---:|---:|
| PARAFUSADEIRA | 18 | 10 | 8 | 0 |
| APLICADOR DE SILICONE ELETRICO | 3 | 0 | 2 | 1 |
| MARTELETE | 10 | 8 | 1 | 1 |
| ESMERILHADEIRA | 2 | 0 | 2 | 0 |
| SERRA TICO TICO | 1 | 1 | 0 | 0 |
| FURADEIRA ELÉTRICA | 2 | 2 | 0 | 0 |
| SERRA CIRCULAR | 4 | 1 | 3 | 0 |
| SOPRADOR | 1 | 0 | 1 | 0 |
| REBITADEIRA | 4 | 3 | 2 (um empréstimo de 2 unidades) | 0 |
| APLICADOR E ALINHADOR DE  FITA | 2 | 2 | 0 | 0 |
| POLICORTE | 2 | 0 | 2 | 0 |
| SERRA MARM 110MM | 1 | 0 | 1 | 0 |
| **Total** | **50** | **27** | **21 registros / 22 unidades** | **2** |

- **18 colaboradores/grupos** cadastrados.
- **22 empréstimos** reconstruídos: 21 abertos e 1 encerrado.
- **25 movimentações** importadas: 22 entregas, 1 devolução e 2 saídas para manutenção.
- **2 manutenções abertas**: `APL-003` e `MAR-001`.

## 5. Mapeamento das colunas

| Origem | Destino no aplicativo |
|---|---|
| `Nº` | `ORIGEM_NUMERO` e sequência do código do equipamento. |
| `COLABORADOR` | Responsável atual, colaborador do empréstimo e regra de situação. |
| `ESTADO` | `ESTADO_CONSERVACAO` (NOVA→NOVO, USADA→USADO) e `ESTADO_ORIGEM` literal. |
| Cabeçalho D (ex.: `PARAFUSADEIRA`, `APLICADOR`, `MARTELETE`) | `CATEGORIAS.CAMPO_ITEM` e `CODIGO_MODELO`. |
| `QT` (coluna E) | `QUANTIDADE_TOTAL`. |
| `CARREGADOR` | `CARREGADOR_CODIGO` e acessório do empréstimo. |
| `QT` (coluna G) | `CARREGADOR_QTD`. |
| `BATERIA` | `BATERIA_CODIGO` (texto bruto; dois códigos separados por `/` são preservados). |
| `QT` (coluna I) | `BATERIA_QTD`. |
| `ENTREGA` | `DATA_ENTREGA`, data do empréstimo e data da movimentação de entrega. |
| `DEVOLUÇÃO` | Data de devolução/empréstimo encerrado; em manutenção, foi preservada como observação, sem assumir que era a data de envio. |
| `ASSINATURA` | `OBSERVACOES`. **Não** é tratada como assinatura digital e não é obrigatória. |

Cada categoria pode ter um rótulo de item diferente. O aplicativo não assume que um código igual em categorias diferentes seja o mesmo equipamento.

## 6. Regras de situação aplicadas

1. **Vermelho ou colaborador “MANUTENÇÃO”** → equipamento em manutenção, indisponível para entrega. Dois casos: `APL-003` e `MAR-001`.
2. **Colaborador + data de devolução** → devolvido/em estoque, com alerta. Caso `MAR-002` (PEDA).
3. **Colaborador preenchido** → entregue, mesmo que a marcação esteja verde. Casos `MAR-007`, `POL-001` e `POL-002`; marcados para revisão.
4. **Sem colaborador** → disponível. `MAR-010` tem datas de entrega/devolução sem colaborador; foi mantido disponível e marcado para revisão, sem criar um empréstimo fictício.
5. **Verde** → estoque quando não há colaborador. **Amarelo** → entregue, mas as cores foram usadas como confirmação, não como única fonte.
6. **Sem cor** → revisão. Nenhum equipamento real ficou sem cor; as 12 linhas “OBS” eram resumos e não equipamentos.

> A descrição original dizia “verde na numeração”; na planilha real as marcações verdes estavam na coluna **B (colaborador)**. Isso foi registrado e os casos divergentes foram marcados, sem inventar a informação.

## 7. Casos marcados para revisão (14)

| Código | Motivo |
|---|---|
| `PAR-015` | Colaborador preenchido sem data de entrega. |
| `APL-003` | Manutenção sem data de envio e sem defeito informado. |
| `MAR-001` | Manutenção sem data de envio confirmada. |
| `MAR-002` | Verde com colaborador e data de devolução; tratado como devolvido/estoque. |
| `MAR-007` | Verde com colaborador preenchido; tratado como entregue. |
| `MAR-010` | Datas de entrega/devolução sem colaborador; mantido disponível. |
| `STT-001` | `QT` original 0; tratado como 1 unidade individual. |
| `SCI-004` | Colaborador preenchido sem data de entrega. |
| `REB-001` | Colaborador sem data; quantidade 2. |
| `AAF-001` | Sem código/modelo e sem `QT`; 1 unidade individual. |
| `AAF-002` | Sem código/modelo e sem `QT`; 1 unidade individual. |
| `POL-001` | Verde com colaborador; tratado como entregue. |
| `POL-002` | Sem código/modelo, verde com colaborador; tratado como entregue. |
| `SMA-001` | Sem código/modelo e sem `QT`; 1 unidade individual. |

O aplicativo mostra o selo **revisar** e o motivo. O administrador pode conferir e usar **Marcar como revisado**.

## 8. Observações de importação por categoria

A origem declara totais maiores que as linhas preenchidas em 9 categorias. O aplicativo **não** cria unidades fictícias e mostra o aviso:

| Categoria | Declarado na origem | Importado |
|---|---:|---:|
| PARAFUSADEIRA | 62 | 18 |
| ESMERILHADEIRA | 10 | 2 |
| SERRA TICO TICO | 10 | 1 |
| FURADEIRA ELÉTRICA | 10 | 2 |
| SOPRADOR | 10 | 1 |
| REBITADEIRA | 10 | 4 |
| APLICADOR E ALINHADOR DE  FITA | 4 | 2 |
| POLICORTE | 8 | 2 |
| SERRA MARM 110MM | 8 | 1 |

As categorias `APLICADOR DE SILICONE ELETRICO` (3), `MARTELETE` (10) e `SERRA CIRCULAR` (4) bateram com o total declarado.

## 9. Identificadores

- **Código do equipamento:** `PREFIXO-NNN`, gerado a partir da aba e do `Nº` de origem. Ex.: `PAR-001`.
- **ID interno:** `EQP-PREFIXO-NNN`, estável e independente da linha.
- **Origem:** `ORIGEM_ABA`, `ORIGEM_LINHA` e `ORIGEM_NUMERO`.
- **Colaborador:** `COL-` + hash do nome normalizado.
- **Categoria:** `CAT-...`.
- **Empréstimo importado:** `EMP-IMP-...`.
- **Movimento importado:** `MOV-IMP-...`.
- **Manutenção importada:** `MAN-IMP-...`.
- **Novos registros:** UUID.

Os códigos de modelo/acessório são preservados como texto. As baterias com dois códigos, por exemplo `B1M1F96/B1M1F97`, ficam no campo bruto e também em uma lista de códigos. Não se assume que cada lado do `/` seja uma bateria separada; a quantidade vem da coluna `QT`.

## 10. Marcas e modelos

A marca só foi preenchida quando aparecia explicitamente no texto da origem:

- `MAKITA`, `BOSCH`, `DEWALT`, `BLACK TOOLS`.

Exemplos: `246555(MAKITA)`, `430006994(BOSCH)`, `291015-Z11 DEWALT`. O código bruto permanece em `CODIGO_MODELO`; a marca/modelo extraídos são um apoio de busca, não uma invenção. Quando a origem não informava marca, o campo ficou vazio.

## 11. O que não foi inventado

- Datas ausentes permaneceram ausentes.
- Responsáveis ausentes permaneceram ausentes.
- Não foram criadas unidades para completar os totais declarados.
- Não foram criados empréstimos para linhas sem colaborador.
- Não foi assumido que códigos iguais em categorias diferentes são o mesmo item.
- Não foi criada assinatura digital a partir do nome digitado.
- Não foram criados históricos fictícios; os movimentos importados estão marcados com `ORIGEM=IMPORTADO` e observação de reconstrução.

## 12. Backup

- Excel original: preservado no computador e no Drive.
- Cópia Google Sheets antes das abas do app: **BASE - BACKUP 2026-11-02 ANTES DAS ABAS DO APP**.
- Cópia de teste: usada para a integração real; não é a produção.
- Código e frontend: repositório Git e backup local.

A planilha de produção foi estruturada depois desses backups. Nenhum movimento fictício foi inserido nela.
