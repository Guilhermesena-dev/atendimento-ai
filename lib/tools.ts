// Tools do agente (formato OpenAI/Groq) + executor.
// Leitura: consulta data/conversas.json importado estaticamente (sem fs em runtime, compatível com Vercel).
// Ações: validadas por lib/policies.ts ANTES de executar; retornam registro simulado (id, timestamp, status).
// Use apenas no servidor (route handler).
import conversasJson from "@/data/conversas.json";
import type { Conversa } from "./types";
import { POLITICAS, temFoto, temInjecao, temReacaoAdversa, motivosEscalonamento, validarAcao, type EstadoExecucao, type StatusAcao } from "./policies";

export const CONVERSAS = conversasJson as unknown as Conversa[];
const POR_ID = new Map(CONVERSAS.map((c) => [c.id, c]));

export function getConversa(id: string): Conversa | undefined {
  return POR_ID.get(id);
}
/** Trocas já feitas no mesmo pedido em outras conversas (tag Troca + resolvido): proxy de "1 troca por pedido". */
export function trocasAnterioresPedido(c: Conversa): number {
  if (!c.order_id) return 0;
  return CONVERSAS.filter((x) => x.order_id === c.order_id && x.id !== c.id && x.tag_agente === "Troca" && x.status === "resolvido").length;
}

const PREFIXO_SEGURANCA = "Por favor, suspenda o uso do produto imediatamente. ";

export function getConversaPorPedido(orderId: string): Conversa | undefined {
  return CONVERSAS.find((c) => c.order_id === orderId);
}

type Schema = Record<string, unknown>;
const fn = (name: string, description: string, properties: Schema, required: string[] = []) => ({
  type: "function" as const,
  function: { name, description, parameters: { type: "object", properties, required } },
});

export const TOOL_DEFS = [
  fn("consultar_pedido", "Consulta status de entrega, transportadora, valor, produto e dias desde o pedido. Chame SEMPRE antes de qualquer ação.", {
    order_id: { type: "string", description: "ID do pedido da conversa" },
  }, ["order_id"]),
  fn("consultar_politica", "Retorna o texto da política vigente para um tema.", {
    tema: {
      type: "string",
      enum: ["arrependimento", "avaria", "item_faltante", "troca_fragrancia", "cobranca_duplicada", "reacao_adversa", "endereco", "personalizacao", "rastreio", "escalonamento"],
    },
  }, ["tema"]),
  fn("historico_cliente", "Lista os contatos anteriores do cliente no período (recontato).", {}),
  fn("abrir_protocolo_cosmetovigilancia", "Registra protocolo de cosmetovigilância (obrigatório em reação adversa, prazo 24h) e encaminha à responsável técnica.", {
    produto: { type: "string" },
    lote: { type: "string", description: "Lote, se informado; senão 'a coletar'" },
    descricao: { type: "string", description: "Sintomas relatados e quem usou" },
    fotos_recebidas: { type: "boolean" },
  }, ["produto", "descricao"]),
  fn("aprovar_reenvio", "Aprova reenvio sem custo (avaria, vazamento, item faltante) ou troca de fragrância.", {
    order_id: { type: "string" },
    motivo: { type: "string", enum: ["avaria", "vazamento", "item_faltante", "troca_fragrancia"] },
    percentual_usado: { type: "number", description: "Só para troca_fragrancia: % do produto já usado, informado pelo cliente" },
    observacao: { type: "string" },
  }, ["order_id", "motivo"]),
  fn("aprovar_estorno", "Aprova estorno/reembolso: arrependimento (reembolso integral) ou cobrança duplicada.", {
    order_id: { type: "string" },
    valor: { type: "number", description: "Valor em R$, nunca acima do valor do pedido" },
    motivo: { type: "string", enum: ["arrependimento", "cobranca_duplicada", "outro"] },
  }, ["order_id", "valor", "motivo"]),
  fn("solicitar_nova_producao", "Nova produção sem custo para erro de personalização Gocase.", {
    order_id: { type: "string" },
    descricao_erro: { type: "string" },
  }, ["order_id", "descricao_erro"]),
  fn("alterar_endereco", "Altera o endereço de entrega (só antes da separação).", {
    order_id: { type: "string" },
    novo_endereco: { type: "string" },
  }, ["order_id", "novo_endereco"]),
  fn("enviar_resposta", "Envia a resposta final ao cliente (em PT-BR, tom da marca). Em casos escalonados vira rascunho para o humano.", {
    texto: { type: "string" },
  }, ["texto"]),
  fn("escalar_humano", "Encaminha para atendente humano com rascunho de resposta pronto.", {
    motivo: { type: "string" },
    prioridade: { type: "string", enum: ["crítica", "alta", "média"] },
    rascunho_resposta: { type: "string" },
    suspeita_fraude: { type: "boolean" },
  }, ["motivo", "prioridade", "rascunho_resposta"]),
];

export const TOOLS_DE_ACAO = new Set([
  "abrir_protocolo_cosmetovigilancia",
  "aprovar_reenvio",
  "aprovar_estorno",
  "solicitar_nova_producao",
  "alterar_endereco",
  "enviar_resposta",
  "escalar_humano",
]);

export interface AcaoExecutada {
  id: string;
  tool: string;
  status: StatusAcao;
  motivo_politica: string;
  timestamp: string;
  args: Record<string, unknown>;
  detalhes?: Record<string, unknown>;
  origem: "agente" | "guard-rail";
}

