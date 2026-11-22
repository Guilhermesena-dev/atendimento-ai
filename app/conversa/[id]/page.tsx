import Link from "next/link";
import { notFound } from "next/navigation";
import { getConversa, getConversas } from "@/lib/data";
import { triar } from "@/lib/triagem";
import { CANAL_LABEL, ENTREGA_LABEL, STATUS_LABEL, brl, data, dataHora, minutos, num } from "@/lib/format";
import { Card, Pill, RotaBadge, UrgenciaBadge } from "@/components/ui";
import { AgentPanel } from "@/components/AgentPanel";

// Renderização sob demanda: não geramos 4.000 páginas estáticas.
export const dynamic = "force-dynamic";

const AUTOR: Record<string, { rotulo: string; bolha: string; lado: string }> = {
  cliente: { rotulo: "Cliente", bolha: "bg-white ring-1 ring-slate-200 text-slate-800", lado: "justify-start" },
  agente: { rotulo: "Atendente", bolha: "bg-indigo-600 text-white", lado: "justify-end" },
  bot: { rotulo: "Bot", bolha: "bg-slate-200 text-slate-700", lado: "justify-end" },
};

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

  const linha = (rotulo: string, valor: React.ReactNode) => (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-slate-500">{rotulo}</dt>
      <dd className="text-right font-medium text-slate-900">{valor}</dd>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/fila" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            ← Voltar para a fila
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            Conversa {c.id} <span className="text-slate-400">·</span> {c.motivo}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <UrgenciaBadge u={t.urgencia} />
            <RotaBadge r={t.rota} />
            <Pill>{CANAL_LABEL[c.canal] ?? c.canal}</Pill>
            <Pill>{c.marca}</Pill>
            <Pill tom={c.status === "reaberto" || c.status === "pendente" ? "alerta" : "neutro"}>{STATUS_LABEL[c.status] ?? c.status}</Pill>
            <span>Aberta em {dataHora(c.abertura)}</span>
          </div>
        </div>
        <a
          href="#agente"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          Rodar agente ↓
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Thread */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Conversa ({c.mensagens.length} mensagens)</h2>
            <span className="text-xs text-slate-500">Tag dada pelo atendente: {c.tag_agente ?? "(vazia)"}</span>
          </div>
          <div className="space-y-3 rounded-lg bg-slate-50 p-3 sm:p-4">
            {c.mensagens.map((m, i) => {
              const a = AUTOR[m.autor] ?? AUTOR.cliente;
              return (
                <div key={i} className={`flex ${a.lado}`}>
                  <div className="max-w-[85%] sm:max-w-[75%]">
                    <div className={`mb-0.5 text-[11px] text-slate-500 ${a.lado === "justify-end" ? "text-right" : ""}`}>
                      {a.rotulo} · {dataHora(m.ts)}
                    </div>
                    <div className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm shadow-sm ${a.bolha}`}>{m.texto}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Lateral */}
        <div className="space-y-4">
          <Card>
            <h2 className="mb-2 font-semibold text-slate-900">Triagem</h2>
            <dl className="divide-y divide-slate-100">
              {linha("Urgência", <UrgenciaBadge u={t.urgencia} />)}
              {linha("Rota", <RotaBadge r={t.rota} />)}
              {linha("Score de prioridade", num(t.score))}
              {linha("Motivo (regras)", c.motivo)}
              {c.motivos_secundarios.length > 0 && linha("Motivos secundários", c.motivos_secundarios.join(", "))}
              {linha("Custo da conversa", brl(c.custo))}
            </dl>
            <ul className="mt-3 space-y-1 text-xs text-slate-600">
              {t.motivos_rota.map((m) => (
                <li key={m} className="flex gap-1.5">
                  <span className="text-slate-400">•</span>
                  {m}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold text-slate-900">Sinais</h2>
            <div className="flex flex-wrap gap-1.5">
              {c.sla_estourado ? (
                <Pill tom="alerta">SLA estourado</Pill>
              ) : c.primeira_resposta_min === null ? (
                <Pill tom="alerta">Sem resposta do atendente</Pill>
              ) : (
                <Pill tom="bom">Dentro do SLA</Pill>
              )}
              {c.recontato && <Pill tom="alerta">Recontato ({c.ordem_contato}º contato)</Pill>}
              {c.contatos_cliente >= 3 && <Pill tom="alerta">{c.contatos_cliente} contatos do cliente</Pill>}
              {c.fora_horario && <Pill tom="info">Aberta fora do horário (8h–20h)</Pill>}
              {c.pii && <Pill tom="info">Dados pessoais mascarados</Pill>}
              {c.injecao_prompt && <Pill tom="alerta">Tentativa de instruir a IA</Pill>}
            </div>
            <dl className="mt-3 divide-y divide-slate-100">
              {linha(
                "1ª resposta / SLA",
                <span className={c.sla_estourado ? "text-rose-700" : ""}>
                  {c.primeira_resposta_min === null ? "sem resposta" : minutos(c.primeira_resposta_min)} / {minutos(c.sla_min)}
                </span>,
              )}
              {linha("Contatos do cliente no período", num(c.contatos_cliente))}
              {linha("Contatos sobre este pedido", num(c.contatos_pedido))}
            </dl>
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold text-slate-900">Pedido</h2>
            {p ? (
              <dl className="divide-y divide-slate-100">
                {linha("Número", <span className="font-mono">{p.order_id}</span>)}
                {linha("Produto", p.produto)}
                {linha("SKU", <span className="font-mono">{p.sku}</span>)}
                {linha("Valor", brl(p.valor))}
                {linha("Data do pedido", data(p.data_pedido))}
                {linha("Dias até o contato", num(p.dias_desde_pedido))}
                {linha(
                  "Entrega",
                  <Pill tom={p.status_entrega === "atrasado" ? "alerta" : p.status_entrega === "entregue" ? "bom" : "info"}>
                    {ENTREGA_LABEL[p.status_entrega] ?? p.status_entrega}
                  </Pill>,
                )}
                {linha("Transportadora", p.transportadora)}
                {linha("UF", p.uf)}
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Conversa sem pedido vinculado.</p>
            )}
          </Card>

          {historico.length > 0 && (
            <Card>
              <h2 className="mb-2 font-semibold text-slate-900">Outras conversas do cliente ({historico.length})</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {historico.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 py-1.5">
                    <Link href={`/conversa/${h.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
                      {h.id}
                    </Link>
                    <span className="truncate text-xs text-slate-600">{h.motivo}</span>
                    <span className="whitespace-nowrap text-xs text-slate-400">{data(h.abertura)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <section id="agente" className="scroll-mt-20">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Agente de IA</h2>
        <AgentPanel conversationId={c.id} autorun={autoExecutar} />
      </section>
    </div>
  );
}
