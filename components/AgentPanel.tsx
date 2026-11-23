"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CANAL_LABEL, brl } from "@/lib/format";

// Espelho do contrato de /api/agent (lib/agent.ts → RespostaAgente).
interface Step {
  tipo: "pensamento" | "tool";
  tool?: string;
  args?: Record<string, unknown>;
  resultado?: unknown;
  bloqueado?: boolean;
  texto?: string;
  origem?: "agente" | "guard-rail" | "deterministico";
}
interface Acao {
  id: string;
  tool: string;
  status: "aprovado" | "pendente_foto" | "pendente_info" | "pendente_aprovacao_humana" | "rascunho" | "bloqueado";
  motivo_politica: string;
  timestamp: string;
  args: Record<string, unknown>;
  detalhes?: Record<string, unknown>;
  origem: "agente" | "guard-rail";
}
interface Resposta {
  conversationId: string;
  steps: Step[];
  acoes_executadas: Acao[];
  resposta_cliente: string;
  mensagens_enviadas?: string[];
  escalado: boolean;
  motivo_escalonamento?: string;
  modelo: string;
  duracao_ms: number;
  aviso?: string;
}

const LS_KEY = "atendimento-ai:log-acoes";

const NOME_TOOL: Record<string, string> = {
  consultar_pedido: "Consultou o pedido",
  consultar_politica: "Consultou a política",
  historico_cliente: "Consultou o histórico do cliente",
  abrir_protocolo_cosmetovigilancia: "Protocolo de cosmetovigilância",
  aprovar_reenvio: "Reenvio sem custo",
  aprovar_estorno: "Estorno / reembolso",
  solicitar_nova_producao: "Nova produção",
  alterar_endereco: "Alteração de endereço",
  enviar_resposta: "Mensagem ao cliente",
  escalar_humano: "Encaminhamento para atendente",
};

// Rótulo específico quando a ação foi de fato executada.
const FEITO: Record<string, string> = {
  abrir_protocolo_cosmetovigilancia: "Abriu protocolo de cosmetovigilância",
  aprovar_reenvio: "Aprovou reenvio sem custo",
  aprovar_estorno: "Aprovou estorno / reembolso",
  solicitar_nova_producao: "Solicitou nova produção",
  alterar_endereco: "Alterou o endereço",
  enviar_resposta: "Enviou mensagem ao cliente",
  escalar_humano: "Escalou para um atendente",
};

type Grupo = "executada" | "aguardando" | "sugestao" | "bloqueada";
const GRUPO: Record<Acao["status"], Grupo> = {
  aprovado: "executada",
  pendente_foto: "aguardando",
  pendente_info: "aguardando",
  pendente_aprovacao_humana: "aguardando",
  rascunho: "sugestao",
  bloqueado: "bloqueada",
};
const GRUPO_INFO: Record<Grupo, { titulo: string; sub: string; card: string; selo: string }> = {
  executada: {
    titulo: "Executadas",
    sub: "o agente fez (simulado)",
    card: "border-l-4 border-emerald-600 bg-emerald-50/60",
    selo: "bg-emerald-700 text-white",
  },
  aguardando: {
    titulo: "Aguardando",
    sub: "dependem do cliente ou de aprovação",
    card: "border border-dashed border-amber-400 bg-amber-50/50",
    selo: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300",
  },
  sugestao: {
    titulo: "Sugestões",
    sub: "não executadas, ficam para o atendente",
    card: "border border-dashed border-sky-400 bg-sky-50/50",
    selo: "bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-300",
  },
  bloqueada: {
    titulo: "Bloqueadas pela política",
    sub: "o motor de políticas impediu",
    card: "border-l-4 border-red-600 bg-red-50/60",
    selo: "bg-red-700 text-white",
  },
};
const STATUS_ROTULO: Record<Acao["status"], string> = {
  aprovado: "✓ Executada",
  pendente_foto: "Aguardando foto",
  pendente_info: "Aguardando informação",
  pendente_aprovacao_humana: "Aguarda aprovação humana",
  rascunho: "Sugestão",
  bloqueado: "✕ Bloqueada",
};
const ORIGEM: Record<string, string> = { "guard-rail": "regra de segurança", deterministico: "sem IA" };

function salvarLog(conversationId: string, r: Resposta) {
  try {
    const atual = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
    atual[conversationId] = {
      em: new Date().toISOString(),
      escalado: r.escalado,
      modelo: r.modelo,
      acoes: r.acoes_executadas.map((a) => ({ id: a.id, tool: a.tool, status: a.status, timestamp: a.timestamp })),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(atual));
  } catch {
    /* localStorage indisponível */
  }
}

