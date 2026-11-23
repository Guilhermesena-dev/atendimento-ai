// Componentes visuais simples, sem hooks (usáveis em Server e Client Components).
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-line bg-surface p-5 ${className}`}>{children}</section>;
}

export function SectionTitle({ titulo, sub, right }: { titulo: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Kpi({
  rotulo,
  valor,
  detalhe,
  tom = "neutro",
  fonte,
}: {
  rotulo: string;
  valor: string;
  detalhe?: ReactNode;
  tom?: "neutro" | "alerta" | "bom";
  fonte?: string;
}) {
  const cor = tom === "alerta" ? "text-red-700" : tom === "bom" ? "text-emerald-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-line bg-surface p-4" title={fonte ? `Fonte: ${fonte}` : undefined}>
      <div className="text-xs font-medium text-muted">{rotulo}</div>
      <div className={`tabular mt-1 text-2xl font-semibold ${cor}`}>{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-muted">{detalhe}</div>}
    </div>
  );
}

/** Escala semântica de urgência: cor + ponto + rótulo (nunca só cor). */
export const URGENCIA = {
  crítica: { badge: "bg-red-700 text-white", barra: "bg-red-600", texto: "text-red-700", ponto: "bg-white" },
  alta: { badge: "bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-300", barra: "bg-orange-500", texto: "text-orange-800", ponto: "bg-orange-500" },
  média: { badge: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-300", barra: "bg-amber-400", texto: "text-amber-900", ponto: "bg-amber-400" },
  baixa: { badge: "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-300", barra: "bg-slate-300", texto: "text-slate-600", ponto: "bg-slate-400" },
} as const;

export function urg(u: string) {
  return URGENCIA[u as keyof typeof URGENCIA] ?? URGENCIA.baixa;
}

export function UrgenciaBadge({ u }: { u: string }) {
  const e = urg(u);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold capitalize ${e.badge}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${e.ponto}`} />
      {u}
    </span>
  );
}

export function RotaBadge({ r }: { r: string }) {
  return r === "humano" ? (
    <span className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white" /> Humano
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-600">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full border border-emerald-700" /> Automático
    </span>
  );
}

export function Pill({ children, tom = "neutro" }: { children: ReactNode; tom?: "neutro" | "alerta" | "info" | "bom" | "aviso" }) {
  const cls = {
    neutro: "bg-slate-50 text-slate-700 ring-slate-300",
    alerta: "bg-red-50 text-red-800 ring-red-300",
    aviso: "bg-amber-50 text-amber-900 ring-amber-300",
    info: "bg-sky-50 text-sky-800 ring-sky-300",
    bom: "bg-emerald-50 text-emerald-800 ring-emerald-300",
  }[tom];
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>{children}</span>;
}
