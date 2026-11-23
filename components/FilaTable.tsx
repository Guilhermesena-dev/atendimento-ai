"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CANAL_LABEL, ENTREGA_LABEL, STATUS_LABEL, dataHora, minutos, num } from "@/lib/format";
import { RotaBadge, UrgenciaBadge, urg as estiloUrg } from "@/components/ui";

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
const CHAVES: Chave[] = ["score", "abertura", "contatos_cliente", "primeira_resposta_min", "motivo", "canal"];
const URGENCIAS = ["crítica", "alta", "média", "baixa"] as const;
const POR_PAGINA = 50;

interface Filtros {
  urg: string;
  rota: string;
  canal: string;
  motivo: string;
  sla: boolean;
  busca: string;
}
const VAZIO: Filtros = { urg: "", rota: "", canal: "", motivo: "", sla: false, busca: "" };

// Filtros e ordenação ficam na URL: voltar de uma conversa devolve a fila como estava.
function lerUrl(): { f: Filtros; ordem: { k: Chave; desc: boolean } } {
  const q = new URLSearchParams(window.location.search);
  const k = q.get("ordem") as Chave | null;
  return {
    f: {
      urg: q.get("urgencia") ?? "",
      rota: q.get("rota") ?? "",
      canal: q.get("canal") ?? "",
      motivo: q.get("motivo") ?? "",
      sla: q.get("sla") === "1",
      busca: q.get("q") ?? "",
    },
    ordem: { k: k && CHAVES.includes(k) ? k : "score", desc: q.get("asc") !== "1" },
  };
}

function escreverUrl(f: Filtros, ordem: { k: Chave; desc: boolean }) {
  const q = new URLSearchParams();
  if (f.urg) q.set("urgencia", f.urg);
  if (f.rota) q.set("rota", f.rota);
  if (f.canal) q.set("canal", f.canal);
  if (f.motivo) q.set("motivo", f.motivo);
  if (f.sla) q.set("sla", "1");
  if (f.busca.trim()) q.set("q", f.busca.trim());
  if (ordem.k !== "score") q.set("ordem", ordem.k);
  if (!ordem.desc) q.set("asc", "1");
  const s = q.toString();
  window.history.replaceState(window.history.state, "", s ? `?${s}` : window.location.pathname);
  try {
    sessionStorage.setItem("atendimento-ai:fila-url", s ? `/?${s}` : "/");
  } catch {
    /* sessionStorage indisponível */
  }
}

function SlaCelula({ l }: { l: LinhaFila }) {
  return (
    <span className="tabular whitespace-nowrap">
      <span className={l.sla_estourado ? "font-semibold text-red-700" : "text-slate-800"}>
        {l.primeira_resposta_min === null ? "sem resposta" : minutos(l.primeira_resposta_min)}
      </span>
      <span className="text-muted"> / {minutos(l.sla_min)}</span>
      {l.sla_estourado && <span className="sr-only"> (SLA estourado)</span>}
    </span>
  );
}

