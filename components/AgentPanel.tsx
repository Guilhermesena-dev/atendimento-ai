"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  consultar_pedido: "Consultar pedido",
  consultar_politica: "Consultar política",
  historico_cliente: "Histórico do cliente",
  abrir_protocolo_cosmetovigilancia: "Protocolo de cosmetovigilância",
  aprovar_reenvio: "Aprovar reenvio",
  aprovar_estorno: "Aprovar estorno/reembolso",
  solicitar_nova_producao: "Nova produção",
  alterar_endereco: "Alterar endereço",
  enviar_resposta: "Enviar resposta",
  escalar_humano: "Escalar para humano",
};

const STATUS_ESTILO: Record<Acao["status"], string> = {
  aprovado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pendente_foto: "bg-amber-50 text-amber-700 border-amber-200",
  pendente_info: "bg-amber-50 text-amber-700 border-amber-200",
  pendente_aprovacao_humana: "bg-orange-50 text-orange-700 border-orange-200",
  rascunho: "bg-sky-50 text-sky-700 border-sky-200",
  bloqueado: "bg-red-50 text-red-700 border-red-200",
};
const STATUS_ROTULO: Record<Acao["status"], string> = {
  aprovado: "Executada",
  pendente_foto: "Pendente de foto",
  pendente_info: "Aguardando informação do cliente",
  pendente_aprovacao_humana: "Aguarda aprovação humana",
  rascunho: "Rascunho p/ humano",
  bloqueado: "Bloqueada pela política",
};

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

export function AgentPanel({ conversationId, autorun = false }: { conversationId: string; autorun?: boolean }) {
  const [novaMensagem, setNovaMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<Resposta | null>(null);
  const [anterior, setAnterior] = useState<ReturnType<typeof lerLog>>(null);

  useEffect(() => {
    setAnterior(lerLog(conversationId));
  }, [conversationId]);

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

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Agente de atendimento</h2>
          <p className="text-sm text-slate-500">O agente decide; o motor de políticas valida cada ação antes de executar.</p>
        </div>
        <button
          onClick={rodar}
          disabled={carregando}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {carregando ? "Executando..." : "Rodar agente"}
        </button>
      </div>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Colar nova mensagem do cliente (opcional)
        <textarea
          value={novaMensagem}
          onChange={(e) => setNovaMensagem(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder='Ex.: "Usei o shampoo e fiquei com o couro cabeludo vermelho e coçando"'
          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm font-normal focus:border-slate-500 focus:outline-none"
        />
      </label>

      {anterior && !res && (
        <p className="mt-2 text-xs text-slate-500">
          Última execução neste navegador: {new Date(anterior.em).toLocaleString("pt-BR")} · {anterior.acoes.length} ação(ões) registradas.
        </p>
      )}

      {carregando && (
        <div className="mt-4 animate-pulse rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
          Consultando pedido, políticas e histórico...
        </div>
      )}

      {erro && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

      {res && (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded-full px-3 py-1 font-semibold ${res.escalado ? "bg-orange-100 text-orange-800" : "bg-emerald-100 text-emerald-800"}`}
            >
              {res.escalado ? "Escalado para humano" : "Resolvido pelo agente"}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{res.modelo}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{(res.duracao_ms / 1000).toFixed(1)} s</span>
          </div>
          {res.aviso && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{res.aviso}</div>}
          {res.escalado && res.motivo_escalonamento && (
            <p className="text-sm text-orange-800">
              <strong>Motivo do escalonamento:</strong> {res.motivo_escalonamento}
            </p>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Passo a passo</h3>
            <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
              {res.steps.map((s, i) =>
                s.tipo === "pensamento" ? (
                  <li key={i} className="text-sm italic text-slate-600">
                    {s.origem === "guard-rail" && <span className="mr-1 not-italic font-semibold text-violet-700">[guard-rail]</span>}
                    {s.texto}
                  </li>
                ) : (
                  <li key={i}>
                    <details
                      className={`rounded-lg border p-2 text-sm ${s.bloqueado ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50"}`}
                    >
                      <summary className="cursor-pointer select-none">
                        <span className={`font-mono font-medium ${s.bloqueado ? "text-red-700" : "text-slate-800"}`}>{s.tool}</span>
                        {s.bloqueado && <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">BLOQUEADO</span>}
                        {s.origem && s.origem !== "agente" && <span className="ml-2 text-xs text-violet-700">({s.origem})</span>}
                      </summary>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-slate-700">
                          {JSON.stringify(s.args ?? {}, null, 2)}
                        </pre>
                        <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-slate-700">
                          {JSON.stringify(s.resultado ?? {}, null, 2)}
                        </pre>
                      </div>
                    </details>
                  </li>
                ),
              )}
            </ol>
          </div>

          {res.acoes_executadas.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Ações executadas</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {res.acoes_executadas.map((a) => (
                  <div key={a.id} className={`rounded-lg border p-3 text-sm ${STATUS_ESTILO[a.status]}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{NOME_TOOL[a.tool] ?? a.tool}</span>
                      <span className="text-xs font-medium">{STATUS_ROTULO[a.status]}</span>
                    </div>
                    <div className="mt-1 font-mono text-xs opacity-80">
                      {a.id} · {new Date(a.timestamp).toLocaleTimeString("pt-BR")}
                      {a.origem === "guard-rail" ? " · guard-rail" : ""}
                    </div>
                    <p className="mt-1 text-xs">{a.motivo_politica}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {res.escalado && (res.mensagens_enviadas?.length ?? 0) > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Já enviado ao cliente</h3>
              {res.mensagens_enviadas!.map((m, i) => (
                <div key={i} className="mb-2 whitespace-pre-wrap rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  {m}
                </div>
              ))}
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {res.escalado ? "Rascunho para o atendente" : "Resposta enviada ao cliente"}
            </h3>
            <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
              {res.resposta_cliente || "(sem resposta)"}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
export default AgentPanel;
