// Triagem determinística: urgência, rota (auto x humano) e score de prioridade da fila.
// Usada pela /fila e como contexto inicial do agente. Funções puras, sem I/O.
import type { Conversa, Rota, Urgencia } from "./types";
import { CONTATOS_ESCALONAMENTO, motivosEscalonamento, temInjecao, temReacaoAdversa } from "./policies";

// Rota derivada do mesmo motor de políticas usado pelo agente (fonte única de verdade).

export interface Triagem {
  urgencia: Urgencia;
  rota: Rota;
  motivos_rota: string[]; // por que foi para humano (ou "fluxo automático")
  score: number; // maior = atender antes
}

export function triar(c: Conversa): Triagem {
  const motivos = motivosEscalonamento(c);
  const rota: Rota = motivos.length ? "humano" : "auto";
  if (rota === "auto") motivos.push("Fluxo automático coberto pela política");
  const reacao = temReacaoAdversa(c);

  let urgencia: Urgencia = "baixa";
  if (reacao) urgencia = "crítica";
  else if (c.canal === "reclame_aqui" || c.contatos_cliente >= CONTATOS_ESCALONAMENTO || temInjecao(c)) urgencia = "alta";
  else if (
    c.sla_estourado ||
    c.status === "reaberto" ||
    ["Atraso na entrega", "Avaria/vazamento", "Item faltante", "Erro de personalização", "Cobrança duplicada"].includes(c.motivo)
  )
    urgencia = "média";

  const peso: Record<Urgencia, number> = { crítica: 1000, alta: 300, média: 100, baixa: 0 };
  const score =
    peso[urgencia] +
    c.custo + // R$ do canal (RA pesa 42)
    Math.min(c.contatos_cliente, 6) * 10 +
    (c.sla_estourado ? 25 : 0) +
    (c.status === "reaberto" ? 20 : 0);

  return { urgencia, rota, motivos_rota: motivos, score: Math.round(score) };
}
