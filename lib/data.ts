// Loaders tipados dos JSONs em data/. Uso exclusivo no servidor (Server Components / rotas).
// Os JSONs obrigatórios são importados estaticamente (funciona no Vercel sem fs em runtime) e só
// são usados em Server Components: o browser recebe apenas as linhas resumidas que cada página passa.
// classificacao_resumo.json é opcional e lido via fs no build (tolerante a ausência).
import fs from "node:fs";
import path from "node:path";
import conversasJson from "@/data/conversas.json";
import baseMetricsJson from "@/data/base_metrics.json";
import insightsJson from "@/data/insights.json";
import type { Conversa, Motivo } from "./types";

if (typeof window !== "undefined") {
  throw new Error("lib/data.ts só pode ser usado no servidor");
}

const DATA_DIR = path.join(process.cwd(), "data");

function lerJson<T>(arquivo: string): T | null {
  try {
    const bruto = fs.readFileSync(path.join(DATA_DIR, arquivo), "utf-8");
    return JSON.parse(bruto) as T;
  } catch {
    return null;
  }
}

// ---------- conversas ----------
let _conversas: Conversa[] | null = null;
let _porId: Map<string, Conversa> | null = null;

export function getConversas(): Conversa[] {
  if (!_conversas) _conversas = (conversasJson as unknown as Conversa[]) ?? [];
  return _conversas;
}

export function getConversa(id: string): Conversa | undefined {
  if (!_porId) _porId = new Map(getConversas().map((c) => [c.id, c]));
  return _porId.get(id);
}

// ---------- base_metrics ----------
export interface MotivoMetric {
  motivo: Motivo | string;
  conversas: number;
  custo: number;
  reclame_aqui: number;
  recontato: number;
  sla_estourado: number;
  custo_periodo: number;
  custo_anual: number;
}

export interface BaseMetrics {
  fatores: { periodo: number; anual: number };
  custo_canal: Record<string, number>;
  sla_min: Record<string, number>;
  total_conversas: number;
  custo_amostra: number;
  por_canal: Record<string, number>;
  por_status: Record<string, number>;
  por_motivo: MotivoMetric[];
  matriz_tag_x_motivo: { linhas: string[]; colunas: string[]; valores: number[][] };
  sla_estourado: number;
  recontato: number;
  injecao_prompt: number;
  conversas_com_pii: number;
  rastreio_em_transito: number;
}

export function getBaseMetrics(): BaseMetrics {
  const b = (baseMetricsJson ?? {}) as unknown as Partial<BaseMetrics>;
  return {
    fatores: b.fatores ?? { periodo: 3, anual: 12 },
    custo_canal: b.custo_canal ?? {},
    sla_min: b.sla_min ?? {},
    total_conversas: b.total_conversas ?? 0,
    custo_amostra: b.custo_amostra ?? 0,
    por_canal: b.por_canal ?? {},
    por_status: b.por_status ?? {},
    por_motivo: b.por_motivo ?? [],
    matriz_tag_x_motivo: b.matriz_tag_x_motivo ?? { linhas: [], colunas: [], valores: [] },
    sla_estourado: b.sla_estourado ?? 0,
    recontato: b.recontato ?? 0,
    injecao_prompt: b.injecao_prompt ?? 0,
    conversas_com_pii: b.conversas_com_pii ?? 0,
    rastreio_em_transito: b.rastreio_em_transito ?? 0,
  };
}

// ---------- insights (business-analyst) ----------
export interface Kpis {
  conversas_amostra?: number;
  conversas_periodo?: number;
  conversas_ano?: number;
  custo_periodo?: number;
  custo_ano?: number;
  pct_evitavel?: number;
  conversas_evitaveis_ano?: number;
  economia_potencial_ano?: number;
  reacao_adversa_amostra?: number;
  reacao_adversa_sem_tag_correta?: number;
  pct_tag_divergente?: number;
  contatos_por_pedido?: number;
  pct_recontato?: number;
  pct_sla_estourado?: number;
}

export interface NumeroPergunta {
  rotulo: string;
  valor: string | number;
  formula?: string;
}

export interface Pergunta {
  id: "por_que" | "atacar_primeiro" | "evitaveis" | "automatizar" | string;
  titulo?: string;
  resposta_curta?: string;
  bullets?: string[];
  numeros?: NumeroPergunta[];
  confianca?: string;
  premissas?: string[];
}

