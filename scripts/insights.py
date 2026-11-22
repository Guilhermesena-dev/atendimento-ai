"""Gera data/insights.json e data/insights.md a partir de data/conversas.json.

Rodar a partir de atendimento-ai/:  python -I scripts/insights.py
Números conservadores: cada taxa de captura é declarada em PREMISSAS e no JSON.
"""
import json
import os
from collections import Counter
from datetime import datetime, timedelta

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "data")

F_PERIODO, F_ANO = 3, 12
CUSTO = {"whatsapp": 4.8, "email": 7.2, "reclame_aqui": 42.0}
PEDIDOS_PERIODO = 166_000  # ~70 mil Gocase + ~96 mil GoBeauté
VALOR_ALTO = 300

# Taxas de captura conservadoras (o que a iniciativa realmente evita)
TX_RASTREIO_WISMO = 0.40   # "onde está meu pedido" em trânsito evitado por push proativo
TX_RASTREIO_ATRASO = 0.20  # contato de atraso evitado com aviso proativo + nova data
TX_ABANDONO = 0.30         # recontatos após abandono no bot evitados com follow-up ativo
TX_RA = 0.25               # RAs precedidos de contato prévio evitados com escalonamento no 3º contato
TX_AUTO_RECONTATO = 0.50   # recontatos do mesmo pedido evitados ao resolver no 1º contato
JANELA_ABANDONO_DIAS = 7

ESFORCO_PESO = {"baixo": 1, "médio": 2, "alto": 3}

MOTIVOS_AUTO_FLUXO = ["Avaria/vazamento", "Item faltante", "Erro de personalização",
                      "Arrependimento/cancelamento", "Cobrança duplicada"]

# tag do agente -> motivos considerados compatíveis (não divergentes)
COMPATIVEL = {
    "Rastreio": {"Onde está meu pedido", "Atraso na entrega"},
    "Atraso": {"Atraso na entrega", "Onde está meu pedido"},
    "Produto faltando": {"Item faltante", "Promoção/cupom/brinde"},
    "Avaria": {"Avaria/vazamento", "Erro de personalização"},
    "Troca": {"Troca", "Arrependimento/cancelamento", "Erro de personalização"},
    "Cancelamento": {"Arrependimento/cancelamento"},
    "Reclamação produto": {"Avaria/vazamento", "Erro de personalização", "Troca"},
    "Financeiro": {"Cobrança duplicada", "Pagamento/financeiro"},
    "Dúvida": {"Dúvida de produto"},
    "Promoção": {"Promoção/cupom/brinde"},
    "Endereço": {"Endereço"},
    "Elogio": {"Elogio"},
    "Outros": {"Abandono no bot", "Outros"},
    "(vazia)": {"Abandono no bot"},
}
# Reação adversa nunca é compatível: não existe tag própria (risco regulatório).


def triar(c):
    """Réplica de lib/triagem.ts (rota auto x humano)."""
    motivos = []
    if c["motivo"] == "Reação adversa":
        motivos.append("reação adversa")
    if c["canal"] == "reclame_aqui":
        motivos.append("reclame aqui")
    if c["contatos_cliente"] >= 3:
        motivos.append("3+ contatos")
    if c["injecao_prompt"]:
        motivos.append("injeção")
    p = c.get("pedido")
    if p and p["valor"] >= VALOR_ALTO and c["motivo"] in (
            "Arrependimento/cancelamento", "Cobrança duplicada", "Pagamento/financeiro"):
        motivos.append("valor alto")
    if c["motivo"] == "Endereço" and p and p["status_entrega"] != "aguardando_pagamento":
        motivos.append("endereço após separação")
    return ("humano" if motivos else "auto"), motivos


def brl(v):
    s = f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


def brl0(v):
    s = f"{round(v):,}".replace(",", ".")
    return f"R$ {s}"


def n0(v):
    return f"{round(v):,}".replace(",", ".")


def pct(a, b):
    return round(100 * a / b, 1) if b else 0.0


def pctx(a, b):
    """Percentual formatado em pt-BR para textos (ex.: 51,8)."""
    return f"{pct(a, b):.1f}".replace(".", ",")


def br(v, casas=1):
    return f"{v:.{casas}f}".replace(".", ",")


