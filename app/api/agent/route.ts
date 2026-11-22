// POST /api/agent
// Body: { conversationId } | { conversationId, novaMensagem } | { mensagemLivre, orderId? }
import { NextResponse } from "next/server";
import { rodarAgente } from "@/lib/agent";
import { getConversa, getConversaPorPedido } from "@/lib/tools";
import type { Conversa } from "@/lib/types";
import { RE_INJECAO, classificarMotivoTexto } from "@/lib/policies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Rate limit simples em memória (por instância): 8 execuções por minuto por IP
// e um teto global de 40/min por instância (protege a cota da Groq mesmo com IPs forjados).
const JANELA_MS = 60_000;
const LIMITE = 8;
const LIMITE_GLOBAL = 40;
const hits = new Map<string, number[]>();
let globais: number[] = [];

function limitado(ip: string): boolean {
  const agora = Date.now();
  globais = globais.filter((t) => agora - t < JANELA_MS);
  if (globais.length >= LIMITE_GLOBAL) return true;
  const lista = (hits.get(ip) ?? []).filter((t) => agora - t < JANELA_MS);
  if (lista.length >= LIMITE) {
    hits.set(ip, lista);
    return true;
  }
  lista.push(agora);
  globais.push(agora);
  hits.set(ip, lista);
  if (hits.size > 5000) {
    // remove só as entradas expiradas (não zera o mapa)
    for (const [k, v] of hits) if (!v.some((t) => agora - t < JANELA_MS)) hits.delete(k);
  }
  return false;
}

// Na Vercel, x-real-ip é definido pela plataforma; no x-forwarded-for, o último salto é o anexado pelo proxy confiável.
function ipCliente(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return xff[xff.length - 1] || "local";
}

const MAX_MSG = 2000;

/** Mensagem nova: recalcula dias desde o pedido, motivo e flags; nada fica congelado na abertura.
 * "Hoje" = data de extração da base (30/09/2026): os dados são um retrato dessa data, então as janelas de 7/30 dias são avaliadas nela. */
function atualizarComMensagem(c: Conversa, texto: string): Conversa {
  const hoje = new Date("2026-09-30T12:00:00");
  const pedido = c.pedido
    ? {
        ...c.pedido,
        dias_desde_pedido: Math.max(0, Math.floor((hoje.getTime() - new Date(c.pedido.data_pedido + "T00:00:00").getTime()) / 86_400_000)),
      }
    : null;
  const novoMotivo = classificarMotivoTexto(texto, c.marca);
  const motivo = novoMotivo ?? c.motivo;
  return {
    ...c,
    pedido,
    motivo,
    motivos_secundarios: novoMotivo && novoMotivo !== c.motivo ? [c.motivo, ...c.motivos_secundarios.filter((m) => m !== novoMotivo)] : c.motivos_secundarios,
    injecao_prompt: c.injecao_prompt || RE_INJECAO.test(texto),
  };
}

function comNovaMensagem(c: Conversa, texto: string): Conversa {
  return atualizarComMensagem(
    { ...c, status: "reaberto", mensagens: [...c.mensagens, { autor: "cliente", ts: new Date().toISOString().slice(0, 19), texto }] },
    texto,
  );
}

function conversaLivre(texto: string, orderId?: string): Conversa {
  const base = orderId ? getConversaPorPedido(orderId) : undefined;
  const agora = new Date().toISOString().slice(0, 19);
  const base0: Conversa = {
    id: "LIVRE",
    customer_id: base?.customer_id ?? "CL-NOVO",
    order_id: base?.order_id ?? null,
    marca: base?.marca ?? "Gocase",
    canal: "whatsapp",
    abertura: agora,
    tag_agente: null,
    status: "pendente",
    n_interacoes: 1,
    motivo: "Outros",
    motivos_secundarios: [],
    ordem_contato: (base?.contatos_cliente ?? 0) + 1,
    contatos_cliente: (base?.contatos_cliente ?? 0) + 1,
    contatos_pedido: (base?.contatos_pedido ?? 0) + 1,
    recontato: !!base,
    primeira_resposta_min: null,
    sla_min: 30,
    sla_estourado: false,
    fora_horario: false,
    custo: 4.8,
    pii: false,
    injecao_prompt: false,
    pedido: base?.pedido ?? null,
    mensagens: [{ autor: "cliente", ts: agora, texto }],
  };
  return atualizarComMensagem(base0, texto);
}

export async function POST(req: Request) {
  const ip = ipCliente(req);
  if (limitado(ip))
    return NextResponse.json({ erro: "Muitas execuções seguidas. Aguarde 1 minuto e tente de novo." }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const conversationId = typeof body.conversationId === "string" ? body.conversationId : undefined;
  const novaMensagem = typeof body.novaMensagem === "string" ? body.novaMensagem.trim().slice(0, MAX_MSG) : "";
  const mensagemLivre = typeof body.mensagemLivre === "string" ? body.mensagemLivre.trim().slice(0, MAX_MSG) : "";
  const orderId = typeof body.orderId === "string" ? body.orderId : undefined;

  let conversa: Conversa | undefined;
  let identidadeVerificada = true;
  if (conversationId) {
    conversa = getConversa(conversationId);
    if (!conversa) return NextResponse.json({ erro: `Conversa ${conversationId} não encontrada.` }, { status: 404 });
    if (novaMensagem) conversa = comNovaMensagem(conversa, novaMensagem);
  } else if (mensagemLivre) {
    conversa = conversaLivre(mensagemLivre, orderId);
    identidadeVerificada = false; // sem login/verificação: só leitura e escalonamento
  } else {
    return NextResponse.json({ erro: "Informe conversationId ou mensagemLivre." }, { status: 400 });
  }

  try {
    const r = await rodarAgente(conversa, { identidadeVerificada });
    return NextResponse.json(r);
  } catch (e) {
    console.error("[api/agent]", e instanceof Error ? e.message : e);
    return NextResponse.json({ erro: "Não foi possível executar o agente agora. Tente novamente em instantes." }, { status: 500 });
  }
}