function lerLog(conversationId: string): { em: string; acoes: { id: string; tool: string; status: string }[] } | null {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}")[conversationId] ?? null;
  } catch {
    return null;
  }
}

function mensagemErro(status: number, corpo: { erro?: string } | null): string {
  if (corpo?.erro) return corpo.erro;
  if (status === 429) return "Muitas execuções seguidas. Aguarde 1 minuto e tente de novo.";
  if (status === 502 || status === 503 || status === 504)
    return "O servidor demorou para responder (a IA gratuita pode estar sobrecarregada). Tente novamente em alguns segundos.";
  return "Não foi possível rodar o agente agora. Tente novamente em instantes.";
}

const rotuloCampo = (k: string) => k.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase());
function valorCampo(k: string, v: unknown): string {
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number" && /valor|custo/i.test(k)) return brl(v);
  if (Array.isArray(v)) return v.map(String).join("; ");
  if (typeof v === "object" && v) return JSON.stringify(v);
  if (k === "canal") return CANAL_LABEL[String(v)] ?? String(v);
  return String(v);
}
// O backend prefixa o motivo com um código interno (ex.: "reacao_adversa; ..."); mostramos só o texto.
const limparMotivo = (m: string) => m.replace(/^[a-z_]+;\s*/, "");

function CardAcao({ a }: { a: Acao }) {
  const g = GRUPO[a.status];
  const info = GRUPO_INFO[g];
  const titulo = g === "executada" ? (FEITO[a.tool] ?? NOME_TOOL[a.tool] ?? a.tool) : (NOME_TOOL[a.tool] ?? a.tool);
  const detalhes = Object.entries(a.detalhes ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== "");
  return (
    <li className={`rounded-md p-3 text-sm ${info.card}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="font-semibold text-slate-900">{titulo}</span>
        <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${info.selo}`}>{STATUS_ROTULO[a.status]}</span>
      </div>
      <p className="mt-1 text-slate-700">{a.motivo_politica}</p>
      {detalhes.length > 0 && (
        <dl className="mt-2 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
          {detalhes.map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <dt className="text-muted">{rotuloCampo(k)}:</dt>
              <dd className="min-w-0 break-words font-medium text-slate-800">{valorCampo(k, v)}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-2 font-mono text-[11px] text-muted">
        {a.id} · {new Date(a.timestamp).toLocaleTimeString("pt-BR")}
        {a.origem === "guard-rail" && <span className="ml-1 font-sans font-medium text-violet-800">· {ORIGEM["guard-rail"]}</span>}
      </div>
    </li>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 motion-reduce:animate-none"
    />
  );
}

export function AgentPanel({ conversationId, autorun = false }: { conversationId: string; autorun?: boolean }) {
  const [novaMensagem, setNovaMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<Resposta | null>(null);
  const [anterior, setAnterior] = useState<ReturnType<typeof lerLog>>(null);
  const resultadoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAnterior(lerLog(conversationId));
  }, [conversationId]);

  useEffect(() => {
    if (!carregando) return;
    setSegundos(0);
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [carregando]);

  const rodar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setRes(null);
    try {
      const r = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, ...(novaMensagem.trim() ? { novaMensagem: novaMensagem.trim() } : {}) }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !Array.isArray(j.steps)) throw new Error(mensagemErro(r.status, j));
      setRes(j as Resposta);
      salvarLog(conversationId, j as Resposta);
      setAnterior(lerLog(conversationId));
      requestAnimationFrame(() => resultadoRef.current?.focus({ preventScroll: true }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setErro(msg && !/fetch|network|JSON/i.test(msg) ? msg : "Não foi possível falar com o servidor. Verifique a conexão e tente novamente.");
    } finally {
      setCarregando(false);
    }
  }, [conversationId, novaMensagem]);

  const jaRodou = useRef(false);
  useEffect(() => {
    if (autorun && !jaRodou.current) {
      jaRodou.current = true;
      void rodar();
    }
  }, [autorun, rodar]);

  const grupos = (["executada", "aguardando", "sugestao", "bloqueada"] as Grupo[])
    .map((g) => ({ g, acoes: res?.acoes_executadas.filter((a) => GRUPO[a.status] === g) ?? [] }))
    .filter((x) => x.acoes.length);
  const nExec = res?.acoes_executadas.filter((a) => a.status === "aprovado").length ?? 0;
  const enviadas = res?.mensagens_enviadas ?? [];
  const nTools = res?.steps.filter((s) => s.tipo === "tool").length ?? 0;
  const nAguardando = res?.acoes_executadas.filter((a) => GRUPO[a.status] === "aguardando").length ?? 0;
  const veredito = !res
    ? null
    : res.escalado
      ? { titulo: "Encaminhado para um atendente", cls: "bg-slate-900 text-white" }
      : nAguardando
        ? { titulo: "Aguardando o cliente", cls: "bg-amber-100 text-amber-950 ring-1 ring-inset ring-amber-300" }
        : { titulo: "Resolvido pelo agente", cls: "bg-emerald-700 text-white" };

  return (
    <div className="rounded-lg border border-line bg-surface">
      {/* Cabeçalho + ação principal */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">Agente de IA</h2>
          <p className="mt-0.5 text-sm text-muted">
            Lê a conversa, consulta pedido, política e histórico e executa só o que a política permite. Ações simuladas.
          </p>
        </div>
        <button
          type="button"
          onClick={rodar}
          disabled={carregando}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
        >
          {carregando && <Spinner />}
          {carregando
            ? "Executando…"
            : novaMensagem.trim()
              ? res
                ? "Rodar de novo com a nova mensagem"
                : "Rodar com a nova mensagem"
              : res
                ? "Rodar de novo"
                : "Rodar agente"}
        </button>
      </div>

      <details className="border-b border-line px-4 py-2 text-sm">
        <summary className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
          <span className="chevron" aria-hidden>
            ›
          </span>
          Testar com uma nova mensagem do cliente
        </summary>
        <label className="mt-2 block text-xs text-muted">
          A mensagem é adicionada ao fim da conversa antes de o agente rodar.
          <textarea
            value={novaMensagem}
            onChange={(e) => setNovaMensagem(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder='Ex.: "Usei o shampoo e fiquei com o couro cabeludo vermelho e coçando"'
            className="mt-1 w-full rounded-md border border-line p-2 text-sm text-slate-900 focus:border-slate-500"
          />
        </label>
      </details>

      <div className="p-4" aria-live="polite" aria-busy={carregando}>
        {/* Vazio */}
        {!res && !carregando && !erro && (
          <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-muted">
            <p className="font-medium text-slate-800">O agente ainda não rodou neste caso.</p>
            <p className="mt-1">
              Clique em <b className="text-slate-900">Rodar agente</b>. Leva de 10 a 20 segundos. O resultado mostra o veredito, as ações
              executadas ou bloqueadas, a mensagem ao cliente e cada consulta feita.
            </p>
            {anterior && (
              <p className="mt-2 text-xs">
                Última execução neste navegador: {new Date(anterior.em).toLocaleString("pt-BR")} · {anterior.acoes.length} ação(ões)
                registradas.
              </p>
            )}
          </div>
        )}

        {/* Carregando */}
        {carregando && (
          <div className="rounded-md border border-line bg-slate-50 p-4 text-sm" role="status">
            <div className="flex items-center gap-2 font-medium text-slate-900">
              <Spinner /> Analisando o caso… <span className="tabular text-muted">{segundos}s</span>
            </div>
            <p className="mt-1 text-muted">Consultando pedido, política e histórico; cada ação passa pelo motor de políticas antes de executar.</p>
            <div className="mt-3 space-y-2" aria-hidden>
              <div className="h-10 animate-pulse rounded bg-slate-200/70 motion-reduce:animate-none" />
              <div className="h-16 animate-pulse rounded bg-slate-200/50 motion-reduce:animate-none" />
            </div>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">O agente não respondeu</p>
            <p className="mt-0.5">{erro}</p>
            <button type="button" onClick={rodar} className="mt-2 font-semibold underline hover:no-underline">
              Tentar novamente
            </button>
          </div>
        )}

        {/* Sucesso */}
        {res && (
          <div ref={resultadoRef} tabIndex={-1} className="space-y-5 outline-none">
            {/* 1. Veredito */}
            <div className={`rounded-md p-3 ${veredito!.cls}`}>
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">Resultado</p>
              <p className="mt-0.5 text-lg font-semibold">
                {veredito!.titulo}
              </p>
              {res.escalado && res.motivo_escalonamento && <p className="mt-1 text-sm opacity-90">{limparMotivo(res.motivo_escalonamento)}</p>}
              {!res.escalado && nAguardando > 0 && (
                <p className="mt-1 text-sm">O agente pediu o que falta ao cliente; a ação será executada quando chegar.</p>
              )}
              <p className="tabular mt-2 text-xs opacity-80">
                {nExec} {nExec === 1 ? "ação executada" : "ações executadas"} · {nTools} chamadas de ferramenta ·{" "}
                {(res.duracao_ms / 1000).toFixed(1)} s · {res.modelo}
              </p>
            </div>
            {res.aviso && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{res.aviso}</div>
            )}

            {/* 2. Ações */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900">O que o agente fez</h3>
              {grupos.length === 0 && <p className="mt-1 text-sm text-muted">Nenhuma ação além das consultas.</p>}
              <div className="mt-2 space-y-4">
                {grupos.map(({ g, acoes }) => (
                  <div key={g}>
                    <p className="mb-1.5 text-xs text-muted">
                      <b className="text-slate-800">{GRUPO_INFO[g].titulo}</b> · {GRUPO_INFO[g].sub}
                    </p>
                    <ul className="space-y-2">
                      {acoes.map((a) => (
                        <CardAcao key={a.id} a={a} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Mensagem ao cliente */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Mensagem ao cliente</h3>
              {res.escalado ? (
                <div className="mt-2 space-y-3">
                  {enviadas.map((m, i) => (
                    <figure key={i}>
                      <figcaption className="mb-1 text-xs font-semibold text-emerald-800">✓ Já enviada ao cliente</figcaption>
                      <blockquote className="whitespace-pre-wrap rounded-md border-l-4 border-emerald-600 bg-emerald-50/60 p-3 text-sm text-slate-900">
                        {m}
                      </blockquote>
                    </figure>
                  ))}
                  {!enviadas.includes(res.resposta_cliente) && (
                  <figure>
                    <figcaption className="mb-1 text-xs font-semibold text-sky-900">Rascunho para o atendente · não enviado</figcaption>
                    <blockquote className="whitespace-pre-wrap rounded-md border border-dashed border-sky-400 bg-sky-50/50 p-3 text-sm text-slate-900">
                      {res.resposta_cliente || "(sem rascunho)"}
                    </blockquote>
                  </figure>
                  )}
                </div>
              ) : (
                <figure className="mt-2">
                  <figcaption className="mb-1 text-xs font-semibold text-emerald-800">✓ Enviada ao cliente</figcaption>
                  <blockquote className="whitespace-pre-wrap rounded-md border-l-4 border-emerald-600 bg-emerald-50/60 p-3 text-sm text-slate-900">
                    {res.resposta_cliente || "(sem resposta)"}
                  </blockquote>
                </figure>
              )}
            </div>

            {/* 4. Como decidiu */}
            <details className="rounded-md border border-line">
              <summary className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                <span className="chevron text-muted" aria-hidden>
                  ›
                </span>
                Como o agente decidiu
                <span className="font-normal text-muted">({res.steps.length} passos)</span>
              </summary>
              <ol className="space-y-2 border-t border-line p-3">
                {res.steps.map((s, i) =>
                  s.tipo === "pensamento" ? (
                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                      <span className="tabular w-5 shrink-0 text-right text-xs text-muted">{i + 1}</span>
                      <span>
                        {s.origem && s.origem !== "agente" && (
                          <span className="mr-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-900">
                            {ORIGEM[s.origem] ?? s.origem}
                          </span>
                        )}
                        {s.texto}
                      </span>
                    </li>
                  ) : (
                    <li key={i} className="flex gap-2">
                      <span className="tabular w-5 shrink-0 pt-1.5 text-right text-xs text-muted">{i + 1}</span>
                      <details
                        className={`min-w-0 flex-1 rounded border text-sm ${s.bloqueado ? "border-red-300 bg-red-50" : "border-line bg-slate-50"}`}
                      >
                        <summary className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5">
                          <span className="chevron text-muted" aria-hidden>
                            ›
                          </span>
                          <span className="font-medium text-slate-900">{NOME_TOOL[s.tool ?? ""] ?? s.tool}</span>
                          <span className="font-mono text-[11px] text-muted">{s.tool}</span>
                          {s.bloqueado && (
                            <span className="rounded bg-red-700 px-1.5 py-0.5 text-[11px] font-semibold text-white">Bloqueada</span>
                          )}
                          {s.origem && s.origem !== "agente" && (
                            <span className="text-[11px] font-medium text-violet-800">{ORIGEM[s.origem] ?? s.origem}</span>
                          )}
                        </summary>
                        <div className="grid gap-2 border-t border-line p-2 md:grid-cols-2">
                          <div>
                            <p className="mb-0.5 text-[11px] font-medium text-muted">Entrada</p>
                            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-xs text-slate-700">
                              {JSON.stringify(s.args ?? {}, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="mb-0.5 text-[11px] font-medium text-muted">Resultado</p>
                            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-xs text-slate-700">
                              {JSON.stringify(s.resultado ?? {}, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </details>
                    </li>
                  ),
                )}
              </ol>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
export default AgentPanel;
