import Link from "next/link";
import { notFound } from "next/navigation";
import { getConversa, getConversas } from "@/lib/data";
import { triar } from "@/lib/triagem";
import { CONTATOS_ESCALONAMENTO, temInjecao, temReacaoAdversa } from "@/lib/policies";
import { CANAL_LABEL, ENTREGA_LABEL, STATUS_LABEL, brl, data, dataHora, minutos, num } from "@/lib/format";
import { Pill, RotaBadge, UrgenciaBadge, urg } from "@/components/ui";
import { AgentPanel } from "@/components/AgentPanel";
import VoltarFila from "@/components/VoltarFila";

// Renderização sob demanda: não geramos 4.000 páginas estáticas.
export const dynamic = "force-dynamic";

const AUTOR: Record<string, { rotulo: string; bolha: string; lado: "esq" | "dir" }> = {
  cliente: { rotulo: "Cliente", bolha: "border border-line bg-surface text-slate-900", lado: "esq" },
  agente: { rotulo: "Atendente", bolha: "bg-slate-800 text-white", lado: "dir" },
  bot: { rotulo: "Bot", bolha: "border border-dashed border-slate-300 bg-slate-100 text-slate-700", lado: "dir" },
};

const TOM_SINAL = {
  alerta: { ponto: "bg-red-600", texto: "text-red-800" },
  aviso: { ponto: "bg-amber-500", texto: "text-amber-900" },
  info: { ponto: "bg-slate-400", texto: "text-slate-700" },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Conversa ${id} · Triagem + Ações` };
}

export default async function ConversaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autorun?: string | string[] }>;
}) {
  const { id } = await params;
  const { autorun } = await searchParams;
  const autoExecutar = autorun === "1";
  const c = getConversa(id);
  if (!c) notFound();
  const t = triar(c);
  const p = c.pedido;

  // Histórico do mesmo cliente no período (outras conversas)
  const historico = getConversas()
    .filter((o) => o.customer_id === c.customer_id && o.id !== c.id)
    .sort((a, b) => a.abertura.localeCompare(b.abertura));

  // Sinais que explicam a urgência, na ordem de gravidade (mesmas regras de lib/triagem.ts).
  const sinais: { tom: keyof typeof TOM_SINAL; texto: string }[] = [];
  if (temReacaoAdversa(c))
    sinais.push({ tom: "alerta", texto: "Relato de reação adversa: exige registro de cosmetovigilância em até 24h" });
  if (c.canal === "reclame_aqui") sinais.push({ tom: "alerta", texto: `Reclame Aqui: resposta pública, custo de ${brl(c.custo)} por conversa` });
  if (c.contatos_cliente >= CONTATOS_ESCALONAMENTO)
    sinais.push({ tom: "alerta", texto: `${num(c.contatos_cliente)} contatos do cliente no período (este é o ${c.ordem_contato}º)` });
  if (temInjecao(c)) sinais.push({ tom: "alerta", texto: "Mensagem tenta dar instruções à IA (possível fraude)" });
  if (c.sla_estourado)
    sinais.push({
      tom: "alerta",
      texto: `SLA estourado: 1ª resposta em ${minutos(c.primeira_resposta_min)}, limite de ${minutos(c.sla_min)}`,
    });
  else if (c.primeira_resposta_min === null) sinais.push({ tom: "aviso", texto: "Ainda sem resposta de um atendente" });
  if (c.status === "reaberto") sinais.push({ tom: "aviso", texto: "Conversa reaberta pelo cliente" });
  if (c.recontato && c.contatos_cliente < CONTATOS_ESCALONAMENTO)
    sinais.push({ tom: "aviso", texto: `Recontato: ${c.ordem_contato}º contato do cliente no período` });
  if (p?.status_entrega === "atrasado") sinais.push({ tom: "aviso", texto: "Pedido com entrega atrasada" });
  if (c.fora_horario) sinais.push({ tom: "info", texto: "Aberta fora do horário de atendimento (8h–20h)" });
  if (c.pii) sinais.push({ tom: "info", texto: "Dados pessoais mascarados na conversa" });

  const linha = (rotulo: string, valor: React.ReactNode) => (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted">{rotulo}</dt>
      <dd className="text-right font-medium text-slate-900">{valor}</dd>
    </div>
  );

  const painel = "rounded-lg border border-line bg-surface";
  const tituloPainel = "border-b border-line px-4 py-2.5 text-sm font-semibold text-slate-900";

  return (
    <div className="space-y-5">
      {/* Cabeçalho do caso */}
      <header>
        <VoltarFila />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{c.motivo}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
              <UrgenciaBadge u={t.urgencia} />
              <RotaBadge r={t.rota} />
              <Pill tom={c.status === "reaberto" ? "aviso" : "neutro"}>{STATUS_LABEL[c.status] ?? c.status}</Pill>
              <span className="text-xs text-muted">
                <span className="font-mono">{c.id}</span> · {CANAL_LABEL[c.canal] ?? c.canal} · {c.marca} · aberta em{" "}
                {dataHora(c.abertura)}
              </span>
            </div>
          </div>
          <a
            href="#agente"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 lg:hidden"
          >
            Ir para o agente ↓
          </a>
        </div>
      </header>

      {/* Por que precisa de atenção */}
      <section aria-labelledby="atencao" className={`${painel} relative overflow-hidden`}>
        <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${urg(t.urgencia).barra}`} />
        <div className="grid gap-4 py-3 pl-5 pr-4 md:grid-cols-2">
          <div>
            <h2 id="atencao" className="text-sm font-semibold text-slate-900">
              Por que precisa de atenção
            </h2>
            {sinais.length ? (
              <ul className="mt-2 space-y-1.5">
                {sinais.map((s) => (
                  <li key={s.texto} className={`flex gap-2 text-sm ${TOM_SINAL[s.tom].texto}`}>
                    <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TOM_SINAL[s.tom].ponto}`} />
                    {s.texto}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Nenhum sinal de risco: dentro do SLA, primeiro contato, canal privado.</p>
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Decisão da triagem:{" "}
              <span className={t.rota === "humano" ? "text-slate-900" : "text-emerald-800"}>
                {t.rota === "humano" ? "vai para um atendente" : "o agente pode resolver sozinho"}
              </span>
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {t.motivos_rota.map((m) => (
                <li key={m} className="flex gap-2">
                  <span aria-hidden className="text-muted">
                    –
                  </span>
                  {m}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Score de prioridade {num(t.score)} · custo da conversa {brl(c.custo)} · tag do atendente:{" "}
              {c.tag_agente ?? "(vazia)"}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* Agente: o que ele faz na prática */}
        <section id="agente" aria-label="Agente de IA" className="min-w-0 scroll-mt-16 lg:col-span-7">
          <AgentPanel conversationId={c.id} autorun={autoExecutar} />
        </section>

        <div className="min-w-0 space-y-5 lg:col-span-5">
          {/* Conversa */}
          <section aria-labelledby="thread" className={painel}>
            <h2 id="thread" className={`${tituloPainel} flex items-baseline justify-between gap-2`}>
              Conversa
              <span className="text-xs font-normal text-muted">{c.mensagens.length} mensagens</span>
            </h2>
            <ol className="space-y-3 bg-slate-50 p-3 lg:max-h-[560px] lg:overflow-y-auto">
              {c.mensagens.map((m, i) => {
                const a = AUTOR[m.autor] ?? AUTOR.cliente;
                return (
                  <li key={i} className={`flex ${a.lado === "dir" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[88%]">
                      <div className={`mb-0.5 text-[11px] text-muted ${a.lado === "dir" ? "text-right" : ""}`}>
                        <span className="font-medium text-slate-700">{a.rotulo}</span> · {dataHora(m.ts)}
                      </div>
                      <div className={`whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${a.bolha}`}>{m.texto}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Pedido */}
          <section aria-labelledby="pedido" className={painel}>
            <h2 id="pedido" className={tituloPainel}>
              Pedido
            </h2>
            <div className="px-4 py-2">
              {p ? (
                <dl className="divide-y divide-line">
                  {linha(
                    "Entrega",
                    <Pill tom={p.status_entrega === "atrasado" ? "alerta" : p.status_entrega === "entregue" ? "bom" : "info"}>
                      {ENTREGA_LABEL[p.status_entrega] ?? p.status_entrega}
                    </Pill>,
                  )}
                  {linha("Produto", p.produto)}
                  {linha("Valor", brl(p.valor))}
                  {linha("Data do pedido", `${data(p.data_pedido)} (${num(p.dias_desde_pedido)} dias até o contato)`)}
                  {linha("Transportadora", `${p.transportadora} · ${p.uf}`)}
                  {linha("Número / SKU", <span className="font-mono text-xs">{p.order_id} · {p.sku}</span>)}
                </dl>
              ) : (
                <p className="py-1.5 text-sm text-muted">Conversa sem pedido vinculado.</p>
              )}
            </div>
          </section>

          {/* Histórico */}
          <section aria-labelledby="historico" className={painel}>
            <h2 id="historico" className={tituloPainel}>
              Outras conversas do cliente ({historico.length})
            </h2>
            {historico.length > 0 ? (
              <ul className="divide-y divide-line text-sm">
                {historico.map((h) => (
                  <li key={h.id}>
                    <Link href={`/conversa/${h.id}`} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50">
                      <span className="font-mono text-xs text-accent">{h.id}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-800">{h.motivo}</span>
                      <span className="whitespace-nowrap text-xs text-muted">{data(h.abertura)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-muted">Primeiro contato deste cliente no período.</p>
            )}
            {c.motivos_secundarios.length > 0 && (
              <p className="border-t border-line px-4 py-2 text-xs text-muted">
                Motivos secundários nesta conversa: {c.motivos_secundarios.join(", ")}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
