import Link from "next/link";
import { getConversa, getConversas } from "@/lib/data";
import { triar } from "@/lib/triagem";
import { CANAL_LABEL } from "@/lib/format";
import { DEMOS, demoHref } from "@/lib/demos";
import FilaTable, { type LinhaFila } from "@/components/FilaTable";

export const metadata = { title: "Fila de atendimento · Triagem + Ações" };

export default function FilaPage() {
  const abertas = getConversas().filter((c) => c.status === "pendente" || c.status === "reaberto");

  // Só as colunas necessárias vão para o browser (não o JSON completo).
  const linhas: LinhaFila[] = abertas
    .map((c) => {
      const t = triar(c);
      return {
        id: c.id,
        abertura: c.abertura,
        status: c.status,
        canal: c.canal,
        marca: c.marca,
        motivo: c.motivo,
        urgencia: t.urgencia,
        rota: t.rota,
        motivo_rota: t.motivos_rota[0] ?? "",
        score: t.score,
        contatos_cliente: c.contatos_cliente,
        primeira_resposta_min: c.primeira_resposta_min,
        sla_min: c.sla_min,
        sla_estourado: c.sla_estourado,
        status_entrega: c.pedido?.status_entrega ?? null,
      };
    })
    .sort((a, b) => b.score - a.score);

  const demos = DEMOS.map((d) => ({ ...d, c: getConversa(d.id) })).filter((d) => d.c);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Fila de atendimento</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Conversas pendentes e reabertas, das mais urgentes para as menos. Abra um caso para ver por que ele precisa de atenção e
            rodar o agente de IA, que consulta o pedido e a política e executa a ação permitida.
          </p>
        </div>
        <details className="group w-full text-sm sm:w-auto">
          <summary className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            <span className="chevron" aria-hidden>
              ›
            </span>
            Como a fila é ordenada
          </summary>
          <p className="mt-2 max-w-md rounded-md border border-line bg-surface p-3 text-xs leading-relaxed text-muted">
            Score de prioridade = peso da urgência (crítica 1000, alta 300, média 100, baixa 0) + custo do canal em R$ + 10 por contato do
            cliente (até 6) + 25 se o SLA da 1ª resposta estourou + 20 se a conversa foi reaberta. Reação adversa é sempre crítica; Reclame
            Aqui, 3 ou mais contatos ou tentativa de instruir a IA são alta.
          </p>
        </details>
      </div>

      {demos.length > 0 && (
        <section aria-labelledby="demo-titulo" className="rounded-lg border border-line bg-surface">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
            <h2 id="demo-titulo" className="text-sm font-semibold text-slate-900">
              Casos para ver o agente agindo
            </h2>
            <p className="hidden text-xs text-muted sm:block">Abre a conversa e roda o agente automaticamente (cerca de 10 a 20 s).</p>
          </div>
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-b-lg bg-line lg:grid-cols-3">
            {demos.map((d) => (
              <li key={d.id} className="bg-surface">
                <Link href={demoHref(d.id)} className="group flex h-full gap-2 px-3 py-2.5 hover:bg-slate-50 sm:gap-3 sm:px-4 sm:py-3">
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${d.destaque ? "bg-red-600" : "bg-slate-300"}`}
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold text-slate-900 group-hover:underline sm:text-base">{d.titulo}</span>
                      <span className="hidden font-mono text-[11px] text-muted sm:inline">
                        {d.id} · {CANAL_LABEL[d.c!.canal] ?? d.c!.canal}
                      </span>
                    </span>
                    <span className="mt-0.5 hidden text-xs leading-snug text-muted sm:block">{d.esperado}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FilaTable linhas={linhas} />
    </div>
  );
}
