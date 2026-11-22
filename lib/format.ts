// Formatação PT-BR compartilhada (server e client).
const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl0Fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("pt-BR");
const dec1Fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function brl(v: number | null | undefined, inteiro = false): string {
  if (!isNum(v)) return "—";
  return inteiro ? brl0Fmt.format(v) : brlFmt.format(v);
}

/** Moeda compacta: R$ 1,2 mi / R$ 350 mil */
export function brlCompacto(v: number | null | undefined): string {
  if (!isNum(v)) return "—";
  if (Math.abs(v) >= 1_000_000) return `R$ ${dec1Fmt.format(v / 1_000_000)} mi`;
  if (Math.abs(v) >= 10_000) return `R$ ${numFmt.format(Math.round(v / 1000))} mil`;
  return brl0Fmt.format(v);
}

export function num(v: number | null | undefined): string {
  if (!isNum(v)) return "—";
  return numFmt.format(Math.round(v * 100) / 100);
}

/** Percentual já em pontos (0–100), como nos JSONs: pct(51.8) → "51,8%". */
export function pct(v: number | null | undefined): string {
  if (!isNum(v)) return "—";
  return `${dec1Fmt.format(v)}%`;
}

/** Fração (0–1): pctFrac(0.518) → "51,8%". */
export function pctFrac(v: number | null | undefined): string {
  if (!isNum(v)) return "—";
  return pct(v * 100);
}

export function minutos(v: number | null | undefined): string {
  if (!isNum(v)) return "—";
  if (v < 60) return `${Math.round(v)} min`;
  if (v <= 2880) return `${dec1Fmt.format(v / 60)} h`;
  return `${dec1Fmt.format(v / 1440)} d`;
}

// Datas do dataset vêm sem fuso (horário local da operação): formatamos pela string para não deslocar.
export function dataHora(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}

export function data(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export const CANAL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  reclame_aqui: "Reclame Aqui",
};

export const STATUS_LABEL: Record<string, string> = {
  resolvido: "Resolvido",
  pendente: "Pendente",
  reaberto: "Reaberto",
  sem_resposta_cliente: "Sem resposta do cliente",
};

export const ENTREGA_LABEL: Record<string, string> = {
  entregue: "Entregue",
  em_transito: "Em trânsito",
  em_separacao: "Em separação",
  atrasado: "Atrasado",
  aguardando_pagamento: "Aguardando pagamento",
};
