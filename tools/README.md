# Importador da planilha

Script Python usado uma única vez para transformar as 12 abas originais nas abas do sistema.

## O que ele faz

- Lê as 12 abas originais e as cores reais das células.
- Cria/atualiza `CATEGORIAS`, `COLABORADORES`, `EQUIPAMENTOS`, `EMPRESTIMOS`, `MOVIMENTACOES`, `MANUTENCOES`, `USUARIOS`, `SESSOES`, `AUDITORIA`, `CONFIG` e `LEIA-ME`.
- Preserva códigos como texto, inclusive zeros à esquerda.
- Mantém os dois códigos de bateria separados por `/`.
- Reconstrói empréstimos abertos/encerrados e manutenções a partir da origem.
- Marca casos ambíguos como `REVISAR` e grava o motivo.
- Grava o hash do código de setup inicial no `CONFIG`.
- Ajusta a exibição das datas das abas originais para `dd/mm/yyyy` sem alterar os valores.
- Formata as colunas de código das abas originais como texto.

## Requisitos

- Python 3.
- Um token de acesso do Google com escopo de Sheets.
- O token pode vir de `GVG_TOKEN_FILE` ou ser renovado a partir do `~/.clasprc.json` do clasp (ou de `CLASPRC_PATH`).

## Uso

```bash
export GVG_TOKEN_FILE=/tmp/opencode/maquinas-token.txt
python3 tools/importar_planilha.py \
  --sheet-id ID_DA_PLANILHA \
  --mode prod \
  --setup-code 'CODIGO-DE-SETUP' \
  --reset
```

### Dry-run

```bash
python3 tools/importar_planilha.py --sheet-id ID_DA_PLANILHA --mode prod --dry-run
```

Gera um JSON em `GVG_DRY_RUN_OUT` (padrão `/tmp/opencode/maquinas-import-dry.json`) e imprime as contagens.

## Aviso

- `--reset` apaga as abas do sistema antes de recriar. Use apenas em cópia ou na primeira importação.
- Faça backup da planilha antes.
- A produção já foi importada; **não** rode `--reset` nela.
- O script não apaga as abas originais.

## Mapeamento

O mapeamento completo, as contagens e os 14 casos de revisão estão em [`../docs/DADOS-E-MAPEAMENTO.md`](../docs/DADOS-E-MAPEAMENTO.md).
