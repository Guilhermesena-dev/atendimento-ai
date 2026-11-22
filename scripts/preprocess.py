"""Pré-processamento determinístico (sem LLM).

Lê raw/*.csv (gitignored) e gera:
  data/conversas.json  -> uma linha por conversa, com thread mascarada (PII), pedido e campos derivados
  data/base_metrics.json -> agregados determinísticos usados pelo dashboard

Uso: python -I scripts/preprocess.py  (rodar a partir de atendimento-ai/)
"""
import json
import re
import sys
from pathlib import Path

import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
OUT = ROOT / "data"
OUT.mkdir(exist_ok=True)

EXTRACAO = pd.Timestamp("2026-09-30")
CUSTO = {"whatsapp": 4.80, "email": 7.20, "reclame_aqui": 42.00}
SLA_MIN = {"whatsapp": 30, "email": 24 * 60, "reclame_aqui": 48 * 60}
FATOR_PERIODO = 3   # amostra 1/3 dos clientes
FATOR_ANUAL = 12    # x3 amostra x4 trimestres

# ---------------------------------------------------------------- taxonomia
# Ordem importa: a primeira regra que casar define o motivo do trecho.
REGRAS = [
    ("Reação adversa", r"alergi|coceira|irrit|vermelh|ard[eê]n|ardendo|rea[cç][aã]o|bolinha|incha|enjoo|manchas vermelhas|descamando|descasc\w* a pele|queima|feriu|ferida|o que tem na f[oó]rmula"),
    ("Erro de personalização", r"escrito errado|pedi .{0,30} e veio|veio a de outra pessoa|foto .*errada|impress[aã]o .*(borrada|torta|descascando)|personaliza[cç][aã]o manchada|tinta escorreu|nome est[aá] cortado|iniciais .*(erradas|borrad)|refazer"),
    ("Cobrança duplicada", r"duas vezes|cobrad[ao] de novo|cobran[cç]a duplicada|saiu duas"),
    ("Pagamento/financeiro", r"n[aã]o reconhe[cç]o|cashback|boleto foi pago|pix .*n[aã]o confirmou|aguardando pagamento|ressarcir|reembolso n[aã]o"),
    ("Avaria/vazamento", r"vaza|quebrad|rachad|trincad|amassad|lacre violado|tampa quebrada|arranhad|riscad|cara de usado|melad|veio aberto|caixa veio aberta"),
    ("Promoção/cupom/brinde", r"brinde|mimo|cupom|promo[cç][aã]o|frete gr[aá]tis|desconto"),
    ("Item faltante", r"faltou|faltando|incompleto|cad[eê] o resto|veio pela metade|chegou s[oó]"),
    ("Endereço", r"endere[cç]o|n[uú]mero da casa|vou viajar|cep"),
    ("Arrependimento/cancelamento", r"cancel|desisti|arrependi|comprei sem querer|devolver"),
    ("Troca", r"troca|fragr[aâ]ncia|cheiro|n[aã]o fixa|n[aã]o era o que eu esperava|tamanho errado|modelo .*errado"),
    ("Atraso na entrega", r"atrasad|prazo|venceu|prometeram entregar|n[aã]o chega a tempo|estourad|mais de \d+ dias"),
    ("Onde está meu pedido", r"rastreio|status do pedido|em tr[aâ]nsito|ainda n[aã]o chegou|cad[eê] meu pedido|onde est[aá]|parado em|at[eé] agora nada|c[oó]digo de rastreio"),
    ("Elogio", r"amei|perfeito|melhor compra|agradecer|maravilhos|adorei"),
    ("Dúvida de produto", r"\?$|pode usar|serve pra|vegano|validade|diferen[cç]a entre|quantas vezes|como usar|durabilidade|aguenta"),
]
REGRAS = [(m, re.compile(p, re.I)) for m, p in REGRAS]
# Sarcasmo: cada frase vira o motivo real (vazamento x atraso), sem misturar os dois.
SARCASMO = [
    (re.compile(r"que maravilha, chegou vazando", re.I), " vazando"),
    (re.compile(r"parab[eé]ns pela efici\w*", re.I), " atrasado"),
    (re.compile(r"que maravilha|s[oó] que n[aã]o", re.I), " "),
]