const PREFIXO: Record<string, string> = {
  abrir_protocolo_cosmetovigilancia: "CVG",
  aprovar_reenvio: "REE",
  aprovar_estorno: "EST",
  solicitar_nova_producao: "NPR",
  alterar_endereco: "END",
  enviar_resposta: "MSG",
  escalar_humano: "ESC",
};
function novoId(tool: string) {
  return `${PREFIXO[tool] ?? "ACT"}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, "0")}`;
}

function resumoPedido(c: Conversa) {
  const p = c.pedido!;
  const prazo: Record<string, string> = {
    entregue: "Pedido consta como entregue.",
    em_transito: `Em trânsito com ${p.transportadora}.`,
    em_separacao: "Em separação no centro de distribuição.",
    atrasado: `Atrasado na transportadora ${p.transportadora}.`,
    aguardando_pagamento: "Aguardando confirmação de pagamento.",
  };
  return {
    ...p,
    marca: c.marca,
    resumo: prazo[p.status_entrega],
    dentro_janela_7_dias: p.dias_desde_pedido <= 7,
    dentro_janela_30_dias: p.dias_desde_pedido <= 30,
    obs_janela: "dias_desde_pedido é proxy conservador do recebimento (data de recebimento não disponível).",
    cliente_enviou_foto: temFoto(c),
    valor_alto: p.valor >= 300,
  };
}

export interface ResultadoTool {
  resultado: unknown;
  bloqueado: boolean;
  acao?: AcaoExecutada;
}

export function executarTool(
  tool: string,
  args: Record<string, unknown>,
  c: Conversa,
  estado: EstadoExecucao,
  origem: "agente" | "guard-rail" = "agente",
): ResultadoTool {
  // Tipos especiais de mensagem (aviso de segurança, confirmação de recebimento) são exclusivos dos guard-rails:
  // o modelo não pode usá-los para contornar o rascunho obrigatório.
  if (origem === "agente" && "tipo" in args) {
    const { tipo: _ignorado, ...resto } = args; // eslint-disable-line @typescript-eslint/no-unused-vars
    args = resto;
  }
  // Reação adversa: todo texto ao cliente precisa conter a orientação de suspender o uso.
  if (temReacaoAdversa(c)) {
    const campo = tool === "enviar_resposta" ? "texto" : tool === "escalar_humano" ? "rascunho_resposta" : null;
    if (campo && !/suspend/i.test(String(args[campo] ?? ""))) args = { ...args, [campo]: PREFIXO_SEGURANCA + String(args[campo] ?? "") };
  }
  const v = validarAcao(tool, args, c, estado);

  // Leituras
  if (!TOOLS_DE_ACAO.has(tool)) {
    if (v.status === "bloqueado") return { resultado: { erro: v.motivo }, bloqueado: true };
    if (tool === "consultar_pedido") return { resultado: resumoPedido(c), bloqueado: false };
    if (tool === "consultar_politica") {
      const tema = String(args.tema ?? "");
      return { resultado: { tema, politica: POLITICAS[tema] ?? "Tema não encontrado. Temas: " + Object.keys(POLITICAS).join(", ") }, bloqueado: false };
    }
    if (tool === "historico_cliente") {
      const hist = CONVERSAS.filter((x) => x.customer_id === c.customer_id && x.id !== c.id).map((x) => ({
        id: x.id,
        abertura: x.abertura,
        canal: x.canal,
        motivo: x.motivo,
        status: x.status,
        order_id: x.order_id,
        ultima_msg_cliente: [...x.mensagens].reverse().find((m) => m.autor === "cliente")?.texto.slice(0, 160) ?? null,
      }));
      return {
        resultado: {
          contatos_no_periodo: c.contatos_cliente,
          contatos_neste_pedido: c.contatos_pedido,
          recontato: c.recontato,
          escalonamento_obrigatorio: motivosEscalonamento(c),
          conversas_anteriores: hist.slice(0, 8),
        },
        bloqueado: false,
      };
    }
  }

  // Ações (simuladas)
  const acao: AcaoExecutada = {
    id: novoId(tool),
    tool,
    status: v.status,
    motivo_politica: v.motivo,
    timestamp: new Date().toISOString(),
    args,
    origem,
  };
  if (v.status !== "bloqueado") {
    if (tool === "abrir_protocolo_cosmetovigilancia")
      acao.detalhes = { prazo_registro: "24h", encaminhado_para: "Responsável técnica (cosmetovigilância)", pedido: c.order_id, sku: c.pedido?.sku };
    if (tool === "aprovar_reenvio") acao.detalhes = { custo_cliente: 0, transportadora: c.pedido?.transportadora };
    if (tool === "aprovar_estorno")
      acao.detalhes = { prazo: "até 2 faturas (cartão) ou 5 dias úteis (pix)", valor_pedido: c.pedido?.valor };
    if (tool === "escalar_humano")
      acao.detalhes = {
        fila: temReacaoAdversa(c) ? "Responsável técnica + SAC sênior" : temInjecao(c) ? "Prevenção a fraude" : "SAC sênior",
        canal: c.canal,
        motivos_obrigatorios: motivosEscalonamento(c),
        suspeita_fraude: temInjecao(c) || args.suspeita_fraude === true,
      };
  }
  estado.acoes.push({ tool, status: v.status, args });
  return {
    resultado: { id: acao.id, status: v.status, motivo: v.motivo, timestamp: acao.timestamp, ...(acao.detalhes ?? {}) },
    bloqueado: v.status === "bloqueado",
    acao,
  };
}
