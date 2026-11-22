"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CANAL_LABEL, ENTREGA_LABEL, dataHora, minutos, num } from "@/lib/format";
import { RotaBadge, UrgenciaBadge } from "@/components/ui";

export interface LinhaFila {
  id: string;
  abertura: string;
  status: string;
  canal: string;
  marca: string;
  motivo: string;
  urgencia: string;
  rota: string;
  motivo_rota: string;
  score: number;
  contatos_cliente: number;
  primeira_resposta_min: number | null;
  sla_min: number;
  sla_estourado: boolean;
  status_entrega: string | null;
}

type Chave = "score" | "abertura" | "contatos_cliente" | "primeira_resposta_min" | "motivo" | "canal";
const ORDEM_URG: Record<string, number> = { crítica: 0, alta: 1, média: 2, baixa: 3 };
const POR_PAGINA = 50;

export default function FilaTable({ linhas }: { linhas: LinhaFila[] }) {
  const [urg, setUrg] = useState("");
  const [rota, setRota] = useState("");
  const [canal, setCanal] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<{ k: Chave; desc: boolean }>({ k: "score", desc: true });
  const [limite, setLimite] = useState(POR_PAGINA);

  const opcoes = useMemo(
    () => ({
      urg: [...new Set(linhas.map((l) => l.urgencia))].sort((a, b) => (ORDEM_URG[a] ?? 9) - (ORDEM_URG[b] ?? 9)),
      canal: [...new Set(linhas.map((l) => l.canal))].sort(),
      motivo: [...new Set(linhas.map((l) => l.motivo))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    }),
    [linhas],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const r = linhas.filter(
      (l) =>
        (!urg || l.urgencia === urg) &&
        (!rota || l.rota === rota) &&
        (!canal || l.canal === canal) &&
        (!motivo || l.motivo === motivo) &&
        (!q || l.id.toLowerCase().includes(q) || l.marca.toLowerCase().includes(q)),
    );
    const s = ordem.desc ? -1 : 1;
    return [...r].sort((a, b) => {
      const va = a[ordem.k];
      const vb = b[ordem.k];
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * s;
      return String(va).localeCompare(String(vb), "pt-BR") * s;
    });
  }, [linhas, urg, rota, canal, motivo, busca, ordem]);

  const auto = filtradas.filter((l) => l.rota === "auto").length;

  const reset = () => setLimite(POR_PAGINA);

  const th = (k: Chave, rotulo: string) => (
    <button
      type="button"
      onClick={() => setOrdem((o) => ({ k, desc: o.k === k ? !o.desc : true }))}
      className="inline-flex items-center gap-1 font-medium hover:text-slate-900"
    >
      {rotulo}
      <span className="text-[10px]">{ordem.k === k ? (ordem.desc ? "▼" : "▲") : "↕"}</span>
    </button>
  );

  const sel = "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
        <select
          aria-label="Urgência"
          className={sel}
          value={urg}
          onChange={(e) => {
            setUrg(e.target.value);
            reset();
          }}
        >
          <option value="">Todas as urgências</option>
          {opcoes.urg.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          aria-label="Rota"
          className={sel}
          value={rota}
          onChange={(e) => {
            setRota(e.target.value);
            reset();
          }}
        >
          <option value="">Automático e humano</option>
          <option value="auto">Automático</option>
          <option value="humano">Humano</option>
        </select>
        <select
          aria-label="Canal"
          className={sel}
          value={canal}
          onChange={(e) => {
            setCanal(e.target.value);
            reset();
          }}
        >
          <option value="">Todos os canais</option>
          {opcoes.canal.map((o) => (
            <option key={o} value={o}>
              {CANAL_LABEL[o] ?? o}
            </option>
          ))}
        </select>
        <select
          aria-label="Motivo"
          className={sel}
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            reset();
          }}
        >
          <option value="">Todos os motivos</option>
          {opcoes.motivo.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <input
          aria-label="Buscar"
          placeholder="Buscar ID ou marca"
          className={`${sel} w-44`}
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            reset();
          }}
        />
        <div className="text-sm text-slate-600 sm:ml-auto">
          <b className="text-slate-900">{num(filtradas.length)}</b> conversas ·{" "}
          <span className="text-emerald-700">{num(auto)} automáticas</span> ·{" "}
          <span className="text-violet-700">{num(filtradas.length - auto)} humanas</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">{th("score", "Urgência / score")}</th>
              <th className="px-3 py-2">{th("canal", "Canal")}</th>
              <th className="px-3 py-2 font-medium">Marca</th>
              <th className="px-3 py-2">{th("motivo", "Motivo")}</th>
              <th className="px-3 py-2 font-medium">Rota</th>
              <th className="px-3 py-2">{th("contatos_cliente", "Contatos")}</th>
              <th className="px-3 py-2">{th("primeira_resposta_min", "1ª resposta / SLA")}</th>
              <th className="px-3 py-2 font-medium">Pedido</th>
              <th className="px-3 py-2">{th("abertura", "Abertura")}</th>
              <th className="px-3 py-2">
                <span className="sr-only">Ação</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtradas.slice(0, limite).map((l) => (
              <tr key={l.id} className={`hover:bg-slate-50 ${l.urgencia === "crítica" ? "bg-rose-50/60" : ""}`}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <UrgenciaBadge u={l.urgencia} />
                    <span className="tabular text-xs text-slate-400">{l.score}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-700">{CANAL_LABEL[l.canal] ?? l.canal}</td>
                <td className="px-3 py-2 text-slate-700">{l.marca}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{l.motivo}</td>
                <td className="px-3 py-2" title={l.motivo_rota}>
                  <RotaBadge r={l.rota} />
                </td>
                <td className={`tabular px-3 py-2 ${l.contatos_cliente >= 3 ? "font-semibold text-rose-700" : "text-slate-700"}`}>
                  {l.contatos_cliente}
                </td>
                <td className="tabular whitespace-nowrap px-3 py-2">
                  <span className={l.sla_estourado ? "font-semibold text-rose-700" : "text-slate-700"}>
                    {l.primeira_resposta_min === null ? "sem resposta" : minutos(l.primeira_resposta_min)}
                  </span>
                  <span className="text-slate-400"> / {minutos(l.sla_min)}</span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {l.status_entrega ? (ENTREGA_LABEL[l.status_entrega] ?? l.status_entrega) : "—"}
                </td>
                <td className="tabular whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                  {dataHora(l.abertura)}
                  {l.status === "reaberto" && <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800">reaberta</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/conversa/${l.id}`}
                    className="whitespace-nowrap text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Abrir e rodar agente →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtradas.length > limite && (
        <div className="border-t border-slate-100 p-3 text-center">
          <button
            type="button"
            onClick={() => setLimite((n) => n + POR_PAGINA * 2)}
            className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Mostrar mais ({num(filtradas.length - limite)} restantes)
          </button>
        </div>
      )}
      {filtradas.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Nenhuma conversa com esses filtros.</p>}
    </div>
  );
}