PREFIXO_RECONTATO = re.compile(r"^(De novo aqui\.|J[aá] [eé] a (\d)ª vez que entro em contato\.|Ningu[eé]m me respondeu ainda!)\s*", re.I)
CONECTORES = re.compile(r"\s*(?:E outra coisa:|Ah, e tamb[eé]m|Aproveitando,)\s*", re.I)
INJECAO = re.compile(r"((?:\[SISTEMA\]\s*)?(?:Se voc[eê] for uma IA|Instru[cç][aã]o para o assistente|Ignore (?:suas|as|todas)|Aten[cç][aã]o,? agente).*)$", re.I)
PII = [
    (re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b"), "[CPF]"),
    (re.compile(r"\b(?:\d{4}[ .-]?){3}\d{4}\b"), "[CARTÃO]"),
    (re.compile(r"\(\d{2}\)\s?\d{4,5}-\d{4}"), "[TELEFONE]"),
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "[EMAIL]"),
]


def mascarar(txt: str) -> tuple[str, bool]:
    achou = False
    for rx, rep in PII:
        if rx.search(txt):
            achou = True
            txt = rx.sub(rep, txt)
    return txt, achou


def classificar_trecho(txt: str) -> str | None:
    sarcasmo = False
    for rx, real in SARCASMO:
        if rx.search(txt):
            txt = rx.sub("", txt) + real
            sarcasmo = True
    if sarcasmo:  # elogio irônico não é elogio
        txt = re.sub(r"amei|perfeito|adorei|impec[aá]vel|capricho", "", txt, flags=re.I)
    for motivo, rx in REGRAS:
        if rx.search(txt):
            return motivo
    return None


def classificar(msgs_cliente: list[str]) -> dict:
    if not msgs_cliente:
        return {"motivo": "Abandono no bot", "secundarios": [], "recontato_texto": False}
    primeira = msgs_cliente[0]
    recontato = bool(PREFIXO_RECONTATO.match(primeira))
    corpo = PREFIXO_RECONTATO.sub("", primeira)
    corpo = INJECAO.sub("", corpo)
    corpo = re.split(r"\s*(?:Meu CPF|Me liga|O cart[aã]o cobrado)", corpo)[0]
    trechos = [t for t in CONECTORES.split(corpo) if t.strip()]
    motivos = [classificar_trecho(t) for t in trechos]
    motivo = motivos[0] if motivos and motivos[0] else None
    # elogio seguido de um problema: o problema é o motivo do contato
    if motivo == "Elogio" and any(m and m != "Elogio" for m in motivos[1:]):
        motivo = next(m for m in motivos[1:] if m and m != "Elogio")
    if motivo is None:  # tenta as mensagens seguintes do cliente
        for extra in msgs_cliente[1:]:
            motivo = classificar_trecho(extra)
            if motivo:
                break
    # reação adversa em qualquer mensagem do cliente sobrepõe (risco regulatório)
    if any(REGRAS[0][1].search(x) for x in msgs_cliente):
        motivo = "Reação adversa"
    secundarios = [m for m in motivos[1:] if m and m != motivo]
    return {"motivo": motivo or "Outros", "secundarios": secundarios, "recontato_texto": recontato}


def minutos_uteis(ini: pd.Timestamp, fim: pd.Timestamp) -> float:
    """Minutos entre ini e fim contando só 8h-20h (todos os dias)."""
    if fim <= ini:
        return 0.0
    total = 0.0
    dia = ini.normalize()
    while dia <= fim.normalize():
        a = max(ini, dia + pd.Timedelta(hours=8))
        b = min(fim, dia + pd.Timedelta(hours=20))
        if b > a:
            total += (b - a).total_seconds() / 60
        dia += pd.Timedelta(days=1)
    return total