def main():
    with open(os.path.join(DATA, "conversas.json"), encoding="utf-8") as f:
        conv = json.load(f)
    N = len(conv)
    for c in conv:
        c["_ts"] = datetime.fromisoformat(c["abertura"])
        c["_rota"], c["_motivos_rota"] = triar(c)
        c["_tag"] = c["tag_agente"] or "(vazia)"

    # ordem do contato dentro do mesmo pedido (recontato sobre o mesmo pedido)
    por_pedido = {}
    for c in sorted(conv, key=lambda x: x["_ts"]):
        k = c["order_id"]
        por_pedido[k] = por_pedido.get(k, 0) + 1
        c["_ordem_pedido"] = por_pedido[k]
    por_cliente = {}
    for c in conv:
        por_cliente.setdefault(c["customer_id"], []).append(c)
    for lst in por_cliente.values():
        lst.sort(key=lambda x: x["_ts"])

    custo_amostra = sum(c["custo"] for c in conv)

    # ---------------- evitáveis (definição teórica) ----------------
    def evitavel(c):
        if c["motivo"] == "Onde está meu pedido":
            return "pedido em trânsito: status já existia, push proativo"
        if c["motivo"] == "Atraso na entrega":
            return "atraso conhecido pelo sistema antes do cliente: aviso proativo com nova data"
        if c["motivo"] == "Abandono no bot":
            return "bot não resolveu: fluxo do bot/follow-up"
        if c["_ordem_pedido"] >= 2:
            return "recontato sobre o mesmo pedido: falha de resolução no 1º contato"
        return None

    for c in conv:
        c["_evitavel"] = evitavel(c)
    n_evit = sum(1 for c in conv if c["_evitavel"])

    # ---------------- motivos ----------------
    EVIT_PORQUE = {
        "Onde está meu pedido": "100% dos pedidos estavam em trânsito; o status já existia. Push proativo.",
        "Atraso na entrega": "O atraso é conhecido pela transportadora antes do cliente. Aviso proativo com nova data.",
        "Abandono no bot": "O cliente desistiu do bot e voltou depois. Melhorar fluxo + follow-up.",
    }
    motivos = []
    cont = Counter(c["motivo"] for c in conv)
    for m, n in cont.most_common():
        cs = [c for c in conv if c["motivo"] == m]
        auto = sum(1 for c in cs if c["_rota"] == "auto")
        pa = auto / n
        rota = "auto" if pa >= 0.8 else ("humano" if pa <= 0.2 else "híbrido")
        if m == "Reação adversa":
            rota = "humano"
        ev = sum(1 for c in cs if c["_evitavel"])
        motivos.append({
            "motivo": m,
            "conversas": n,
            "pct": pct(n, N),
            "custo_amostra": round(sum(c["custo"] for c in cs), 2),
            "custo_ano": round(sum(c["custo"] for c in cs) * F_ANO, 2),
            "reclame_aqui": sum(1 for c in cs if c["canal"] == "reclame_aqui"),
            "pct_recontato": pct(sum(1 for c in cs if c["recontato"]), n),
            "pct_evitavel": pct(ev, n),
            "evitavel_porque": EVIT_PORQUE.get(m, "Só os recontatos sobre o mesmo pedido (falha de resolução no 1º contato)."),
            "rota": rota,
            "_pct_auto": round(100 * pa, 1),
        })
    mot = {m["motivo"]: m for m in motivos}

    # ---------------- iniciativas ----------------
    def custo(cs):
        return sum(c["custo"] for c in cs)

    # 1. Rastreio proativo
    wismo = [c for c in conv if c["motivo"] == "Onde está meu pedido"]
    wismo_tr = sum(1 for c in wismo if (c.get("pedido") or {}).get("status_entrega") == "em_transito")
    wismo_txt = f"{wismo_tr} em trânsito e {len(wismo) - wismo_tr} já entregue(s)"
    atraso = [c for c in conv if c["motivo"] == "Atraso na entrega"]
    ev_r = len(wismo) * TX_RASTREIO_WISMO + len(atraso) * TX_RASTREIO_ATRASO
    ec_r = custo(wismo) * TX_RASTREIO_WISMO + custo(atraso) * TX_RASTREIO_ATRASO

    # 2. Abandono no bot: conversas seguintes do mesmo cliente em até 7 dias (sem WISMO/Atraso p/ não duplicar)
    aband = [c for c in conv if c["motivo"] == "Abandono no bot"]
    seguintes = set()
    for a in aband:
        for c in por_cliente[a["customer_id"]]:
            if a["_ts"] < c["_ts"] <= a["_ts"] + timedelta(days=JANELA_ABANDONO_DIAS) \
                    and c["motivo"] not in ("Onde está meu pedido", "Atraso na entrega", "Abandono no bot"):
                seguintes.add(c["id"])
    seg = [c for c in conv if c["id"] in seguintes]
    ev_a = len(seg) * TX_ABANDONO
    ec_a = custo(seg) * TX_ABANDONO

    # 3. Reclame Aqui precedido de contato anterior do mesmo cliente
    ra = [c for c in conv if c["canal"] == "reclame_aqui"]
    ra_prev = [c for c in ra if c["ordem_contato"] >= 2]
    ev_ra = len(ra_prev) * TX_RA
    ec_ra = ev_ra * (CUSTO["reclame_aqui"] - CUSTO["whatsapp"])  # vira um atendimento prioritário no WhatsApp

    # 4. Autoatendimento de reenvio/estorno/nova produção: recontatos do mesmo pedido
    auto_m = [c for c in conv if c["motivo"] in MOTIVOS_AUTO_FLUXO]
    auto_rec = [c for c in auto_m if c["_ordem_pedido"] >= 2 and c["canal"] != "reclame_aqui"]
    ev_au = len(auto_rec) * TX_AUTO_RECONTATO
    ec_au = custo(auto_rec) * TX_AUTO_RECONTATO
    auto_m_rota_auto = sum(1 for c in auto_m if c["_rota"] == "auto")

    # 5. Cosmetovigilância
    reac = [c for c in conv if c["motivo"] == "Reação adversa"]
    reac_tags = Counter(c["_tag"] for c in reac)

    # 6. PII / injeção
    pii = [c for c in conv if c["pii"]]
    inj = [c for c in conv if c["injecao_prompt"]]

    iniciativas = [
        {
            "id": "rastreio_proativo",
            "nome": "Rastreio proativo (push no WhatsApp)",
            "descricao": "Mensagem automática a cada mudança de status e, principalmente, quando a transportadora sinaliza atraso, com link de rastreio e nova data prevista.",
            "motivos": ["Onde está meu pedido", "Atraso na entrega"],
            "contatos_evitados_ano": round(ev_r * F_ANO),
            "economia_ano": round(ec_r * F_ANO, 2),
            "esforco": "baixo",
            "tipo": "evitar",
            "premissa": f"Evita {int(TX_RASTREIO_WISMO*100)}% dos {len(wismo)} 'onde está meu pedido' ({wismo_txt}) e {int(TX_RASTREIO_ATRASO*100)}% dos {len(atraso)} contatos de atraso da amostra. Não 100%: parte do público contata mesmo informado.",
            "_custo_ano_alvo": (custo(wismo) + custo(atraso)) * F_ANO, "_fator_risco": 1.2,
            "_risco_txt": "1,2: 159 Reclame Aqui vêm desses dois motivos",
        },
        {
            "id": "abandono_bot",
            "nome": "Recuperação do abandono no bot",
            "descricao": "Quando o cliente sai do bot sem resolução, enviar follow-up com o status do pedido e um atalho para humano; revisar os nós do bot onde ocorre a desistência.",
            "motivos": ["Abandono no bot"],
            "contatos_evitados_ano": round(ev_a * F_ANO),
            "economia_ano": round(ec_a * F_ANO, 2),
            "esforco": "médio",
            "tipo": "evitar",
            "premissa": f"{len(aband)} abandonos geraram {len(seg)} novas conversas do mesmo cliente em até {JANELA_ABANDONO_DIAS} dias (excluindo rastreio/atraso, já contados). Evita {int(TX_ABANDONO*100)}% delas. O custo do abandono em si não é contado como economia.",
            "_custo_ano_alvo": (custo(aband) + custo(seg)) * F_ANO, "_fator_risco": 1.0,
            "_risco_txt": "1,0: sem risco além do custo",
        },
        {
            "id": "escalonamento_recontato",
            "nome": "Escalonamento no 3º contato (prevenção de Reclame Aqui)",
            "descricao": "Cliente com 3+ contatos no período ou reaberto vai para fila humana prioritária com histórico completo, antes de migrar para o Reclame Aqui.",
            "motivos": ["Todos (recontato)"],
            "contatos_evitados_ano": round(ev_ra * F_ANO),
            "economia_ano": round(ec_ra * F_ANO, 2),
            "esforco": "baixo",
            "tipo": "humano",
            "premissa": f"{len(ra_prev)} dos {len(ra)} Reclame Aqui ({pctx(len(ra_prev), len(ra))}%) vieram de clientes que já tinham contatado antes. Evita {int(TX_RA*100)}% deles; cada um vira um atendimento prioritário no WhatsApp (economia de R$ 42,00 - R$ 4,80 = R$ 37,20). Não conta o ganho reputacional.",
            "_custo_ano_alvo": custo(ra_prev) * F_ANO, "_fator_risco": 1.5,
            "_risco_txt": "1,5: resposta pública, dano reputacional",
        },
        {
            "id": "autoatendimento_agente",
            "nome": "Reenvio, estorno e nova produção automáticos via agente",
            "descricao": "O agente confere a política (foto, prazo de 7 dias, valor) e já aprova reenvio, estorno ou nova produção no 1º contato, sem fila.",
            "motivos": MOTIVOS_AUTO_FLUXO,
            "contatos_evitados_ano": round(ev_au * F_ANO),
            "economia_ano": round(ec_au * F_ANO, 2),
            "esforco": "médio",
            "tipo": "automatizar",
            "premissa": f"Dos {len(auto_m)} contatos desses motivos, {len(auto_rec)} são recontatos sobre o mesmo pedido (fora RA). Resolver no 1º contato evita {int(TX_AUTO_RECONTATO*100)}% deles. O custo do 1º contato é mantido (não assumimos que a automação o torna gratuito).",
            "_custo_ano_alvo": custo(auto_m) * F_ANO, "_fator_risco": 1.0,
            "_risco_txt": "1,0: risco financeiro coberto pelo teto de R$ 300 para humano",
        },
        {
            "id": "cosmetovigilancia",
            "nome": "Tag e protocolo de cosmetovigilância",
            "descricao": "Criar a tag 'Reação adversa', detectar por palavras-chave/IA, orientar a suspensão do uso, abrir o protocolo (produto, lote, descrição, fotos) em até 24h e acionar a responsável técnica.",
            "motivos": ["Reação adversa"],
            "contatos_evitados_ano": 0,
            "economia_ano": 0.0,
            "esforco": "baixo",
            "tipo": "risco",
            "premissa": f"{len(reac)} casos na amostra (~{len(reac)*F_ANO}/ano), 0 com tag própria; foram marcados como {', '.join(f'{k} ({v})' for k, v in reac_tags.most_common())}. O valor é conformidade sanitária e segurança do consumidor, não economia: não contamos R$.",
            "_custo_ano_alvo": custo(reac) * F_ANO, "_fator_risco": None,
            "_risco_txt": "gate regulatório: obrigação legal com prazo de 24h, entra antes do score",
        },
        {
            "id": "higiene_pii_injecao",
            "nome": "Higiene de PII e defesa contra prompt injection",
            "descricao": "Mascarar CPF, cartão e telefone antes de qualquer LLM ou log; orientar o cliente a não enviar dados de cartão; mensagens que tentam instruir a IA vão para humano.",
            "motivos": ["Todos"],
            "contatos_evitados_ano": 0,
            "economia_ano": 0.0,
            "esforco": "baixo",
            "tipo": "risco",
            "premissa": f"{len(pii)} conversas ({pctx(len(pii), N)}%) com PII em texto aberto e {len(inj)} tentativas de instruir a IA na amostra. Valor é LGPD/fraude; não contamos R$.",
            "_custo_ano_alvo": custo(pii) * F_ANO, "_fator_risco": 1.5,
            "_risco_txt": "1,5: LGPD (dado de cartão em texto) e fraude via injeção",
        },
    ]

    # ---------------- ranking ----------------
    criterio = ("score = custo_ano dos contatos-alvo (R$, amostra x 12) x fator_risco / peso do esforço "
                "(baixo = 1, médio = 2, alto = 3). fator_risco: 1,0 só custo; 1,2 gera Reclame Aqui; "
                "1,5 reputacional/LGPD. Obrigações regulatórias com prazo legal (cosmetovigilância, 24h) "
                "são um gate: entram em 1º lugar independentemente do score, porque o custo de não cumprir "
                "não é medido em R$ por conversa.")
    rank = []
    for i in iniciativas:
        if i["_fator_risco"] is None:
            continue
        sc = i["_custo_ano_alvo"] * i["_fator_risco"] / ESFORCO_PESO[i["esforco"]]
        rank.append((sc, i))
    rank.sort(key=lambda t: -t[0])
    cosm = next(i for i in iniciativas if i["id"] == "cosmetovigilancia")
    ranking = [{
        "posicao": 1,
        "motivo_ou_iniciativa": cosm["nome"],
        "score": None,
        "custo_ano": round(cosm["_custo_ano_alvo"], 2),
        "fator_risco": "regulatório (gate)",
        "esforco": cosm["esforco"],
        "justificativa": f"{len(reac)} reações adversas na amostra (~{len(reac)*F_ANO}/ano) sem registro de cosmetovigilância e sem tag própria. Obrigação com prazo de 24h; esforço baixo (tag + regex + protocolo já existem no agente).",
    }]
    for pos, (sc, i) in enumerate(rank, start=2):
        ranking.append({
            "posicao": pos,
            "motivo_ou_iniciativa": i["nome"],
            "score": round(sc),
            "custo_ano": round(i["_custo_ano_alvo"], 2),
            "fator_risco": i["_risco_txt"].split(":")[0],
            "esforco": i["esforco"],
            "justificativa": f"Contatos-alvo custam {brl0(i['_custo_ano_alvo'])}/ano; economia conservadora {brl0(i['economia_ano'])}/ano. Risco {i['_risco_txt']}.",
        })

    # ---------------- automação ----------------
    n_auto = sum(1 for c in conv if c["_rota"] == "auto")
    JUST = {
        "Onde está meu pedido": "Consulta de status: resposta automática com link de rastreio.",
        "Atraso na entrega": "Aviso com nova data é automático; humano se já houver 3+ contatos ou RA.",
        "Abandono no bot": "Follow-up automático; humano só se o cliente pedir.",
        "Avaria/vazamento": "Reenvio automático mediante foto em até 7 dias.",
        "Item faltante": "Reenvio automático mediante foto em até 7 dias.",
        "Erro de personalização": "Nova produção automática mediante foto em até 7 dias.",
        "Arrependimento/cancelamento": "Reembolso automático em até 7 dias; humano acima de R$ 300.",
        "Cobrança duplicada": "Estorno automático após conferência; humano acima de R$ 300.",
        "Pagamento/financeiro": "Dúvidas de pagamento automáticas; humano acima de R$ 300.",
        "Troca": "Regra objetiva (1 troca, 30 dias, até 20% usado): automática com foto.",
        "Endereço": "Automático antes da separação; após a separação, humano negocia com a transportadora.",
        "Dúvida de produto": "Base de conhecimento do produto.",
        "Promoção/cupom/brinde": "Regras do cupom/brinde; brinde faltante segue reenvio.",
        "Elogio": "Agradecimento automático.",
        "Reação adversa": "Sempre humano: cosmetovigilância em 24h e responsável técnica.",
        "Outros": "Triagem humana.",
    }
    por_motivo_auto = [{
        "motivo": m["motivo"], "rota": m["rota"],
        "justificativa": f"{JUST.get(m['motivo'], '')} ({br(m['_pct_auto'])}% das conversas caem em fluxo automático pela regra da fila.)",
    } for m in motivos]

    # ---------------- tag x motivo ----------------
    def diverge(c):
        if c["motivo"] == "Reação adversa":
            return True
        return c["motivo"] not in COMPATIVEL.get(c["_tag"], set())
    div = [c for c in conv if diverge(c)]
    pares = Counter((c["_tag"], c["motivo"]) for c in div)
    exemplos = [{"tag_agente": t, "motivo": m, "conversas": n} for (t, m), n in pares.most_common(10)]
    pct_div = pct(len(div), N)

    # ---------------- KPIs ----------------
    evit_ano = sum(i["contatos_evitados_ano"] for i in iniciativas if i["tipo"] in ("evitar", "automatizar"))
    conv_ano = sum(i["contatos_evitados_ano"] for i in iniciativas if i["tipo"] == "humano")  # RA convertidos, não eliminados
    econ_ano = sum(i["economia_ano"] for i in iniciativas)
    n_rec = sum(1 for c in conv if c["recontato"])
    n_sla = sum(1 for c in conv if c["sla_estourado"])
    kpis = {
        "conversas_amostra": N,
        "conversas_periodo": N * F_PERIODO,
        "conversas_ano": N * F_ANO,
        "custo_periodo": round(custo_amostra * F_PERIODO, 2),
        "custo_ano": round(custo_amostra * F_ANO, 2),
        "pct_evitavel": pct(n_evit, N),
        "conversas_evitaveis_ano": evit_ano,
        "economia_potencial_ano": round(econ_ano, 2),
        "reacao_adversa_amostra": len(reac),
        "reacao_adversa_sem_tag_correta": len(reac),
        "pct_tag_divergente": pct_div,
        "contatos_por_pedido": round(N * F_PERIODO / PEDIDOS_PERIODO, 3),
        "pct_recontato": pct(n_rec, N),
        "pct_sla_estourado": pct(n_sla, N),
    }

    top3 = motivos[:3]
    custo_top = sum(m["custo_amostra"] for m in motivos if m["motivo"] in ("Onde está meu pedido", "Atraso na entrega"))
    n_ra = len(ra)
    ra_custo = custo(ra)
    auto_pct = pct(n_auto, N)
    econ_by = {i["id"]: i for i in iniciativas}

    perguntas = [
        {
            "id": "por_que",
            "titulo": "Por que os clientes entram em contato?",
            "resposta_curta": f"Principalmente para saber do pedido: 'onde está meu pedido' e atraso somam {len(wismo)+len(atraso)} de {N} conversas ({pctx(len(wismo)+len(atraso), N)}%) e {brl0(custo_top*F_ANO)}/ano, e o 3º motivo é o abandono do bot ({len(aband)}).",
            "bullets": [
                f"{len(wismo)} 'onde está meu pedido' ({pctx(len(wismo), N)}%): {wismo_txt}; o status já estava disponível em todos.",
                f"{len(atraso)} atrasos ({pctx(len(atraso), N)}%), dos quais {mot['Atraso na entrega']['reclame_aqui']} já no Reclame Aqui.",
                f"{len(aband)} abandonos no bot ({pctx(len(aband), N)}%): 308 sem tag nenhuma e 151 como 'Outros'.",
                f"Pós-entrega (avaria, item faltante, troca, erro de personalização): {sum(cont[m] for m in ['Avaria/vazamento','Item faltante','Troca','Erro de personalização'])} conversas.",
                f"{br(pct_div)}% das tags manuais divergem do motivo real; a tag atual não serve para gestão.",
                f"{br(kpis['contatos_por_pedido'], 3)} conversas por pedido no período (~{round(1000*kpis['contatos_por_pedido'])} a cada 1.000 pedidos).",
            ],
            "numeros": [
                {"rotulo": "Conversas no período", "valor": n0(N*F_PERIODO), "formula": f"{N} da amostra x 3"},
                {"rotulo": "Custo anual do atendimento", "valor": brl0(custo_amostra*F_ANO), "formula": f"{brl(custo_amostra)} da amostra x 12 (WhatsApp R$ 4,80, e-mail R$ 7,20, RA R$ 42,00)"},
                {"rotulo": "Onde está meu pedido + atraso (ano)", "valor": f"{n0((len(wismo)+len(atraso))*F_ANO)} conversas / {brl0(custo_top*F_ANO)}", "formula": f"({len(wismo)} + {len(atraso)}) x 12; custo por canal x 12"},
                {"rotulo": "Reclame Aqui", "valor": f"{n_ra} ({pctx(n_ra, N)}% das conversas, {pctx(ra_custo, custo_amostra)}% do custo)", "formula": f"{n_ra} x R$ 42,00 = {brl(ra_custo)} na amostra"},
                {"rotulo": "Tags divergentes", "valor": f"{br(pct_div)}%", "formula": "tag do agente incompatível com o motivo por regras (ver mapa em scripts/insights.py)"},
            ],
            "confianca": "alta",
            "premissas": [
                "Motivo vem da classificação determinística por regras/palavras-chave sobre o texto do cliente + status do pedido (data/conversas.json).",
                "Amostra aleatória de 1/3 dos clientes: x3 = período de 90 dias, x12 = ano.",
                "Custo por conversa = custo médio do canal informado nos parâmetros.",
            ],
        },
        {
            "id": "atacar_primeiro",
            "titulo": "O que atacar primeiro?",
            "resposta_curta": f"Cosmetovigilância primeiro (gate regulatório: {len(reac)} reações adversas sem registro); depois '{ranking[1]['motivo_ou_iniciativa']}' e '{ranking[2]['motivo_ou_iniciativa']}', ambos de esforço baixo e que juntos economizam ~{brl0(econ_by['rastreio_proativo']['economia_ano'] + econ_by['escalonamento_recontato']['economia_ano'])}/ano.",
            "bullets": [f"{r['posicao']}. {r['motivo_ou_iniciativa']} (score {n0(r['score']) if r['score'] is not None else 'gate'}, esforço {r['esforco']})" for r in ranking] + [
                "Critério: custo anual dos contatos-alvo x fator de risco / esforço; obrigação legal entra antes."],
            "numeros": [
                {"rotulo": "Reações adversas", "valor": f"{len(reac)} na amostra / ~{len(reac)*F_ANO} por ano", "formula": f"{len(reac)} x 12; 0 com tag própria"},
                {"rotulo": "Custo-alvo do rastreio proativo", "valor": brl0((custo(wismo)+custo(atraso))*F_ANO), "formula": "custo das conversas 'onde está' + atraso x 12"},
                {"rotulo": "Economia do rastreio proativo", "valor": brl0(econ_by['rastreio_proativo']['economia_ano']), "formula": f"({int(TX_RASTREIO_WISMO*100)}% x {brl(custo(wismo))} + {int(TX_RASTREIO_ATRASO*100)}% x {brl(custo(atraso))}) x 12"},
                {"rotulo": "Reclame Aqui com contato prévio", "valor": f"{len(ra_prev)} de {n_ra} ({pctx(len(ra_prev), n_ra)}%)", "formula": "RA com ordem_contato >= 2"},
            ],
            "confianca": "média",
            "premissas": [criterio, "Fatores de risco e pesos de esforço são julgamento do analista, declarados para serem contestados."],
        },
        {
            "id": "evitaveis",
            "titulo": "Quais contatos poderiam ter sido evitados?",
            "resposta_curta": f"{pctx(n_evit, N)}% das conversas seriam evitáveis em tese; sendo conservador, as iniciativas evitam ~{n0(evit_ano)} conversas/ano, convertem outros ~{n0(conv_ano)} Reclame Aqui em atendimento prioritário e economizam ~{brl0(econ_ano)}/ano no total.",
            "bullets": [
                f"'Onde está meu pedido': {len(wismo)} conversas, {wismo_txt} (status disponível).",
                f"Atraso: {len(atraso)}, o atraso é conhecido antes do cliente reclamar.",
                f"Abandono no bot: {len(aband)}, e {len(seg)} novas conversas do mesmo cliente em até 7 dias.",
                f"Recontato sobre o mesmo pedido nos demais motivos: {sum(1 for c in conv if c['_evitavel'] and c['motivo'] not in ('Onde está meu pedido','Atraso na entrega','Abandono no bot'))} conversas.",
                f"{pctx(n_rec, N)}% das conversas são recontato e {pctx(len(ra_prev), n_ra)}% dos Reclame Aqui vieram depois de outro contato.",
            ] + [f"{i['nome']}: {n0(i['contatos_evitados_ano'])} contatos/ano, {brl0(i['economia_ano'])}/ano" for i in iniciativas if i["economia_ano"] > 0],
            "numeros": [
                {"rotulo": "Evitáveis em tese (amostra)", "valor": f"{n_evit} ({pctx(n_evit, N)}%)", "formula": "onde está + atraso + abandono + recontatos do mesmo pedido (sem dupla contagem)"},
                {"rotulo": "Evitáveis em tese (ano)", "valor": n0(n_evit*F_ANO), "formula": f"{n_evit} x 12"},
                {"rotulo": "Evitados de forma conservadora (ano)", "valor": n0(evit_ano), "formula": "soma das iniciativas evitar/automatizar com taxas de captura de 20% a 50%; o escalonamento (RA convertido em WhatsApp) entra só na economia, não aqui"},
                {"rotulo": "Economia conservadora (ano)", "valor": brl0(econ_ano), "formula": "soma das iniciativas; RA convertido em WhatsApp a R$ 37,20 de diferença"},
                {"rotulo": "Custo anual total", "valor": brl0(custo_amostra*F_ANO), "formula": "para comparação: economia = " + f"{pctx(econ_ano, custo_amostra*F_ANO)}% do custo"},
            ],
            "confianca": "média",
            "premissas": [
                f"Taxas de captura: rastreio {int(TX_RASTREIO_WISMO*100)}% / atraso {int(TX_RASTREIO_ATRASO*100)}% / abandono {int(TX_ABANDONO*100)}% / RA {int(TX_RA*100)}% / recontato automatizado {int(TX_AUTO_RECONTATO*100)}%. Escolhidas abaixo do teórico de propósito.",
                "Não há dupla contagem: o abandono exclui conversas seguintes de rastreio/atraso; o recontato automatizado exclui Reclame Aqui.",
                "A economia não inclui custo de implantação nem o ganho reputacional/regulatório.",
            ],
        },
        {
            "id": "automatizar",
            "titulo": "O que pode ser automatizado e o que precisa de humano?",
            "resposta_curta": f"{br(auto_pct)}% das conversas cabem em fluxo automático pela política vigente; {pctx(N-n_auto, N)}% precisam de humano (Reclame Aqui, 3+ contatos, reação adversa, valor alto, endereço após separação, injeção).",
            "bullets": [
                "Automático: rastreio, reenvio por avaria/faltante (foto, 7 dias), nova produção por erro de personalização, reembolso por arrependimento (7 dias), troca de fragrância dentro da regra, dúvidas de produto.",
                f"Humano: reação adversa ({len(reac)}), Reclame Aqui ({n_ra}), clientes com 3+ contatos ({sum(1 for c in conv if c['contatos_cliente']>=3)} conversas), pedido >= R$ 300 com impacto financeiro, endereço após separação, injeção de prompt ({len(inj)}).",
                f"Dos {len(auto_m)} contatos de reenvio/estorno/nova produção, {auto_m_rota_auto} ({pctx(auto_m_rota_auto, len(auto_m))}%) caem em fluxo automático.",
                "O agente executa a ação (consultar pedido, aprovar reenvio/estorno, abrir protocolo, escalar) e registra tudo; o humano fica com exceções.",
            ],
            "numeros": [
                {"rotulo": "Conversas automatizáveis", "valor": f"{n_auto} ({br(auto_pct)}%)", "formula": "regra de lib/triagem.ts replicada em Python"},
                {"rotulo": "Conversas para humano", "valor": f"{N-n_auto} ({pctx(N-n_auto, N)}%)", "formula": "qualquer gatilho humano"},
                {"rotulo": "Automatizáveis por ano", "valor": n0(n_auto*F_ANO), "formula": f"{n_auto} x 12"},
                {"rotulo": "Economia do autoatendimento", "valor": brl0(econ_by['autoatendimento_agente']['economia_ano']), "formula": f"{int(TX_AUTO_RECONTATO*100)}% x custo de {len(auto_rec)} recontatos do mesmo pedido x 12"},
            ],
            "confianca": "média",
            "premissas": [
                "A regra auto x humano é a da fila (lib/triagem.ts): um único gatilho humano basta para enviar a conversa ao humano.",
                "Fotos e prazos são conferidos pelo agente; a regra não verifica se a foto foi enviada.",
                "Automatizar não zera o custo do 1º contato; a economia contada vem só dos recontatos evitados.",
            ],
        },
    ]

    for i in iniciativas:
        for k in [k for k in i if k.startswith("_")]:
            del i[k]
    for m in motivos:
        del m["_pct_auto"]

    out = {
        "gerado_em": datetime.now().isoformat(timespec="seconds"),
        "kpis": kpis,
        "perguntas": perguntas,
        "motivos": motivos,
        "ranking_atacar": ranking,
        "criterio_ranking": criterio,
        "iniciativas": iniciativas,
        "automacao": {"auto_pct": auto_pct, "humano_pct": round(100 - auto_pct, 1), "por_motivo": por_motivo_auto},
        "tag_vs_motivo": {"pct_divergente": pct_div, "exemplos": exemplos},
    }
    with open(os.path.join(DATA, "insights.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    # ---------------- markdown ----------------
    L = []
    L.append("## Números e respostas\n")
    L.append(f"Amostra de {n0(N)} conversas (1/3 dos clientes, 90 dias). x3 = período, x12 = ano. Custo: WhatsApp R$ 4,80, e-mail R$ 7,20, Reclame Aqui R$ 42,00.\n")
    L.append("| Indicador | Valor |\n| --- | --- |")
    L += [
        f"| Conversas no período / ano | {n0(kpis['conversas_periodo'])} / {n0(kpis['conversas_ano'])} |",
        f"| Custo no período / ano | {brl0(kpis['custo_periodo'])} / {brl0(kpis['custo_ano'])} |",
        f"| Conversas por pedido | {br(kpis['contatos_por_pedido'], 3)} |",
        f"| Evitáveis em tese | {br(kpis['pct_evitavel'])}% |",
        f"| Evitadas (conservador) / economia por ano | {n0(evit_ano)} / {brl0(econ_ano)} |",
        f"| Recontato / SLA estourado | {br(kpis['pct_recontato'])}% / {br(kpis['pct_sla_estourado'])}% |",
        f"| Tags manuais divergentes | {br(pct_div)}% |",
        f"| Reação adversa sem tag própria | {len(reac)} (~{len(reac)*F_ANO}/ano) |",
        "",
    ]
    for p in perguntas:
        L.append(f"### {p['titulo']}\n")
        L.append(f"**{p['resposta_curta']}** (confiança: {p['confianca']})\n")
        L += [f"- {b}" for b in p["bullets"]]
        L.append("")
    L.append("### Motivos\n")
    L.append("| Motivo | Conversas | % | Custo/ano | RA | % recontato | % evitável | Rota |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |")
    for m in motivos:
        L.append(f"| {m['motivo']} | {m['conversas']} | {br(m['pct'])}% | {brl0(m['custo_ano'])} | {m['reclame_aqui']} | {br(m['pct_recontato'])}% | {br(m['pct_evitavel'])}% | {m['rota']} |")
    L.append("\n### Iniciativas (conservador)\n")
    L.append("| Iniciativa | Tipo | Contatos evitados/ano | Economia/ano | Esforço | Premissa |\n| --- | --- | ---: | ---: | --- | --- |")
    for i in iniciativas:
        L.append(f"| {i['nome']} | {i['tipo']} | {n0(i['contatos_evitados_ano'])} | {brl0(i['economia_ano'])} | {i['esforco']} | {i['premissa']} |")
    L.append("\n### Atacar primeiro\n")
    L.append(f"Critério: {criterio}\n")
    L.append("| # | Iniciativa | Score | Custo-alvo/ano | Risco | Esforço |\n| ---: | --- | ---: | ---: | --- | --- |")
    for r in ranking:
        L.append(f"| {r['posicao']} | {r['motivo_ou_iniciativa']} | {n0(r['score']) if r['score'] is not None else 'gate'} | {brl0(r['custo_ano'])} | {r['fator_risco']} | {r['esforco']} |")
    L.append("")
    with open(os.path.join(DATA, "insights.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(L))

    print(json.dumps({"kpis": kpis, "iniciativas": [(i["id"], i["contatos_evitados_ano"], i["economia_ano"]) for i in iniciativas],
                      "ranking": [(r["posicao"], r["motivo_ou_iniciativa"], r["score"]) for r in ranking]}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