export interface MotivoInsight {
  motivo: string;
  conversas?: number;
  pct?: number;
  custo_amostra?: number;
  custo_ano?: number;
  reclame_aqui?: number;
  pct_recontato?: number;
  pct_evitavel?: number;
  evitavel_porque?: string;
  rota?: string;
}

export interface RankingItem {
  posicao?: number;
  motivo_ou_iniciativa: string;
  score?: number;
  custo_ano?: number;
  fator_risco?: string | number;
  esforco?: string;
  justificativa?: string;
}

export interface Iniciativa {
  id?: string;
  nome: string;
  descricao?: string;
  motivos?: string[];
  contatos_evitados_ano?: number;
  economia_ano?: number;
  esforco?: string;
  tipo?: string;
  premissa?: string;
}

export interface Insights {
  gerado_em?: string | null;
  placeholder?: boolean;
  kpis?: Kpis;
  perguntas?: Pergunta[];
  motivos?: MotivoInsight[];
  ranking_atacar?: RankingItem[];
  criterio_ranking?: string;
  iniciativas?: Iniciativa[];
  automacao?: {
    auto_pct?: number;
    humano_pct?: number;
    por_motivo?: { motivo: string; rota: string; justificativa?: string }[];
  };
  tag_vs_motivo?: {
    pct_divergente?: number;
    exemplos?: { tag_agente: string; motivo: string; conversas: number }[];
  };
}

export function getInsights(): Insights {
  return (insightsJson ?? {}) as unknown as Insights;
}

/** KPIs: usa insights.json quando disponível; completa lacunas com agregados determinísticos. */
export function getKpis(): Kpis & { fonte: Record<string, "insights" | "base_metrics" | "conversas"> } {
  const ins = getInsights().kpis ?? {};
  const b = getBaseMetrics();
  const conv = getConversas();
  const fonte: Record<string, "insights" | "base_metrics" | "conversas"> = {};
  const k: Kpis = {};

  const set = <K extends keyof Kpis>(chave: K, fallback: number | undefined, origem: "base_metrics" | "conversas") => {
    const v = ins[chave];
    if (typeof v === "number" && Number.isFinite(v)) {
      k[chave] = v;
      fonte[chave] = "insights";
    } else if (typeof fallback === "number" && Number.isFinite(fallback)) {
      k[chave] = fallback;
      fonte[chave] = origem;
    }
  };

  const total = b.total_conversas || conv.length;
  const ra = conv.filter((c) => c.motivo === "Reação adversa");

  set("conversas_amostra", total, "base_metrics");
  set("conversas_periodo", total * b.fatores.periodo, "base_metrics");
  set("conversas_ano", total * b.fatores.anual, "base_metrics");
  set("custo_periodo", b.custo_amostra * b.fatores.periodo, "base_metrics");
  set("custo_ano", b.custo_amostra * b.fatores.anual, "base_metrics");
  set("pct_evitavel", undefined, "base_metrics");
  set("conversas_evitaveis_ano", undefined, "base_metrics");
  set("economia_potencial_ano", undefined, "base_metrics");
  set("reacao_adversa_amostra", ra.length, "conversas");
  // Não existe tag "Reação adversa" na operação: toda conversa desse motivo está sem a tag correta.
  set("reacao_adversa_sem_tag_correta", ra.length, "conversas");
  set("pct_tag_divergente", undefined, "base_metrics");
  // contatos_por_pedido = conversas do período / pedidos do período (vem só do insights.json).
  set("contatos_por_pedido", undefined, "conversas");
  // Percentuais em pontos (0–100), mesma escala do insights.json.
  set("pct_recontato", total ? (100 * b.recontato) / total : undefined, "base_metrics");
  set("pct_sla_estourado", total ? (100 * b.sla_estourado) / total : undefined, "base_metrics");

  return { ...k, fonte };
}

// ---------- classificação LLM (opcional) ----------
export type ClassificacaoResumo = Record<string, unknown>;

export function getClassificacaoResumo(): ClassificacaoResumo | null {
  const r = lerJson<ClassificacaoResumo>("classificacao_resumo.json");
  if (!r || typeof r !== "object" || Object.keys(r).length === 0) return null;
  return r;
}