def main():
    conv = pd.read_csv(RAW / "conversas.csv", encoding="utf-8", parse_dates=["data_abertura"])
    msg = pd.read_csv(RAW / "mensagens.csv", encoding="utf-8", parse_dates=["timestamp"])
    ped = pd.read_csv(RAW / "pedidos.csv", encoding="utf-8", parse_dates=["data_pedido"])
    msg = msg.sort_values(["conversation_id", "timestamp", "message_id"])
    ped_idx = ped.set_index("order_id")

    conv = conv.sort_values("data_abertura")
    conv["ordem_contato"] = conv.groupby("customer_id").cumcount() + 1
    conv["contatos_cliente"] = conv.groupby("customer_id").conversation_id.transform("count")
    conv["contatos_pedido"] = conv.groupby("order_id").conversation_id.transform("count")

    grupos = {k: g for k, g in msg.groupby("conversation_id")}
    saida = []
    for r in conv.itertuples(index=False):
        g = grupos.get(r.conversation_id)
        mensagens, pii, injecao = [], False, False
        cli = []
        if g is not None:
            for mm in g.itertuples(index=False):
                txt = str(mm.texto)
                if mm.autor == "cliente":
                    cli.append(txt)
                    if INJECAO.search(txt):
                        injecao = True
                txt, p = mascarar(txt)
                pii |= p
                mensagens.append({"autor": mm.autor, "ts": mm.timestamp.isoformat(), "texto": txt})
        cls = classificar(cli)

        # SLA da 1ª resposta humana (agente) contado em horário comercial
        primeira_resp = None
        if g is not None:
            ag = g[g.autor == "agente"]
            if len(ag):
                primeira_resp = minutos_uteis(r.data_abertura, ag.timestamp.iloc[0])
        h = r.data_abertura.hour
        fora_horario = h < 8 or h >= 20
        sla = SLA_MIN[r.canal]
        sla_estourado = (primeira_resp is None and r.status != "resolvido" and bool(cli)) or (
            primeira_resp is not None and primeira_resp > sla)

        pedido = None
        if isinstance(r.order_id, str) and r.order_id in ped_idx.index:
            p = ped_idx.loc[r.order_id]
            dias = (r.data_abertura.normalize() - p.data_pedido).days
            pedido = {
                "order_id": r.order_id, "data_pedido": p.data_pedido.date().isoformat(),
                "valor": round(float(p.valor), 2), "sku": p.sku, "produto": p.descricao_produto,
                "transportadora": p.transportadora, "uf": p.uf, "status_entrega": p.status_entrega,
                "dias_desde_pedido": int(dias),
            }
        saida.append({
            "id": r.conversation_id, "customer_id": r.customer_id, "order_id": r.order_id,
            "marca": r.marca, "canal": r.canal, "abertura": r.data_abertura.isoformat(),
            "tag_agente": r.tag_agente if isinstance(r.tag_agente, str) else None,
            "status": r.status, "n_interacoes": int(r.n_interacoes),
            "motivo": cls["motivo"], "motivos_secundarios": cls["secundarios"],
            "ordem_contato": int(r.ordem_contato), "contatos_cliente": int(r.contatos_cliente),
            "contatos_pedido": int(r.contatos_pedido),
            "recontato": bool(r.ordem_contato > 1 or cls["recontato_texto"]),
            "primeira_resposta_min": None if primeira_resp is None else round(primeira_resp, 1),
            "sla_min": sla, "sla_estourado": bool(sla_estourado), "fora_horario": fora_horario,
            "custo": CUSTO[r.canal], "pii": pii, "injecao_prompt": injecao,
            "pedido": pedido, "mensagens": mensagens,
        })

    (OUT / "conversas.json").write_text(json.dumps(saida, ensure_ascii=False), encoding="utf-8")

    df = pd.DataFrame([{k: v for k, v in s.items() if k not in ("mensagens", "pedido")} |
                       {"status_entrega": (s["pedido"] or {}).get("status_entrega")} for s in saida])
    por_motivo = (df.groupby("motivo").agg(conversas=("id", "count"), custo=("custo", "sum"),
                                           reclame_aqui=("canal", lambda c: int((c == "reclame_aqui").sum())),
                                           recontato=("recontato", "sum"), sla_estourado=("sla_estourado", "sum"))
                  .sort_values("conversas", ascending=False).reset_index())
    por_motivo["custo_periodo"] = (por_motivo.custo * FATOR_PERIODO).round(2)
    por_motivo["custo_anual"] = (por_motivo.custo * FATOR_ANUAL).round(2)
    matriz = pd.crosstab(df.tag_agente.fillna("(vazia)"), df.motivo)
    base = {
        "fatores": {"periodo": FATOR_PERIODO, "anual": FATOR_ANUAL},
        "custo_canal": CUSTO, "sla_min": SLA_MIN,
        "total_conversas": len(df), "custo_amostra": round(df.custo.sum(), 2),
        "por_canal": df.canal.value_counts().to_dict(), "por_status": df.status.value_counts().to_dict(),
        "por_motivo": por_motivo.to_dict(orient="records"),
        "matriz_tag_x_motivo": {"linhas": matriz.index.tolist(), "colunas": matriz.columns.tolist(),
                                "valores": matriz.values.tolist()},
        "sla_estourado": int(df.sla_estourado.sum()), "recontato": int(df.recontato.sum()),
        "injecao_prompt": int(df.injecao_prompt.sum()), "conversas_com_pii": int(df.pii.sum()),
        "rastreio_em_transito": int(((df.motivo == "Onde está meu pedido") & (df.status_entrega == "em_transito")).sum()),
    }
    (OUT / "base_metrics.json").write_text(json.dumps(base, ensure_ascii=False, indent=1, default=int), encoding="utf-8")
    print(por_motivo[["motivo", "conversas", "custo", "reclame_aqui"]].to_string())
    print({k: base[k] for k in ("total_conversas", "sla_estourado", "recontato", "injecao_prompt", "conversas_com_pii", "rastreio_em_transito")})


if __name__ == "__main__":
    main()