function Segmento({
  rotulo,
  opcoes,
  valor,
  onChange,
}: {
  rotulo: string;
  opcoes: { v: string; label: string; n?: number }[];
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-xs font-medium text-muted">{rotulo}</span>
      {opcoes.map((o) => {
        const on = valor === o.v;
        return (
          <button
            key={o.v || "todas"}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.v)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
              on ? "border-slate-900 bg-slate-900 text-white" : "border-line bg-surface text-slate-700 hover:border-slate-400"
            }`}
          >
            {o.label}
            {o.n !== undefined && <span className={`tabular ml-1 ${on ? "text-slate-300" : "text-muted"}`}>{num(o.n)}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function FilaTable({ linhas }: { linhas: LinhaFila[] }) {
  const router = useRouter();
  const [f, setF] = useState<Filtros>(VAZIO);
  const [ordem, setOrdem] = useState<{ k: Chave; desc: boolean }>({ k: "score", desc: true });
  const [limite, setLimite] = useState(POR_PAGINA);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    const u = lerUrl();
    setF(u.f);
    setOrdem(u.ordem);
    setPronto(true);
  }, []);
  useEffect(() => {
    if (pronto) escreverUrl(f, ordem);
  }, [f, ordem, pronto]);

  const set = (p: Partial<Filtros>) => {
    setF((o) => ({ ...o, ...p }));
    setLimite(POR_PAGINA);
  };

  const opcoes = useMemo(
    () => ({
      canal: [...new Set(linhas.map((l) => l.canal))].sort(),
      motivo: [...new Set(linhas.map((l) => l.motivo))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    }),
    [linhas],
  );

  // Aplica todos os filtros exceto `ignorar` — usado para as contagens dos botões.
  const filtrar = (ignorar?: keyof Filtros) => {
    const q = f.busca.trim().toLowerCase();
    return linhas.filter(
      (l) =>
        (ignorar === "urg" || !f.urg || l.urgencia === f.urg) &&
        (ignorar === "rota" || !f.rota || l.rota === f.rota) &&
        (!f.canal || l.canal === f.canal) &&
        (!f.motivo || l.motivo === f.motivo) &&
        (ignorar === "sla" || !f.sla || l.sla_estourado) &&
        (!q || l.id.toLowerCase().includes(q) || l.marca.toLowerCase().includes(q) || l.motivo.toLowerCase().includes(q)),
    );
  };

  const filtradas = useMemo(() => {
    const s = ordem.desc ? -1 : 1;
    return [...filtrar()].sort((a, b) => {
      const va = a[ordem.k];
      const vb = b[ordem.k];
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * s;
      return String(va).localeCompare(String(vb), "pt-BR") * s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, f, ordem]);

  const contagem = useMemo(() => {
    const semUrg = filtrar("urg");
    const semRota = filtrar("rota");
    const semSla = filtrar("sla");
    const por = (arr: LinhaFila[], fn: (l: LinhaFila) => boolean) => arr.filter(fn).length;
    return {
      urg: Object.fromEntries(URGENCIAS.map((u) => [u, por(semUrg, (l) => l.urgencia === u)])) as Record<string, number>,
      urgTotal: semUrg.length,
      humano: por(semRota, (l) => l.rota === "humano"),
      auto: por(semRota, (l) => l.rota === "auto"),
      rotaTotal: semRota.length,
      sla: por(semSla, (l) => l.sla_estourado),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, f]);

  const ativos = [f.urg, f.rota, f.canal, f.motivo, f.sla ? "1" : "", f.busca.trim()].filter(Boolean).length;

  const th = (k: Chave, rotulo: string) => {
    const on = ordem.k === k;
    return (
      <button
        type="button"
        onClick={() => setOrdem((o) => ({ k, desc: o.k === k ? !o.desc : true }))}
        className={`inline-flex items-center gap-1 font-medium hover:text-slate-900 ${on ? "text-slate-900" : ""}`}
      >
        {rotulo}
        <span aria-hidden className="text-[10px]">
          {on ? (ordem.desc ? "▼" : "▲") : "↕"}
        </span>
      </button>
    );
  };
  const ariaSort = (k: Chave) => (ordem.k === k ? (ordem.desc ? "descending" : "ascending") : undefined);

  const sel = (on: boolean) =>
    `rounded-md border px-2 py-1.5 text-sm ${on ? "border-slate-900 bg-slate-50 font-medium text-slate-900" : "border-line bg-surface text-slate-700"}`;

  const href = (id: string) => `/conversa/${id}`;
  const visiveis = filtradas.slice(0, limite);

  return (
    <section aria-label="Atendimentos" className="rounded-lg border border-line bg-surface">
      {/* Filtros */}
      <div className="space-y-3 border-b border-line p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Segmento
            rotulo="Urgência"
            valor={f.urg}
            onChange={(v) => set({ urg: v })}
            opcoes={[{ v: "", label: "Todas", n: contagem.urgTotal }, ...URGENCIAS.map((u) => ({ v: u, label: u[0].toUpperCase() + u.slice(1), n: contagem.urg[u] }))]}
          />
          <Segmento
            rotulo="Rota"
            valor={f.rota}
            onChange={(v) => set({ rota: v })}
            opcoes={[
              { v: "", label: "Todas", n: contagem.rotaTotal },
              { v: "humano", label: "Precisa de humano", n: contagem.humano },
              { v: "auto", label: "Agente resolve", n: contagem.auto },
            ]}
          />
          <button
            type="button"
            aria-pressed={f.sla}
            onClick={() => set({ sla: !f.sla })}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
              f.sla ? "border-red-700 bg-red-700 text-white" : "border-line bg-surface text-slate-700 hover:border-slate-400"
            }`}
          >
            SLA estourado <span className={`tabular ml-1 ${f.sla ? "text-red-100" : "text-muted"}`}>{num(contagem.sla)}</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Canal" className={sel(!!f.canal)} value={f.canal} onChange={(e) => set({ canal: e.target.value })}>
            <option value="">Todos os canais</option>
            {opcoes.canal.map((o) => (
              <option key={o} value={o}>
                {CANAL_LABEL[o] ?? o}
              </option>
            ))}
          </select>
          <select
            aria-label="Motivo"
            className={`${sel(!!f.motivo)} max-w-full`}
            value={f.motivo}
            onChange={(e) => set({ motivo: e.target.value })}
          >
            <option value="">Todos os motivos</option>
            {opcoes.motivo.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <input
            type="search"
            aria-label="Buscar por ID, marca ou motivo"
            placeholder="Buscar ID, marca ou motivo"
            className={`${sel(!!f.busca.trim())} w-full font-normal sm:w-56`}
            value={f.busca}
            onChange={(e) => set({ busca: e.target.value })}
          />
          {ativos > 0 && (
            <button
              type="button"
              onClick={() => {
                setF(VAZIO);
                setLimite(POR_PAGINA);
              }}
              className="rounded-md px-2 py-1.5 text-sm font-medium text-accent hover:underline"
            >
              Limpar filtros ({ativos})
            </button>
          )}
          <p className="text-sm text-muted sm:ml-auto" aria-live="polite">
            <b className="tabular text-slate-900">{num(filtradas.length)}</b> de {num(linhas.length)} atendimentos
          </p>
        </div>
      </div>

      {filtradas.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-sm font-medium text-slate-900">Nenhum atendimento com esses filtros.</p>
          <button
            type="button"
            onClick={() => setF(VAZIO)}
            className="mt-2 text-sm font-medium text-accent hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Desktop: tabela densa; linha inteira clicável, com link real na coluna do caso */}
      {filtradas.length > 0 && (
        <table className="hidden w-full text-sm lg:table">
          <thead className="border-b border-line bg-slate-50 text-left text-xs text-muted">
            <tr>
              <th aria-sort={ariaSort("score")} className="py-2 pl-4 pr-2">
                {th("score", "Prioridade")}
              </th>
              <th aria-sort={ariaSort("motivo")} className="px-2 py-2">
                {th("motivo", "Caso")}
              </th>
              <th className="px-2 py-2 font-medium">Por que precisa de atenção</th>
              <th className="px-2 py-2 font-medium">Rota</th>
              <th aria-sort={ariaSort("primeira_resposta_min")} className="px-2 py-2">
                {th("primeira_resposta_min", "1ª resposta / SLA")}
              </th>
              <th aria-sort={ariaSort("contatos_cliente")} className="px-2 py-2 text-right">
                {th("contatos_cliente", "Contatos")}
              </th>
              <th aria-sort={ariaSort("abertura")} className="py-2 pl-2 pr-4">
                {th("abertura", "Abertura")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visiveis.map((l) => (
              <tr key={l.id} onClick={() => router.push(href(l.id))} className="group cursor-pointer hover:bg-slate-50">
                <td className="relative py-2.5 pl-4 pr-2 align-top">
                  <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${estiloUrg(l.urgencia).barra}`} />
                  <div className="flex items-center gap-2">
                    <UrgenciaBadge u={l.urgencia} />
                    <span className="tabular text-[11px] text-muted" title="Score de prioridade">
                      {l.score}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-2.5 align-top">
                  <Link
                    href={href(l.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-slate-900 group-hover:underline"
                  >
                    {l.motivo}
                  </Link>
                  <div className="mt-0.5 text-xs text-muted">
                    <span className="font-mono">{l.id}</span> · {CANAL_LABEL[l.canal] ?? l.canal} · {l.marca}
                    {l.status_entrega && <> · pedido {(ENTREGA_LABEL[l.status_entrega] ?? l.status_entrega).toLowerCase()}</>}
                  </div>
                </td>
                <td className="max-w-xs px-2 py-2.5 align-top text-slate-700">
                  <span className="line-clamp-2">{l.motivo_rota}</span>
                  {l.status === "reaberto" && (
                    <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 text-[11px] font-medium text-amber-900">
                      {STATUS_LABEL.reaberto}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2.5 align-top">
                  <RotaBadge r={l.rota} />
                </td>
                <td className="px-2 py-2.5 align-top">
                  <SlaCelula l={l} />
                </td>
                <td
                  className={`tabular px-2 py-2.5 text-right align-top ${
                    l.contatos_cliente >= 3 ? "font-semibold text-red-700" : "text-slate-800"
                  }`}
                >
                  {l.contatos_cliente}
                </td>
                <td className="tabular whitespace-nowrap py-2.5 pl-2 pr-4 align-top text-xs text-muted">{dataHora(l.abertura)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Celular e tablet: lista de cartões, sem rolagem horizontal */}
      {filtradas.length > 0 && (
        <ul className="divide-y divide-line lg:hidden">
          {visiveis.map((l) => (
            <li key={l.id} className="relative">
              <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${estiloUrg(l.urgencia).barra}`} />
              <Link href={href(l.id)} className="block py-3 pl-4 pr-3 hover:bg-slate-50">
                <div className="flex items-center justify-between gap-2">
                  <UrgenciaBadge u={l.urgencia} />
                  <RotaBadge r={l.rota} />
                </div>
                <div className="mt-1.5 font-semibold text-slate-900">{l.motivo}</div>
                <div className="text-xs text-muted">
                  <span className="font-mono">{l.id}</span> · {CANAL_LABEL[l.canal] ?? l.canal} · {l.marca}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-700">{l.motivo_rota}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>
                    1ª resposta <SlaCelula l={l} />
                  </span>
                  <span className={l.contatos_cliente >= 3 ? "font-semibold text-red-700" : ""}>
                    {l.contatos_cliente} {l.contatos_cliente === 1 ? "contato" : "contatos"}
                  </span>
                  {l.status === "reaberto" && <span className="font-medium text-amber-900">Reaberta</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {filtradas.length > limite && (
        <div className="border-t border-line p-3 text-center">
          <button
            type="button"
            onClick={() => setLimite((n) => n + POR_PAGINA * 2)}
            className="rounded-md border border-line px-4 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400"
          >
            Mostrar mais ({num(filtradas.length - limite)} restantes)
          </button>
        </div>
      )}
    </section>
  );
}
