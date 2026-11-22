import { getConversas } from "@/lib/data";
import { triar } from "@/lib/triagem";
import { num, pctFrac } from "@/lib/format";
import { Kpi } from "@/components/ui";
import FilaTable, { type LinhaFila } from "@/components/FilaTable";

export const metadata = { title: "Fila priorizada · Triagem + Ações" };

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

  const humano = linhas.filter((l) => l.rota === "humano").length;
  const auto = linhas.length - humano;
  const criticas = linhas.filter((l) => l.urgencia === "crítica").length;
  const sla = linhas.filter((l) => l.sla_estourado).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Fila priorizada</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Conversas pendentes e reabertas</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Ordenadas pelo score de prioridade da triagem: peso da urgência (crítica 1000, alta 300, média 100, baixa 0) + custo do canal
          em R$ + 10 por contato do cliente (até 6) + 25 se o SLA estourou + 20 se reaberta. A rota indica se o agente resolve sozinho
          ou se a conversa vai para um atendente.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Na fila" valor={num(linhas.length)} detalhe="status pendente ou reaberto" />
        <Kpi
          rotulo="Rota automática"
          valor={num(auto)}
          detalhe={`${pctFrac(linhas.length ? auto / linhas.length : 0)} da fila`}
          tom="bom"
        />
        <Kpi rotulo="Rota humana" valor={num(humano)} detalhe={`${pctFrac(linhas.length ? humano / linhas.length : 0)} da fila`} />
        <Kpi
          rotulo="Críticas · SLA estourado"
          valor={`${num(criticas)} · ${num(sla)}`}
          detalhe="reação adversa · 1ª resposta fora do SLA"
          tom="alerta"
        />
      </div>
      <FilaTable linhas={linhas} />
    </div>
  );
}
