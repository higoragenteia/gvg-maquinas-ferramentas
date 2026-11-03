#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GVG & ARTEFAL - Controle de Maquinas e Ferramentas
Importa a planilha original convertida para as abas auxiliares do aplicativo.

Uso:
  python3 importar.py --sheet-id ID --mode test --setup-code CODIGO
  python3 importar.py --sheet-id ID --mode prod --setup-code CODIGO
  python3 importar.py --sheet-id ID --mode test --dry-run
"""
import argparse, json, re, hashlib, datetime, urllib.request, urllib.parse, os, sys, time

TOKEN_FILE = os.environ.get('GVG_TOKEN_FILE', '/tmp/opencode/maquinas-token.txt')
BASE_DATE = datetime.date(1899, 12, 30)
NOW = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

CATS = [
    # id, prefixo, nome, aba, campo_item
    ('CAT-PAR', 'PAR', 'PARAFUSADEIRA', 'PARAFUSADEIRA', 'PARAFUSADEIRA'),
    ('CAT-APL', 'APL', 'APLICADOR DE SILICONE ELETRICO', 'APLICADOR DE SILICONE ELETRICO', 'APLICADOR'),
    ('CAT-MAR', 'MAR', 'MARTELETE', 'MARTELETE', 'MARTELETE'),
    ('CAT-ESM', 'ESM', 'ESMERILHADEIRA', 'ESMERILHADEIRA', 'ESMERILHADEIRA'),
    ('CAT-STT', 'STT', 'SERRA TICO TICO', 'SERRA TICO TICO', 'SERRA TICO TICO'),
    ('CAT-FUR', 'FUR', 'FURADEIRA ELÉTRICA', 'FURADEIRA ELÉTRICA', 'FURADEIRA ELÉTRICA'),
    ('CAT-SCI', 'SCI', 'SERRA CIRCULAR', 'SERRA CIRCULAR', 'SERRA CIRCULAR'),
    ('CAT-SOP', 'SOP', 'SOPRADOR', 'SOPRADOR', 'SOPRADOR'),
    ('CAT-REB', 'REB', 'REBITADEIRA', 'REBITADEIRA', 'REBITADEIRA'),
    ('CAT-AAF', 'AAF', 'APLICADOR E ALINHADOR DE  FITA', 'APLICADOR E ALINHADOR DE  FITA', 'APLICADOR'),
    ('CAT-POL', 'POL', 'POLICORTE', 'POLICORTE', 'POLICORTE'),
    ('CAT-SMA', 'SMA', 'SERRA MARM 110MM', 'SERRA MARM 110MM', 'SERRA MARM 110MM'),
]

HEADERS = {
    'CATEGORIAS': ['ID','NOME','NOME_ABA','CAMPO_ITEM','PREFIXO','ORDEM','ATIVO','OBSERVACAO_ORIGEM','OBSERVACAO_IMPORTACAO','CRIADO_EM','ATUALIZADO_EM'],
    'COLABORADORES': ['ID','NOME','TIPO','FUNCAO','TELEFONE','EMAIL','LOCAL_OBRA','ATIVO','OBSERVACOES','ORIGEM','CRIADO_EM','ATUALIZADO_EM'],
    'EQUIPAMENTOS': ['ID','CODIGO','CATEGORIA_ID','CATEGORIA_NOME','CODIGO_MODELO','DESCRICAO','MARCA','MODELO','NUMERO_SERIE','QUANTIDADE_TOTAL','QUANTIDADE_DISPONIVEL','ESTADO_CONSERVACAO','ESTADO_ORIGEM','STATUS','COLABORADOR_ATUAL_ID','COLABORADOR_ATUAL_NOME','CARREGADOR_CODIGO','CARREGADOR_QTD','BATERIA_CODIGO','BATERIA_QTD','DATA_ENTREGA_ATUAL','ACESSORIOS_PENDENTES','OBSERVACOES','ORIGEM_ABA','ORIGEM_LINHA','ORIGEM_NUMERO','REVISAR','MOTIVO_REVISAO','CRIADO_EM','ATUALIZADO_EM','CRIADO_POR','ATUALIZADO_POR'],
    'EMPRESTIMOS': ['ID','EQUIPAMENTO_ID','EQUIPAMENTO_CODIGO','EQUIPAMENTO_NOME','COLABORADOR_ID','COLABORADOR_NOME','DATA_ENTREGA','QUANTIDADE','ESTADO_ENTREGA','ACESSORIOS_ENTREGUES','ACESSORIOS_PENDENTES','EQUIPAMENTO_DEVOLVIDO','DATA_DEVOLUCAO_EQUIPAMENTO','STATUS','MOVIMENTO_ENTREGA_ID','MOVIMENTO_ENCERRAMENTO_ID','OBSERVACOES','ORIGEM','CRIADO_EM','ATUALIZADO_EM','USUARIO'],
    'MOVIMENTACOES': ['ID','DATA','TIPO','EQUIPAMENTO_ID','EQUIPAMENTO_CODIGO','CATEGORIA_NOME','QUANTIDADE','COLABORADOR_ORIGEM_ID','COLABORADOR_ORIGEM_NOME','COLABORADOR_DESTINO_ID','COLABORADOR_DESTINO_NOME','ESTADO_CONSERVACAO','ACESSORIOS_ENTREGUES','ACESSORIOS_DEVOLVIDOS','ACESSORIOS_PENDENTES','OBSERVACOES','EMPRESTIMO_ID','MANUTENCAO_ID','USUARIO_ID','USUARIO_EMAIL','ORIGEM','REQUEST_ID','CRIADO_EM'],
    'MANUTENCOES': ['ID','EQUIPAMENTO_ID','EQUIPAMENTO_CODIGO','CATEGORIA_NOME','DATA_ENVIO','DEFEITO','RESPONSAVEL','STATUS','SERVICO','CUSTO','PREVISAO_RETORNO','DATA_RETORNO','ESTADO_RETORNO','OBSERVACOES','ORIGEM','USUARIO','CRIADO_EM','ATUALIZADO_EM','REVISAR','MOTIVO_REVISAO'],
    'USUARIOS': ['ID','NOME','EMAIL','SENHA_HASH','SENHA_SALT','PERFIL','STATUS','CRIADO_EM','ATUALIZADO_EM','ULTIMO_ACESSO','CRIADO_POR','OBSERVACOES'],
    'SESSOES': ['TOKEN_HASH','USUARIO_ID','CRIADO_EM','EXPIRA_EM','REVOGADO_EM','USER_AGENT','ULTIMO_USO','REQUEST_ID'],
    'AUDITORIA': ['ID','DATA','USUARIO_ID','USUARIO_EMAIL','PERFIL','ACAO','ENTIDADE','ENTIDADE_ID','DETALHES','ORIGEM','REQUEST_ID'],
    'CONFIG': ['CHAVE','VALOR','ATUALIZADO_EM'],
}

SHEET_COLORS = {
    'LEIA-ME': '#C8A24A',
    'CATEGORIAS': '#1F5FA8',
    'COLABORADORES': '#1F5FA8',
    'EQUIPAMENTOS': '#0B1F3A',
    'EMPRESTIMOS': '#1F5FA8',
    'MOVIMENTACOES': '#1F5FA8',
    'MANUTENCOES': '#8A3B12',
    'USUARIOS': '#4A4A4A',
    'SESSOES': '#4A4A4A',
    'AUDITORIA': '#4A4A4A',
    'CONFIG': '#4A4A4A',
}

HIDDEN = {'USUARIOS', 'SESSOES', 'AUDITORIA', 'CONFIG'}


def get_token():
    tok = open(TOKEN_FILE).read().strip()
    # valida token; se expirado, renova via clasp credentials
    try:
        req = urllib.request.Request('https://sheets.googleapis.com/v4/spreadsheets', headers={'Authorization': 'Bearer ' + tok})
        urllib.request.urlopen(req, timeout=20)
        return tok
    except Exception:
        clasprc = os.environ.get('CLASPRC_PATH', os.path.expanduser('~/.clasprc.json'))
        c = json.load(open(clasprc))['tokens']['default']
        data = urllib.parse.urlencode({'client_id': c['client_id'], 'client_secret': c['client_secret'], 'refresh_token': c['refresh_token'], 'grant_type': 'refresh_token'}).encode()
        tok = json.load(urllib.request.urlopen(urllib.request.Request('https://oauth2.googleapis.com/token', data=data), timeout=30))['access_token']
        open(TOKEN_FILE, 'w').write(tok)
        os.chmod(TOKEN_FILE, 0o600)
        return tok


class API:
    def __init__(self, sheet_id):
        self.tok = get_token()
        self.sid = sheet_id

    def req(self, url, method='GET', body=None):
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(url, data=data, method=method, headers={'Authorization': 'Bearer ' + self.tok, 'Content-Type': 'application/json'})
        for attempt in range(4):
            try:
                return json.load(urllib.request.urlopen(r, timeout=120))
            except urllib.error.HTTPError as e:
                msg = e.read().decode('utf-8', 'replace')
                if e.code in (429, 500, 503) and attempt < 3:
                    time.sleep(2 + attempt * 3)
                    continue
                raise RuntimeError(f'HTTP {e.code}: {msg[:1500]}')
        raise RuntimeError('falha na API')

    def get(self, path):
        return self.req('https://sheets.googleapis.com/v4/spreadsheets/' + self.sid + path)

    def batch(self, requests):
        return self.req('https://sheets.googleapis.com/v4/spreadsheets/' + self.sid + ':batchUpdate', 'POST', {'requests': requests})

    def values(self, ranges):
        # ranges: list of A1 notation
        body = {'valueInputOption': 'RAW', 'data': [{'range': r, 'values': v} for r, v in ranges]}
        return self.req('https://sheets.googleapis.com/v4/spreadsheets/' + self.sid + '/values:batchUpdate', 'POST', body)


def s(v):
    return '' if v is None else str(v).strip()


def num(v):
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        t = v.strip().replace(',', '.')
        if re.fullmatch(r'-?\d+(\.\d+)?', t):
            return float(t)
    return 0.0


def qty_text(v):
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    if isinstance(v, (int,)):
        return str(v)
    return s(v)


def date_iso(v, formatted=''):
    """Converte serial do Excel/Sheets ou texto M/D/YYYY para YYYY-MM-DD."""
    if isinstance(v, (int, float)) and 20000 < float(v) < 80000:
        return (BASE_DATE + datetime.timedelta(days=int(v))).isoformat()
    t = s(v)
    if not t:
        return ''
    if re.fullmatch(r'\d{5}(\.\d+)?', t) and ('/' in str(formatted) or '-' in str(formatted)):
        return (BASE_DATE + datetime.timedelta(days=int(float(t)))).isoformat()
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', t):
        return t
    m = re.fullmatch(r'(\d{1,2})/(\d{1,2})/(\d{4})', t)
    if m:
        a, b, y = map(int, m.groups())
        # A origem usa M/D/YYYY. Se o primeiro campo > 12, trata como D/M/YYYY.
        if a > 12 and b <= 12:
            d, mo = a, b
        else:
            mo, d = a, b
        try:
            return datetime.date(y, mo, d).isoformat()
        except ValueError:
            return ''
    return ''


def parse_date_from_row(u, f, idx):
    return date_iso(u[idx] if idx < len(u) else '', f[idx] if idx < len(f) else '')


def brand_model(item):
    txt = s(item)
    if not txt:
        return '', ''
    brands = [('BLACK TOOLS', 'BLACK TOOLS'), ('DEWALT', 'DEWALT'), ('MAKITA', 'MAKITA'), ('BOSCH', 'BOSCH')]
    up = txt.upper()
    for token, canon in brands:
        if token in up:
            modelo = re.sub(r'[\(\)]', ' ', txt)
            modelo = re.sub(token, ' ', modelo, flags=re.I)
            modelo = re.sub(r'\s+', ' ', modelo).strip(' -/')
            return canon, modelo
    return '', ''


def acessorios_json(car_code, car_qty, bat_code, bat_qty):
    out = []
    if car_code and car_code not in ('0', '-') and car_qty > 0:
        out.append({'tipo': 'CARREGADOR', 'codigo': car_code, 'codigos': [x.strip() for x in car_code.split('/') if x.strip()], 'qtd': int(car_qty)})
    if bat_code and bat_code not in ('0', '-') and bat_qty > 0:
        out.append({'tipo': 'BATERIA', 'codigo': bat_code, 'codigos': [x.strip() for x in bat_code.split('/') if x.strip()], 'qtd': int(bat_qty)})
    return out


def acessorios_vazios():
    return []


def sha256(txt):
    return hashlib.sha256(txt.encode('utf-8')).hexdigest()


def load_source(api):
    meta = api.get('?fields=sheets.properties(title,sheetId,gridProperties)')
    out = []
    for sh in meta['sheets']:
        title = sh['properties']['title']
        rng = "'" + title.replace("'", "''") + "'!A1:L57"
        base = 'https://sheets.googleapis.com/v4/spreadsheets/' + api.sid + '/values/' + urllib.parse.quote(rng, safe='') + '?majorDimension=ROWS'
        f = api.req(base + '&valueRenderOption=FORMATTED_VALUE').get('values', [])
        u = api.req(base + '&valueRenderOption=UNFORMATTED_VALUE').get('values', [])
        q = api.req('https://sheets.googleapis.com/v4/spreadsheets/' + api.sid + '?includeGridData=true&ranges=' + urllib.parse.quote(rng, safe='') + '&fields=sheets(data(rowData(values(effectiveFormat(backgroundColor)))))')
        rows = q['sheets'][0].get('data', [{}])[0].get('rowData', [])
        colors = {}
        for ri, row in enumerate(rows):
            for ci, cell in enumerate(row.get('values', [])):
                bg = (cell.get('effectiveFormat') or {}).get('backgroundColor') or {}
                hexc = ''.join(f"{int(round((bg.get(k) or 0)*255)):02X}" for k in ('red', 'green', 'blue'))
                if hexc and hexc != 'FFFFFF':
                    colors[f'{ri+1},{ci+1}'] = hexc
        out.append({'title': title, 'formatted': f, 'unformatted': u, 'colors': colors})
    return out


def build(api):
    src = load_source(api)
    cat_by_aba = {c[3]: {'ID': c[0], 'PREFIXO': c[1], 'NOME': c[2], 'NOME_ABA': c[3], 'CAMPO_ITEM': c[4]} for c in CATS}
    categories, collaborators, equipments, loans, movs, mans = [], [], [], [], [], []
    collab_by_name = {}
    imported_at = NOW
    total_by_cat = {}
    summary_by_cat = {}

    for sh in src:
        aba = sh['title']
        cat = cat_by_aba.get(aba)
        if not cat:
            continue
        summary = ''
        count = 0
        for r in range(4, 58):
            f = sh['formatted'][r-1] if r-1 < len(sh['formatted']) else []
            u = sh['unformatted'][r-1] if r-1 < len(sh['unformatted']) else []
            vals = [s(u[i]) if i < len(u) else '' for i in range(12)]
            if not any(vals):
                continue
            nb, collab, estado, item = vals[0], vals[1], vals[2], vals[3]
            carreg, carreg_qt = vals[5], num(u[6] if 6 < len(u) else 0)
            bat, bat_qt = vals[7], num(u[8] if 8 < len(u) else 0)
            entrega = parse_date_from_row(u, f, 9)
            devol = parse_date_from_row(u, f, 10)
            obs = vals[11]
            fill_b = sh['colors'].get(f'{r},2', '')
            fill_a = sh['colors'].get(f'{r},1', '')
            fill_c = sh['colors'].get(f'{r},3', '')
            fill_d = sh['colors'].get(f'{r},4', '')
            # resumo de categoria
            if collab.upper().startswith('OBS') and not item:
                summary = collab
                continue
            # linha vazia apenas numerada, sem cor e sem dados
            if not item and not collab and not entrega and not devol and not obs and not carreg and not bat and not fill_b and not fill_a and not fill_c and not fill_d:
                continue
            if not nb and not item and not collab:
                continue

            count += 1
            flags = []
            if not item:
                flags.append('código/modelo do equipamento não informado na origem')
            qt_raw = num(u[4] if 4 < len(u) else 0)
            qtd = int(qt_raw) if qt_raw > 0 else 1
            if qt_raw <= 0:
                flags.append('QT original vazio/0; tratado como 1 unidade individual — revisar')
            if carreg and carreg not in ('0', '-') and carreg_qt <= 0:
                carreg_qt = 1
                flags.append('quantidade do carregador não informada; tratada como 1 — revisar')
            if bat and bat not in ('0', '-') and bat_qt <= 0:
                bat_qt = 1
                flags.append('quantidade da bateria não informada; tratada como 1 — revisar')
            if carreg in ('0', '-'):
                carreg, carreg_qt = '', 0
            if bat in ('0', '-'):
                bat, bat_qt = '', 0

            is_maint = 'MANUTEN' in collab.upper() or fill_b == 'FF0000'
            returned = bool(devol and collab and not is_maint)
            delivered = bool(collab and not is_maint and not returned)
            if is_maint:
                status = 'MANUTENCAO'
                disponivel = 0
            elif delivered:
                status = 'ENTREGUE'
                disponivel = 0
            else:
                status = 'DISPONIVEL'
                disponivel = qtd
            if returned:
                status = 'DISPONIVEL'
                disponivel = qtd
            if fill_b == '92D050' and collab and not is_maint:
                flags.append('marcação verde com colaborador preenchido; confirmar se está em estoque')
            if fill_b == 'FFFF00' and not collab:
                flags.append('marcação amarela sem colaborador')
            if not fill_b and not is_maint:
                flags.append('sem marcação de cor na coluna do colaborador')
            if delivered and not entrega:
                flags.append('colaborador preenchido sem data de entrega')
            if entrega and not collab:
                flags.append('data de entrega sem colaborador')
            if devol and not collab:
                flags.append('data de devolução sem colaborador')
            if returned:
                flags.append('data de devolução preenchida; equipamento tratado como devolvido/em estoque')
            if is_maint:
                flags.append('equipamento em manutenção na origem; envio sem data confirmada')
            if fill_a not in ('', 'FFFFFF') or fill_c not in ('', 'FFFFFF') or fill_d not in ('', 'FFFFFF'):
                flags.append('marcação de cor fora da coluna do colaborador; revisar')

            # identidade
            nb_digits = re.fullmatch(r'\d+', nb or '')
            if nb_digits:
                seq = nb.zfill(3)
            else:
                seq = re.sub(r'[^A-Za-z0-9]+', '', nb) or str(r)
            eq_id = f'EQP-{cat["PREFIXO"]}-{seq}'
            eq_code = f'{cat["PREFIXO"]}-{seq}'
            # evita colisão
            used = {e['ID'] for e in equipments}
            if eq_id in used:
                eq_id += f'-R{r}'
                eq_code += f'-R{r}'

            marca, modelo = brand_model(item)
            estado_cons = 'NOVO' if estado.upper() in ('NOVA', 'NOVO') else ('USADO' if estado.upper() in ('USADA', 'USADO') else ('NAO_INFORMADO' if not estado else estado.upper()))
            acess = acessorios_json(carreg, carreg_qt, bat, bat_qt)

            # colaborador
            cid = ''
            if collab and not is_maint:
                key = re.sub(r'\s+', ' ', collab.strip()).upper()
                if key not in collab_by_name:
                    cid = 'COL-' + sha256(key)[:12].upper()
                    rec = {'ID': cid, 'NOME': re.sub(r'\s+', ' ', collab.strip()), 'TIPO': 'NAO_INFORMADO', 'FUNCAO': '', 'TELEFONE': '', 'EMAIL': '', 'LOCAL_OBRA': '', 'ATIVO': 'SIM', 'OBSERVACOES': 'Cadastro criado na importação da planilha original. Não possui acesso ao sistema.', 'ORIGEM': 'IMPORTADO', 'CRIADO_EM': imported_at, 'ATUALIZADO_EM': imported_at}
                    collab_by_name[key] = rec
                    collaborators.append(rec)
                cid = collab_by_name[key]['ID']

            pending = acess if (delivered or returned) else []
            eq = {'ID': eq_id, 'CODIGO': eq_code, 'CATEGORIA_ID': cat['ID'], 'CATEGORIA_NOME': cat['NOME'], 'CODIGO_MODELO': item, 'DESCRICAO': '', 'MARCA': marca, 'MODELO': modelo, 'NUMERO_SERIE': '', 'QUANTIDADE_TOTAL': qtd, 'QUANTIDADE_DISPONIVEL': disponivel, 'ESTADO_CONSERVACAO': estado_cons, 'ESTADO_ORIGEM': estado, 'STATUS': status, 'COLABORADOR_ATUAL_ID': cid if delivered else '', 'COLABORADOR_ATUAL_NOME': collab if delivered else '', 'CARREGADOR_CODIGO': carreg, 'CARREGADOR_QTD': int(carreg_qt), 'BATERIA_CODIGO': bat, 'BATERIA_QTD': int(bat_qt), 'DATA_ENTREGA_ATUAL': entrega if delivered else '', 'ACESSORIOS_PENDENTES': json.dumps(pending, ensure_ascii=False), 'OBSERVACOES': obs, 'ORIGEM_ABA': aba, 'ORIGEM_LINHA': r, 'ORIGEM_NUMERO': nb, 'REVISAR': 'SIM' if flags else 'NAO', 'MOTIVO_REVISAO': '; '.join(flags), 'CRIADO_EM': imported_at, 'ATUALIZADO_EM': imported_at, 'CRIADO_POR': 'IMPORTACAO', 'ATUALIZADO_POR': 'IMPORTACAO'}
            equipments.append(eq)

            # empréstimo/movimentos
            eq_nome = (cat['NOME'] + (' ' + item if item else '')).strip()
            if delivered:
                loan_id = f'EMP-IMP-{cat["PREFIXO"]}-{seq}'
                mov_e_id = f'MOV-IMP-{cat["PREFIXO"]}-{seq}-E'
                loans.append({'ID': loan_id, 'EQUIPAMENTO_ID': eq_id, 'EQUIPAMENTO_CODIGO': eq_code, 'EQUIPAMENTO_NOME': eq_nome, 'COLABORADOR_ID': cid, 'COLABORADOR_NOME': collab, 'DATA_ENTREGA': entrega, 'QUANTIDADE': qtd, 'ESTADO_ENTREGA': estado_cons, 'ACESSORIOS_ENTREGUES': json.dumps(acess, ensure_ascii=False), 'ACESSORIOS_PENDENTES': json.dumps(acess, ensure_ascii=False), 'EQUIPAMENTO_DEVOLVIDO': 'NAO', 'DATA_DEVOLUCAO_EQUIPAMENTO': '', 'STATUS': 'ABERTO', 'MOVIMENTO_ENTREGA_ID': mov_e_id, 'MOVIMENTO_ENCERRAMENTO_ID': '', 'OBSERVACOES': 'Empréstimo aberto reconstruído na importação da planilha original.', 'ORIGEM': 'IMPORTADO', 'CRIADO_EM': imported_at, 'ATUALIZADO_EM': imported_at, 'USUARIO': 'IMPORTACAO'})
                movs.append({'ID': mov_e_id, 'DATA': entrega, 'TIPO': 'ENTREGA', 'EQUIPAMENTO_ID': eq_id, 'EQUIPAMENTO_CODIGO': eq_code, 'CATEGORIA_NOME': cat['NOME'], 'QUANTIDADE': qtd, 'COLABORADOR_ORIGEM_ID': '', 'COLABORADOR_ORIGEM_NOME': '', 'COLABORADOR_DESTINO_ID': cid, 'COLABORADOR_DESTINO_NOME': collab, 'ESTADO_CONSERVACAO': estado_cons, 'ACESSORIOS_ENTREGUES': json.dumps(acess, ensure_ascii=False), 'ACESSORIOS_DEVOLVIDOS': '[]', 'ACESSORIOS_PENDENTES': json.dumps(acess, ensure_ascii=False), 'OBSERVACOES': 'Movimento reconstruído na importação da planilha original.' + ((' Obs. origem: ' + obs) if obs else ''), 'EMPRESTIMO_ID': loan_id, 'MANUTENCAO_ID': '', 'USUARIO_ID': '', 'USUARIO_EMAIL': 'IMPORTACAO', 'ORIGEM': 'IMPORTADO', 'REQUEST_ID': f'IMPORT-{eq_id}-E', 'CRIADO_EM': imported_at})
            elif returned:
                loan_id = f'EMP-IMP-{cat["PREFIXO"]}-{seq}'
                mov_e_id = f'MOV-IMP-{cat["PREFIXO"]}-{seq}-E'
                mov_d_id = f'MOV-IMP-{cat["PREFIXO"]}-{seq}-D'
                loans.append({'ID': loan_id, 'EQUIPAMENTO_ID': eq_id, 'EQUIPAMENTO_CODIGO': eq_code, 'EQUIPAMENTO_NOME': eq_nome, 'COLABORADOR_ID': cid, 'COLABORADOR_NOME': collab, 'DATA_ENTREGA': entrega, 'QUANTIDADE': qtd, 'ESTADO_ENTREGA': estado_cons, 'ACESSORIOS_ENTREGUES': json.dumps(acess, ensure_ascii=False), 'ACESSORIOS_PENDENTES': '[]', 'EQUIPAMENTO_DEVOLVIDO': 'SIM', 'DATA_DEVOLUCAO_EQUIPAMENTO': devol, 'STATUS': 'ENCERRADO', 'MOVIMENTO_ENTREGA_ID': mov_e_id, 'MOVIMENTO_ENCERRAMENTO_ID': mov_d_id, 'OBSERVACOES': 'Empréstimo encerrado reconstruído na importação da planilha original.', 'ORIGEM': 'IMPORTADO', 'CRIADO_EM': imported_at, 'ATUALIZADO_EM': imported_at, 'USUARIO': 'IMPORTACAO'})
                if True:
                    movs.append({'ID': mov_e_id, 'DATA': entrega, 'TIPO': 'ENTREGA', 'EQUIPAMENTO_ID': eq_id, 'EQUIPAMENTO_CODIGO': eq_code, 'CATEGORIA_NOME': cat['NOME'], 'QUANTIDADE': qtd, 'COLABORADOR_ORIGEM_ID': '', 'COLABORADOR_ORIGEM_NOME': '', 'COLABORADOR_DESTINO_ID': cid, 'COLABORADOR_DESTINO_NOME': collab, 'ESTADO_CONSERVACAO': estado_cons, 'ACESSORIOS_ENTREGUES': json.dumps(acess, ensure_ascii=False), 'ACESSORIOS_DEVOLVIDOS': '[]', 'ACESSORIOS_PENDENTES': json.dumps(acess, ensure_ascii=False), 'OBSERVACOES': 'Movimento reconstruído na importação da planilha original.' + ((' Obs. origem: ' + obs) if obs else ''), 'EMPRESTIMO_ID': loan_id, 'MANUTENCAO_ID': '', 'USUARIO_ID': '', 'USUARIO_EMAIL': 'IMPORTACAO', 'ORIGEM': 'IMPORTADO', 'REQUEST_ID': f'IMPORT-{eq_id}-E', 'CRIADO_EM': imported_at})
                movs.append({'ID': mov_d_id, 'DATA': devol, 'TIPO': 'DEVOLUCAO', 'EQUIPAMENTO_ID': eq_id, 'EQUIPAMENTO_CODIGO': eq_code, 'CATEGORIA_NOME': cat['NOME'], 'QUANTIDADE': qtd, 'COLABORADOR_ORIGEM_ID': cid, 'COLABORADOR_ORIGEM_NOME': collab, 'COLABORADOR_DESTINO_ID': '', 'COLABORADOR_DESTINO_NOME': '', 'ESTADO_CONSERVACAO': estado_cons, 'ACESSORIOS_ENTREGUES': '[]', 'ACESSORIOS_DEVOLVIDOS': json.dumps(acess, ensure_ascii=False), 'ACESSORIOS_PENDENTES': '[]', 'OBSERVACOES': 'Devolução reconstruída na importação da planilha original.' + ((' Obs. origem: ' + obs) if obs else ''), 'EMPRESTIMO_ID': loan_id, 'MANUTENCAO_ID': '', 'USUARIO_ID': '', 'USUARIO_EMAIL': 'IMPORTACAO', 'ORIGEM': 'IMPORTADO', 'REQUEST_ID': f'IMPORT-{eq_id}-D', 'CRIADO_EM': imported_at})
            if is_maint:
                man_id = f'MAN-IMP-{cat["PREFIXO"]}-{seq}'
                mov_m_id = f'MOV-IMP-{cat["PREFIXO"]}-{seq}-M'
                motivo = 'data de envio não informada na origem'
                if not obs:
                    motivo += '; defeito não informado na origem'
                obs_man = 'Registro de manutenção importado da planilha original.'
                if devol:
                    obs_man += f' A coluna DEVOLUÇÃO da origem contém {devol} (não confirmada como data de envio).'
                mans.append({'ID': man_id, 'EQUIPAMENTO_ID': eq_id, 'EQUIPAMENTO_CODIGO': eq_code, 'CATEGORIA_NOME': cat['NOME'], 'DATA_ENVIO': '', 'DEFEITO': obs, 'RESPONSAVEL': '', 'STATUS': 'ABERTA', 'SERVICO': '', 'CUSTO': '', 'PREVISAO_RETORNO': '', 'DATA_RETORNO': '', 'ESTADO_RETORNO': '', 'OBSERVACOES': obs_man, 'ORIGEM': 'IMPORTADO', 'USUARIO': 'IMPORTACAO', 'CRIADO_EM': imported_at, 'ATUALIZADO_EM': imported_at, 'REVISAR': 'SIM', 'MOTIVO_REVISAO': motivo})
                movs.append({'ID': mov_m_id, 'DATA': '', 'TIPO': 'SAIDA_MANUTENCAO', 'EQUIPAMENTO_ID': eq_id, 'EQUIPAMENTO_CODIGO': eq_code, 'CATEGORIA_NOME': cat['NOME'], 'QUANTIDADE': qtd, 'COLABORADOR_ORIGEM_ID': '', 'COLABORADOR_ORIGEM_NOME': '', 'COLABORADOR_DESTINO_ID': '', 'COLABORADOR_DESTINO_NOME': '', 'ESTADO_CONSERVACAO': estado_cons, 'ACESSORIOS_ENTREGUES': '[]', 'ACESSORIOS_DEVOLVIDOS': '[]', 'ACESSORIOS_PENDENTES': '[]', 'OBSERVACOES': 'Saída para manutenção reconstruída na importação; data de envio não informada.', 'EMPRESTIMO_ID': '', 'MANUTENCAO_ID': man_id, 'USUARIO_ID': '', 'USUARIO_EMAIL': 'IMPORTACAO', 'ORIGEM': 'IMPORTADO', 'REQUEST_ID': f'IMPORT-{eq_id}-M', 'CRIADO_EM': imported_at})
        total_by_cat[aba] = count
        summary_by_cat[aba] = summary

    # categorias + observações de importação
    for idx, c in enumerate(CATS, 1):
        cid, prefix, nome, aba, campo = c
        obs_imp = []
        total = total_by_cat.get(aba, 0)
        summary = summary_by_cat.get(aba, '')
        if summary:
            nums = re.findall(r'\d+', summary)
            if nums:
                declared = int(nums[-1])
                if declared != total:
                    obs_imp.append(f'A origem declara {declared} unidade(s); {total} registro(s) com dados foram importados. As linhas vazias não foram inventadas.')
        if aba == 'SERRA MARM 110MM':
            obs_imp.append('Título da linha 1 na origem: POLICORTE; cabeçalho A3: Nº154971. Adotado o nome da aba SERRA MARM 110MM.')
        if aba == 'APLICADOR E ALINHADOR DE  FITA':
            obs_imp.append('Duas linhas verdes sem código/modelo foram importadas como itens individuais; revisar.')
        categories.append({'ID': cid, 'NOME': nome, 'NOME_ABA': aba, 'CAMPO_ITEM': campo, 'PREFIXO': prefix, 'ORDEM': idx, 'ATIVO': 'SIM', 'OBSERVACAO_ORIGEM': summary, 'OBSERVACAO_IMPORTACAO': ' '.join(obs_imp), 'CRIADO_EM': imported_at, 'ATUALIZADO_EM': imported_at})

    return categories, collaborators, equipments, loans, movs, mans


def rows_for(headers, data):
    return [headers] + [[d.get(h, '') for h in headers] for d in data]


def write_sheet(api, title, headers, data, hidden=False):
    meta = api.get('?fields=sheets.properties(title,sheetId)')
    existing = {x['properties']['title']: x['properties']['sheetId'] for x in meta['sheets']}
    if title in existing:
        sid = existing[title]
        # limpa e reescreve
        api.req('https://sheets.googleapis.com/v4/spreadsheets/' + api.sid + '/values/' + urllib.parse.quote("'" + title.replace("'", "''") + "'!A1:AZ1000", safe='') + ':clear', 'POST', {})
    else:
        resp = api.batch([{'addSheet': {'properties': {'title': title, 'gridProperties': {'rowCount': 1000, 'columnCount': max(12, len(headers)+2), 'frozenRowCount': 1}, 'tabColor': {'red': 0.12, 'green': 0.35, 'blue': 0.65}}}}])
        sid = resp['replies'][0]['addSheet']['properties']['sheetId']
    values = rows_for(headers, data)
    api.values([("'" + title.replace("'", "''") + "'!A1", values)])
    return sid, len(values)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet-id', required=True)
    ap.add_argument('--mode', choices=['test', 'prod'], required=True)
    ap.add_argument('--setup-code', default='')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--reset', action='store_true')
    args = ap.parse_args()
    if not args.setup_code and not args.dry_run:
        print('informe --setup-code'); sys.exit(2)

    api = API(args.sheet_id)
    categories, collaborators, equipments, loans, movs, mans = build(api)
    setup_hash = sha256(args.setup_code.strip().upper()) if args.setup_code else ''
    config = [
        {'CHAVE': 'SCHEMA_VERSION', 'VALOR': '1', 'ATUALIZADO_EM': NOW},
        {'CHAVE': 'API_VERSAO', 'VALOR': '1.0.0', 'ATUALIZADO_EM': NOW},
        {'CHAVE': 'APP_NOME', 'VALOR': 'GVG & ARTEFAL — Controle de Máquinas e Ferramentas', 'ATUALIZADO_EM': NOW},
        {'CHAVE': 'TIMEZONE', 'VALOR': 'America/Recife', 'ATUALIZADO_EM': NOW},
        {'CHAVE': 'IMPORTACAO_CONCLUIDA_EM', 'VALOR': NOW, 'ATUALIZADO_EM': NOW},
        {'CHAVE': 'IMPORTACAO_FONTE', 'VALOR': 'CONTROLE  PARAFUSADEIRA.xlsx -> Google Sheets', 'ATUALIZADO_EM': NOW},
        {'CHAVE': 'IMPORTACAO_MODO', 'VALOR': args.mode.upper(), 'ATUALIZADO_EM': NOW},
        {'CHAVE': 'SETUP_CODE_HASH', 'VALOR': setup_hash, 'ATUALIZADO_EM': NOW},
        {'CHAVE': 'SETUP_CRIADO_EM', 'VALOR': NOW, 'ATUALIZADO_EM': NOW},
        {'CHAVE': 'SETUP_USADO_EM', 'VALOR': '', 'ATUALIZADO_EM': NOW},
        {'CHAVE': 'RESET_CODE_HASH', 'VALOR': '', 'ATUALIZADO_EM': NOW},
        {'CHAVE': 'RESET_EXPIRA_EM', 'VALOR': '', 'ATUALIZADO_EM': NOW},
    ]
    leia = [
        ['GVG & ARTEFAL — Controle de Máquinas e Ferramentas'],
        [''],
        ['Esta planilha é a base de dados do aplicativo. A planilha é privada e não deve ser tornada pública.'],
        ['O aplicativo acessa os dados por um servidor Google Apps Script autenticado.'],
        [''],
        ['ABAS ORIGINAIS PRESERVADAS'],
        ['As 12 abas originais (PARAFUSADEIRA, APLICADOR DE SILICONE ELETRICO, MARTELETE, ESMERILHADEIRA, SERRA TICO TICO, FURADEIRA ELÉTRICA, SERRA CIRCULAR, SOPRADOR, REBITADEIRA, APLICADOR E ALINHADOR DE  FITA, POLICORTE e SERRA MARM 110MM) foram mantidas.'],
        ['Elas são a referência histórica da importação. O aplicativo NÃO lê essas abas depois da importação; ele usa as abas do sistema abaixo.'],
        ['Se você editar as abas originais, a alteração não aparecerá no aplicativo. Edite pelo aplicativo ou pelas abas do sistema.'],
        [''],
        ['ABAS DO SISTEMA'],
        ['CATEGORIAS: categorias e rótulos de item.'],
        ['COLABORADORES: pessoas, grupos ou locais que recebem equipamentos. Não são contas de acesso.'],
        ['EQUIPAMENTOS: cadastro atual, disponibilidade, conservação, acessórios e pendências.'],
        ['EMPRESTIMOS: cada entrega e o que ainda está pendente.'],
        ['MOVIMENTACOES: histórico de entregas, devoluções, transferências e manutenção.'],
        ['MANUTENCOES: registros de manutenção.'],
        ['USUARIOS: contas de acesso (aba oculta; contém apenas hash de senha, nunca a senha).'],
        ['SESSOES: sessões ativas (aba oculta).'],
        ['AUDITORIA: registro de ações administrativas (aba oculta).'],
        ['CONFIG: configurações do sistema e códigos de configuração/recuperação (aba oculta).'],
        [''],
        ['REGRAS IMPORTANTES'],
        ['1. Não exclua linhas com histórico. Use a inativação/arquivamento no aplicativo.'],
        ['2. Não edite manualmente as colunas de ID, SENHA_HASH, SENHA_SALT, ACESSORIOS_PENDENTES, STATUS ou QUANTIDADE_DISPONIVEL sem necessidade.'],
        ['3. Alterações feitas diretamente nas abas do sistema aparecem no aplicativo ao recarregar/atualizar a tela.'],
        ['4. O aplicativo não promete atualização em tempo real: ele lê os dados atuais a cada carregamento.'],
        ['5. A planilha deve continuar privada. Não compartilhe com colaboradores só para dar acesso ao app.'],
        ['6. O acesso ao app é feito por e-mail e senha, com perfis ADMINISTRADOR e COLABORADOR.'],
        ['7. A disponibilidade é separada do estado de conservação. Um item disponível não é necessariamente novo.'],
        ['8. Marcações antigas: amarelo = entregue; verde = estoque; vermelho = manutenção. Casos divergentes foram marcados como REVISAR.'],
        [''],
        ['IMPORTAÇÃO'],
        [f'Modo: {args.mode.upper()}'],
        [f'Data da importação: {NOW}'],
        [f'Equipamentos importados: {len(equipments)}'],
        [f'Colaboradores/grupos importados: {len(collaborators)}'],
        [f'Empréstimos abertos: {sum(1 for x in loans if x["STATUS"]=="ABERTO")}'],
        [f'Empréstimos encerrados: {sum(1 for x in loans if x["STATUS"]=="ENCERRADO")}'],
        [f'Manutenções abertas: {len(mans)}'],
        [''],
        ['SEGURANÇA'],
        ['As senhas são armazenadas apenas como hash com sal. Nunca há senha em texto puro nesta planilha.'],
        ['O código de configuração inicial e o código de recuperação são armazenados apenas como hash no CONFIG.'],
        ['Após a criação do primeiro administrador, o código de configuração é invalidado.'],
        [''],
        ['SUPORTE'],
        ['Consulte o manual publicado no repositório do aplicativo.'],
        ['Aplicativo: https://higoragenteia.github.io/gvg-maquinas-ferramentas/'],
    ]

    if args.dry_run:
        out = {'categories': categories, 'collaborators': collaborators, 'equipments': equipments, 'loans': loans, 'movs': movs, 'mans': mans, 'config': config}
        out_path = os.environ.get('GVG_DRY_RUN_OUT', '/tmp/opencode/maquinas-import-dry.json')
        open(out_path, 'w').write(json.dumps(out, ensure_ascii=False, indent=2))
        print('DRY RUN')
        print('categorias', len(categories), 'colaboradores', len(collaborators), 'equipamentos', len(equipments), 'emprestimos', len(loans), 'movimentos', len(movs), 'manutencoes', len(mans))
        from collections import Counter
        print('status', Counter(e['STATUS'] for e in equipments))
        print('revisar', Counter(e['REVISAR'] for e in equipments))
        for e in equipments:
            if e['REVISAR'] == 'SIM':
                print(' ', e['CODIGO'], e['STATUS'], e['MOTIVO_REVISAO'])
        for c in categories:
            if c['OBSERVACAO_IMPORTACAO']:
                print('CAT', c['NOME'], '->', c['OBSERVACAO_IMPORTACAO'])
        return

    if args.reset:
        meta = api.get('?fields=sheets.properties(title,sheetId)')
        existing = {x['properties']['title']: x['properties']['sheetId'] for x in meta['sheets']}
        wanted = [x[0] for x in [('CATEGORIAS',),('COLABORADORES',),('EQUIPAMENTOS',),('EMPRESTIMOS',),('MOVIMENTACOES',),('MANUTENCOES',),('USUARIOS',),('SESSOES',),('AUDITORIA',),('CONFIG',),('LEIA-ME',)]]
        deletes = [{'deleteSheet': {'sheetId': existing[t]}} for t in wanted if t in existing]
        if deletes:
            for i in range(0, len(deletes), 20):
                api.batch(deletes[i:i+20])
            print('  abas antigas removidas:', len(deletes))

    print('Limpando/criando abas do sistema...')
    # monta todas as abas; LEIA-ME por último
    sheets = [
        ('CATEGORIAS', HEADERS['CATEGORIAS'], categories),
        ('COLABORADORES', HEADERS['COLABORADORES'], collaborators),
        ('EQUIPAMENTOS', HEADERS['EQUIPAMENTOS'], equipments),
        ('EMPRESTIMOS', HEADERS['EMPRESTIMOS'], loans),
        ('MOVIMENTACOES', HEADERS['MOVIMENTACOES'], movs),
        ('MANUTENCOES', HEADERS['MANUTENCOES'], mans),
        ('USUARIOS', HEADERS['USUARIOS'], []),
        ('SESSOES', HEADERS['SESSOES'], []),
        ('AUDITORIA', HEADERS['AUDITORIA'], []),
        ('CONFIG', HEADERS['CONFIG'], config),
    ]
    ids = {}
    for title, headers, data in sheets:
        sid, n = write_sheet(api, title, headers, data)
        ids[title] = sid
        print(f'  {title}: {n-1} linha(s)')
    # LEIA-ME
    meta = api.get('?fields=sheets.properties(title,sheetId)')
    if 'LEIA-ME' in {x['properties']['title'] for x in meta['sheets']}:
        sid = next(x['properties']['sheetId'] for x in meta['sheets'] if x['properties']['title'] == 'LEIA-ME')
        api.req('https://sheets.googleapis.com/v4/spreadsheets/' + api.sid + '/values/' + urllib.parse.quote("'LEIA-ME'!A1:A200", safe='') + ':clear', 'POST', {})
    else:
        resp = api.batch([{'addSheet': {'properties': {'title': 'LEIA-ME', 'gridProperties': {'rowCount': 200, 'columnCount': 2, 'frozenRowCount': 1}}}}])
        sid = resp['replies'][0]['addSheet']['properties']['sheetId']
    api.values([("'LEIA-ME'!A1", leia)])
    ids['LEIA-ME'] = sid

    print('Formatando...')
    meta = api.get('?fields=sheets.properties(title,sheetId)')
    sheet_meta = {x['properties']['title']: x['properties']['sheetId'] for x in meta['sheets']}
    reqs = []
    # cabeçalho + larguras + validação + filtros
    for title, headers, data in sheets:
        sid = sheet_meta[title]
        ncol = len(headers)
        last = chr(64 + ncol) if ncol <= 26 else 'AZ'
        # cabeçalho
        reqs.append({'repeatCell': {'range': {'sheetId': sid, 'startRowIndex': 0, 'endRowIndex': 1, 'startColumnIndex': 0, 'endColumnIndex': ncol}, 'cell': {'userEnteredFormat': {'backgroundColor': {'red': 0.043, 'green': 0.122, 'blue': 0.227}, 'textFormat': {'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}, 'bold': True, 'fontSize': 10}, 'horizontalAlignment': 'CENTER', 'verticalAlignment': 'MIDDLE', 'wrapStrategy': 'WRAP'}}, 'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'}})
        reqs.append({'updateSheetProperties': {'properties': {'sheetId': sid, 'gridProperties': {'frozenRowCount': 1}, 'tabColor': {'red': 0.12, 'green': 0.35, 'blue': 0.65}}, 'fields': 'gridProperties.frozenRowCount,tabColor'}})
        reqs.append({'setBasicFilter': {'filter': {'range': {'sheetId': sid, 'startRowIndex': 0, 'endRowIndex': 1000, 'startColumnIndex': 0, 'endColumnIndex': ncol}}}})
        # larguras
        widths = {}
        for i, h in enumerate(headers):
            if h in ('ID', 'CODIGO', 'CATEGORIA_ID', 'PREFIXO', 'ATIVO', 'REVISAR', 'STATUS', 'PERFIL', 'ORIGEM', 'TIPO'): w = 120
            elif h in ('NOME', 'COLABORADOR_NOME', 'COLABORADOR_ATUAL_NOME', 'EQUIPAMENTO_NOME', 'CATEGORIA_NOME'): w = 190
            elif h in ('EMAIL', 'ASSINATURA'): w = 220
            elif h in ('OBSERVACOES', 'MOTIVO_REVISAO', 'DEFEITO', 'SERVICO', 'DETALHES', 'OBSERVACAO_ORIGEM', 'OBSERVACAO_IMPORTACAO', 'ACESSORIOS_PENDENTES', 'ACESSORIOS_ENTREGUES', 'ACESSORIOS_DEVOLVIDOS', 'DESCRICAO', 'CODIGO_MODELO', 'MODELO'): w = 280
            elif h in ('DATA', 'DATA_ENTREGA', 'DATA_DEVOLUCAO', 'DATA_ENVIO', 'DATA_RETORNO', 'PREVISAO_RETORNO', 'CRIADO_EM', 'ATUALIZADO_EM', 'EXPIRA_EM', 'REVOGADO_EM', 'ULTIMO_USO', 'SETUP_CRIADO_EM', 'SETUP_USADO_EM', 'RESET_EXPIRA_EM'): w = 150
            else: w = 130
            widths[i] = w
        for i, w in widths.items():
            reqs.append({'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'COLUMNS', 'startIndex': i, 'endIndex': i+1}, 'properties': {'pixelSize': w}, 'fields': 'pixelSize'}})
        # banding
        reqs.append({'addBanding': {'bandedRange': {'range': {'sheetId': sid, 'startRowIndex': 1, 'endRowIndex': 1000, 'startColumnIndex': 0, 'endColumnIndex': ncol}, 'rowProperties': {'firstBandColor': {'red': 1, 'green': 1, 'blue': 1}, 'secondBandColor': {'red': 0.957, 'green': 0.973, 'blue': 0.988}}}}})
        # validações
        def dv(col, values):
            idx = headers.index(col)
            reqs.append({'setDataValidation': {'range': {'sheetId': sid, 'startRowIndex': 1, 'endRowIndex': 1000, 'startColumnIndex': idx, 'endColumnIndex': idx+1}, 'rule': {'condition': {'type': 'ONE_OF_LIST', 'values': [{'userEnteredValue': v} for v in values]}, 'strict': False, 'showCustomUi': True}}})
        if title == 'EQUIPAMENTOS':
            dv('STATUS', ['DISPONIVEL', 'ENTREGUE', 'PARCIAL', 'MANUTENCAO', 'INATIVO'])
            dv('ESTADO_CONSERVACAO', ['NOVO', 'USADO', 'BOM', 'REGULAR', 'RUIM', 'NAO_INFORMADO'])
            dv('REVISAR', ['SIM', 'NAO'])
        if title == 'MANUTENCOES':
            dv('STATUS', ['ABERTA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA'])
            dv('REVISAR', ['SIM', 'NAO'])
        if title == 'CATEGORIAS': dv('ATIVO', ['SIM', 'NAO'])
        if title == 'COLABORADORES': dv('ATIVO', ['SIM', 'NAO'])
        if title == 'USUARIOS':
            dv('PERFIL', ['ADMINISTRADOR', 'COLABORADOR'])
            dv('STATUS', ['ATIVO', 'BLOQUEADO'])
        if title == 'MOVIMENTACOES': dv('TIPO', ['ENTREGA', 'DEVOLUCAO', 'TRANSFERENCIA', 'SAIDA_MANUTENCAO', 'RETORNO_MANUTENCAO', 'AJUSTE', 'IMPORTACAO'])
        if title == 'EMPRESTIMOS': dv('STATUS', ['ABERTO', 'ENCERRADO', 'TRANSFERIDO'])
        # condicional status
        if title in ('EQUIPAMENTOS', 'MANUTENCOES', 'EMPRESTIMOS'):
            col = headers.index('STATUS')
            rules = [
                ('DISPONIVEL', {'red': 0.85, 'green': 0.95, 'blue': 0.87}),
                ('ENTREGUE', {'red': 0.99, 'green': 0.93, 'blue': 0.77}),
                ('PARCIAL', {'red': 0.99, 'green': 0.93, 'blue': 0.77}),
                ('MANUTENCAO', {'red': 0.98, 'green': 0.85, 'blue': 0.83}),
                ('INATIVO', {'red': 0.90, 'green': 0.90, 'blue': 0.90}),
                ('ABERTA', {'red': 0.98, 'green': 0.85, 'blue': 0.83}),
                ('EM_ANDAMENTO', {'red': 0.99, 'green': 0.93, 'blue': 0.77}),
                ('CONCLUIDA', {'red': 0.85, 'green': 0.95, 'blue': 0.87}),
                ('CANCELADA', {'red': 0.90, 'green': 0.90, 'blue': 0.90}),
                ('ABERTO', {'red': 0.99, 'green': 0.93, 'blue': 0.77}),
                ('ENCERRADO', {'red': 0.85, 'green': 0.95, 'blue': 0.87}),
                ('TRANSFERIDO', {'red': 0.88, 'green': 0.92, 'blue': 0.98}),
            ]
            for val, bg in rules:
                reqs.append({'addConditionalFormatRule': {'rule': {'ranges': [{'sheetId': sid, 'startRowIndex': 1, 'endRowIndex': 1000, 'startColumnIndex': col, 'endColumnIndex': col+1}], 'booleanRule': {'condition': {'type': 'TEXT_EQ', 'values': [{'userEnteredValue': val}]}, 'format': {'backgroundColor': bg, 'textFormat': {'bold': True}}}}, 'index': 0}})

    # LEIA-ME layout
    sid = sheet_meta['LEIA-ME']
    reqs.append({'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'COLUMNS', 'startIndex': 0, 'endIndex': 1}, 'properties': {'pixelSize': 900}, 'fields': 'pixelSize'}})
    reqs.append({'repeatCell': {'range': {'sheetId': sid, 'startRowIndex': 0, 'endRowIndex': 1, 'startColumnIndex': 0, 'endColumnIndex': 1}, 'cell': {'userEnteredFormat': {'backgroundColor': {'red': 0.043, 'green': 0.122, 'blue': 0.227}, 'textFormat': {'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}, 'bold': True, 'fontSize': 14}, 'horizontalAlignment': 'LEFT'}}, 'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'}})
    reqs.append({'updateSheetProperties': {'properties': {'sheetId': sid, 'tabColor': {'red': 0.78, 'green': 0.63, 'blue': 0.29}}, 'fields': 'tabColor'}})
    # esconder abas técnicas
    for title in HIDDEN:
        if title in sheet_meta:
            reqs.append({'updateSheetProperties': {'properties': {'sheetId': sheet_meta[title], 'hidden': True}, 'fields': 'hidden'}})
    # proteger aba LEIA-ME? não.
    # formatar datas das abas originais e colunas de código como texto
    for t in sheet_meta:
        if any(x[3] == t for x in CATS):
            sid0 = sheet_meta[t]
            # J:K dd/mm/yyyy
            reqs.append({'repeatCell': {'range': {'sheetId': sid0, 'startRowIndex': 3, 'endRowIndex': 57, 'startColumnIndex': 9, 'endColumnIndex': 11}, 'cell': {'userEnteredFormat': {'numberFormat': {'type': 'DATE', 'pattern': 'dd/mm/yyyy'}}}, 'fields': 'userEnteredFormat.numberFormat'}})
            # A, D, F, H como texto
            for col in (0, 3, 5, 7):
                reqs.append({'repeatCell': {'range': {'sheetId': sid0, 'startRowIndex': 3, 'endRowIndex': 57, 'startColumnIndex': col, 'endColumnIndex': col+1}, 'cell': {'userEnteredFormat': {'numberFormat': {'type': 'TEXT'}}}, 'fields': 'userEnteredFormat.numberFormat'}})

    # aplica em blocos para evitar payload gigante
    for i in range(0, len(reqs), 60):
        api.batch(reqs[i:i+60])
        print(f'  bloco {i//60+1}/{(len(reqs)+59)//60}')

    print('OK')
    print('Equipamentos:', len(equipments), '| Colaboradores:', len(collaborators), '| Emprestimos:', len(loans), '| Movimentos:', len(movs), '| Manutencoes:', len(mans))
    print('Setup code hash:', setup_hash)


if __name__ == '__main__':
    main()
