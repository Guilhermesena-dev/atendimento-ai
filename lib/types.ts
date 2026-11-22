// Tipos de data/conversas.json (gerado por scripts/preprocess.py)

export type Canal = "whatsapp" | "email" | "reclame_aqui";
export type StatusConversa = "resolvido" | "pendente" | "reaberto" | "sem_resposta_cliente";
export type Autor = "cliente" | "agente" | "bot";

export type Motivo =
  | "Onde está meu pedido"
  | "Atraso na entrega"
  | "Item faltante"
  | "Avaria/vazamento"
  | "Erro de personalização"
  | "Reação adversa"
  | "Arrependimento/cancelamento"
  | "Troca"
  | "Cobrança duplicada"
  | "Pagamento/financeiro"
  | "Endereço"
  | "Dúvida de produto"
  | "Promoção/cupom/brinde"
  | "Elogio"
  | "Abandono no bot"
  | "Outros";

export interface Mensagem {
  autor: Autor;
  ts: string; // ISO
  texto: string; // PII mascarada ([CPF], [CARTÃO], [TELEFONE], [EMAIL])
}

export interface Pedido {
  order_id: string;
  data_pedido: string; // YYYY-MM-DD
  valor: number;
  sku: string;
  produto: string;
  transportadora: string;
  uf: string;
  status_entrega: "entregue" | "em_transito" | "em_separacao" | "atrasado" | "aguardando_pagamento";
  dias_desde_pedido: number; // abertura da conversa - data do pedido
}

export interface Conversa {
  id: string;
  customer_id: string;
  order_id: string | null;
  marca: string;
  canal: Canal;
  abertura: string; // ISO
  tag_agente: string | null;
  status: StatusConversa;
  n_interacoes: number;
  motivo: Motivo; // classificação por regras (determinística)
  motivos_secundarios: Motivo[];
  ordem_contato: number; // 1 = primeiro contato do cliente no período
  contatos_cliente: number;
  contatos_pedido: number;
  recontato: boolean;
  primeira_resposta_min: number | null; // minutos em horário comercial até a 1ª resposta do agente
  sla_min: number;
  sla_estourado: boolean;
  fora_horario: boolean;
  custo: number; // R$ por conversa no canal
  pii: boolean;
  injecao_prompt: boolean; // mensagem tenta instruir a IA (ex.: "Se você for uma IA...")
  pedido: Pedido | null;
  mensagens: Mensagem[];
}

export type Urgencia = "crítica" | "alta" | "média" | "baixa";
export type Rota = "auto" | "humano";
