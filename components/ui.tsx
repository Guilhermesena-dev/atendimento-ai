// Componentes visuais simples, sem hooks (usáveis em Server e Client Components).
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

export function SectionTitle({ titulo, sub, right }: { titulo: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
        {sub && <p className="mt-0.5 text-sm text-slate-500">{sub}</p>}
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
  const cor = tom === "alerta" ? "text-rose-700" : tom === "bom" ? "text-emerald-700" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" title={fonte ? `Fonte: ${fonte}` : undefined}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</div>
      <div className={`tabular mt-1 text-2xl font-semibold ${cor}`}>{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-slate-500">{detalhe}</div>}
    </div>
  );
}

const URG: Record<string, string> = {
  crítica: "bg-rose-600 text-white",
  alta: "bg-orange-100 text-orange-800 ring-1 ring-orange-200",
  média: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  baixa: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

export function UrgenciaBadge({ u }: { u: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${URG[u] ?? URG.baixa}`}>{u}</span>
  );
}

export function RotaBadge({ r }: { r: string }) {
  return r === "humano" ? (
    <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800 ring-1 ring-violet-200">
      Humano
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
      Automático
    </span>
  );
}

export function Pill({ children, tom = "neutro" }: { children: ReactNode; tom?: "neutro" | "alerta" | "info" | "bom" }) {
  const cls = {
    neutro: "bg-slate-100 text-slate-700 ring-slate-200",
    alerta: "bg-rose-50 text-rose-700 ring-rose-200",
    info: "bg-sky-50 text-sky-700 ring-sky-200",
    bom: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  }[tom];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>{children}</span>;
}
