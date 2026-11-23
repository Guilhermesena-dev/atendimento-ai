import Link from "next/link";
import { getBaseMetrics, getConversa, getConversas, getInsights, getKpis, type Pergunta } from "@/lib/data";
import { CANAL_LABEL, brl, brlCompacto, isNum, num, pct } from "@/lib/format";
import { triar } from "@/lib/triagem";
import { Card, Kpi, Pill, SectionTitle } from "@/components/ui";
import MotivoCustoChart, { type LinhaMotivoCusto } from "@/components/MotivoCustoChart";
import MatrizTag, { divergencia } from "@/components/MatrizTag";
import { DEMOS } from "@/lib/demos";

const PERGUNTAS_PADRAO: { id: string; titulo: string }[] = [
  { id: "por_que", titulo: "Por que os clientes entram em contato?" },
  { id: "atacar_primeiro", titulo: "O que atacar primeiro?" },
  { id: "evitaveis", titulo: "Quais contatos são evitáveis?" },
  { id: "automatizar", titulo: "O que dá para automatizar e o que precisa de humano?" },
];

function valorNumero(v: string | number) {
  return typeof v === "number" ? num(v) : v;
}

export const metadata = { title: "Resumo executivo · Triagem + Ações" };

export default function ResumoPage() {
  const b = getBaseMetrics();
  const ins = getInsights();
  const k = getKpis();
  const conversas = getConversas();

  // Gráfico motivo × custo anual: insights.motivos quando houver, senão base_metrics.por_motivo.
  const dadosGrafico: LinhaMotivoCusto[] = (
    ins.motivos?.length
      ? ins.motivos
          .filter((m) => isNum(m.custo_ano))
          .map((m) => ({ motivo: m.motivo, custo_ano: m.custo_ano as number, conversas: m.conversas ?? 0, pct_evitavel: m.pct_evitavel }))
      : b.por_motivo.map((m) => ({ motivo: m.motivo, custo_ano: m.custo_anual, conversas: m.conversas }))
  ).sort((a, c) => c.custo_ano - a.custo_ano);

  const ranking = ins.ranking_atacar?.length
    ? ins.ranking_atacar
    : [...b.por_motivo]
        .sort((a, c) => c.custo_anual - a.custo_anual)
        .slice(0, 5)
        .map((m, i) => ({
          posicao: i + 1,
          motivo_ou_iniciativa: m.motivo,
          score: undefined as number | undefined,
          custo_ano: m.custo_anual,
          fator_risco: `${num(m.reclame_aqui)} no Reclame Aqui`,
          esforco: undefined as string | undefined,
          justificativa: `${num(m.conversas)} conversas na amostra; ${num(m.recontato)} de clientes recorrentes.`,
        }));
  const criterio =
    ins.criterio_ranking ??
    "Provisório: ordenado pelo custo anual projetado (custo da amostra × 12), até a análise completa ser gerada.";

  const perguntas: (Pergunta & { titulo: string })[] = PERGUNTAS_PADRAO.map((p) => {
    const achada = ins.perguntas?.find((q) => q.id === p.id);
    return { ...p, ...achada, titulo: achada?.titulo ?? p.titulo };
  });

  const div = divergencia(b.matriz_tag_x_motivo);
  const pctDivergente = k.pct_tag_divergente ?? div.pct * 100; // pontos percentuais

  const demos = DEMOS.map((d) => ({ ...d, c: getConversa(d.id) })).filter((d) => d.c);

  // Caso de reação adversa: o da demo; se não existir, o de maior prioridade na triagem.
  const casoRA = getConversa("CV920357") ?? conversas
    .filter((c) => c.motivo === "Reação adversa")
    .map((c) => ({ c, t: triar(c) }))
    .sort((a, c) => Number(c.c.status !== "resolvido") - Number(a.c.status !== "resolvido") || c.t.score - a.t.score)[0]?.c;

  const fila = (b.por_status.pendente ?? 0) + (b.por_status.reaberto ?? 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Resumo executivo</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Triagem + Ações · Atendimento Gocase &amp; GoBeauté
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Por que os clientes nos procuram, quanto isso custa e o que fazer primeiro. Base: {num(k.conversas_amostra)} conversas
            da amostra (1/3 dos clientes, 02/07 a 29/09/2026), projetadas para o trimestre e para o ano.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Abrir fila ({num(fila)} pendentes/reabertas)
          </Link>
          {casoRA && (
            <Link
              href={`/conversa/${casoRA.id}?autorun=1#agente`}
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Ver caso de reação adversa
            </Link>
          )}
        </div>
      </div>

      {/* Demonstração do agente */}
      {demos.length > 0 && (
        <section id="demo" className="scroll-mt-20 rounded-lg border border-line bg-surface p-5">
          <SectionTitle
            titulo="Veja o agente agindo"
            sub="Cada caso abre a conversa e roda o agente: ele consulta o pedido e a política, executa a ação (simulada) e mostra o passo a passo."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {demos.map((d) => (
              <Link
                key={d.id}
                href={`/conversa/${d.id}?autorun=1#agente`}
                className={`group flex flex-col rounded-lg border bg-white p-4 transition hover:border-slate-400 ${
                  d.destaque ? "border-rose-200" : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-semibold ${d.destaque ? "text-rose-700" : "text-slate-900"}`}>{d.titulo}</span>
                  <span className="font-mono text-xs text-muted">{d.id}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{d.esperado}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                  <Pill>{CANAL_LABEL[d.c!.canal] ?? d.c!.canal}</Pill>
                  <Pill>{d.c!.marca}</Pill>
                  <span className="ml-auto font-semibold text-blue-700 group-hover:text-blue-800">Rodar agente →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          rotulo="Conversas no período"
          valor={num(k.conversas_periodo)}
          detalhe={<>Amostra {num(k.conversas_amostra)} × 3 · {num(k.conversas_ano)}/ano</>}
          fonte="kpis.conversas_periodo"
        />
        <Kpi
          rotulo="Custo no período"
          valor={brlCompacto(k.custo_periodo)}
          detalhe={<>Custo por canal × conversas × 3 ({brl(k.custo_periodo, true)})</>}
          fonte="kpis.custo_periodo"
        />
        <Kpi
          rotulo="Custo anual projetado"
          valor={brlCompacto(k.custo_ano)}
          detalhe={<>Amostra × 12 ({brl(k.custo_ano, true)})</>}
          fonte="kpis.custo_ano"
        />
        <Kpi
          rotulo="Contatos evitáveis"
          valor={pct(k.pct_evitavel)}
          detalhe={
            isNum(k.economia_potencial_ano) ? (
              <>Economia potencial de {brlCompacto(k.economia_potencial_ano)}/ano</>
            ) : (
              <>Análise de evitabilidade em processamento</>
            )
          }
          tom="bom"
          fonte="kpis.pct_evitavel"
        />
        <Kpi
          rotulo="Reação adversa sem registro"
          valor={num(k.reacao_adversa_sem_tag_correta)}
          detalhe={<>de {num(k.reacao_adversa_amostra)} casos na amostra; não existe tag nem protocolo de cosmetovigilância</>}
          tom="alerta"
          fonte="kpis.reacao_adversa_sem_tag_correta"
        />
        <Kpi
          rotulo="Conversas de recontato"
          valor={pct(k.pct_recontato)}
          detalhe={
            isNum(k.contatos_por_pedido) ? (
              <>cliente já havia falado conosco · {num(k.contatos_por_pedido * 1000)} conversas a cada 1.000 pedidos</>
            ) : (
              <>cliente já havia falado conosco no período</>
            )
          }
          tom="alerta"
          fonte="kpis.pct_recontato"
        />
        <Kpi
          rotulo="SLA de 1ª resposta estourado"
          valor={pct(k.pct_sla_estourado)}
          detalhe={<>{num(b.sla_estourado)} conversas na amostra, em horário comercial</>}
          tom="alerta"
          fonte="kpis.pct_sla_estourado"
        />
        <Kpi
          rotulo="Tag do agente divergente"
          valor={pct(pctDivergente)}
          detalhe={<>A tag atual não descreve o motivo real</>}
          tom="alerta"
          fonte={k.pct_tag_divergente !== undefined ? "kpis.pct_tag_divergente" : "base_metrics.matriz_tag_x_motivo"}
        />
      </div>

      {/* As 4 perguntas */}
      <section>
        <SectionTitle titulo="As 4 perguntas do desafio" sub="Resposta curta com os números que a sustentam. Clique para ver fórmulas e premissas." />
        <div className="grid gap-4 md:grid-cols-2">
          {perguntas.map((p, i) => (
            <details key={p.id} className="group rounded-lg border border-slate-200 bg-white" open={i === 0}>
              <summary className="flex gap-3 p-5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-blue-800">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-900">{p.titulo}</h3>
                  <p className="mt-1 text-sm text-slate-600">{p.resposta_curta ?? "Análise em processamento."}</p>
                  {!!p.numeros?.length && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.numeros.slice(0, 3).map((n) => (
                        <span key={n.rotulo} className="rounded-md bg-slate-50 px-2 py-1 text-xs ring-1 ring-slate-200">
                          <span className="text-slate-500">{n.rotulo}: </span>
                          <b className="tabular text-slate-900">{valorNumero(n.valor)}</b>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span aria-hidden className="chevron mt-1 self-start leading-none text-slate-400 transition">›</span>
              </summary>
              <div className="space-y-4 border-t border-slate-100 px-5 pb-5 pt-4 text-sm">
                {!!p.bullets?.length && (
                  <ul className="list-disc space-y-1 pl-5 text-slate-700">
                    {p.bullets.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
                {!!p.numeros?.length && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-left text-slate-500">
                        <tr>
                          <th className="py-1 pr-3 font-medium">Número</th>
                          <th className="py-1 pr-3 font-medium">Valor</th>
                          <th className="py-1 font-medium">Fórmula</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {p.numeros.map((n) => (
                          <tr key={n.rotulo}>
                            <td className="py-1.5 pr-3 text-slate-700">{n.rotulo}</td>
                            <td className="tabular py-1.5 pr-3 font-semibold text-slate-900">{valorNumero(n.valor)}</td>
                            <td className="py-1.5 font-mono text-[11px] text-slate-500">{n.formula ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!!p.premissas?.length && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Premissas</div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-600">
                      {p.premissas.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {p.confianca && (
                  <div className="text-xs text-slate-500">
                    Confiança: <Pill tom="info">{p.confianca}</Pill>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Gráfico + ranking */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionTitle
            titulo="Custo anual projetado por motivo"
            sub="Custo do canal (WhatsApp R$ 4,80 · e-mail R$ 7,20 · Reclame Aqui R$ 42,00) × conversas da amostra × 12"
          />
          <MotivoCustoChart dados={dadosGrafico} />
        </Card>
        <Card className="lg:col-span-2">
          <SectionTitle titulo="Atacar primeiro" sub={<span><b className="text-slate-700">Critério:</b> {criterio}</span>} />
          <ol className="space-y-3">
            {ranking.map((r, i) => (
              <li key={r.motivo_ou_iniciativa} className="flex gap-3 rounded-lg border border-slate-100 p-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {r.posicao ?? i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-slate-900">{r.motivo_ou_iniciativa}</span>
                    <span className="tabular text-sm font-semibold text-slate-900">{brl(r.custo_ano, true)}/ano</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {isNum(r.score) && <Pill tom="info">score {num(r.score)}</Pill>}
                    {r.fator_risco !== undefined && r.fator_risco !== "" && <Pill tom="alerta">risco: {String(r.fator_risco)}</Pill>}
                    {r.esforco && <Pill>esforço: {r.esforco}</Pill>}
                  </div>
                  {r.justificativa && <p className="mt-1.5 text-xs text-slate-600">{r.justificativa}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {/* Iniciativas */}
      <section>
        <SectionTitle
          titulo="Iniciativas e economia estimada"
          sub="Contatos evitados por ano × custo do canal. Cada card mostra a premissa usada."
          right={
            isNum(k.economia_potencial_ano) ? (
              <span className="text-sm text-slate-600">
                Total potencial: <b className="text-emerald-700">{brl(k.economia_potencial_ano, true)}/ano</b>
              </span>
            ) : undefined
          }
        />
        {ins.iniciativas?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ins.iniciativas.map((it) => (
              <Card key={it.id ?? it.nome} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{it.nome}</h3>
                  {it.tipo && <Pill tom="info">{it.tipo}</Pill>}
                </div>
                {it.descricao && <p className="mt-1 text-sm text-slate-600">{it.descricao}</p>}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-slate-500">Economia/ano</div>
                    <div className="tabular text-lg font-semibold text-emerald-700">{brl(it.economia_ano, true)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Contatos evitados/ano</div>
                    <div className="tabular text-lg font-semibold text-slate-900">{num(it.contatos_evitados_ano)}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {it.esforco && <Pill>esforço: {it.esforco}</Pill>}
                  {it.motivos?.map((m) => (
                    <Pill key={m}>{m}</Pill>
                  ))}
                </div>
                {it.premissa && <p className="mt-auto pt-3 text-xs text-slate-500">Premissa: {it.premissa}</p>}
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <p className="text-sm text-slate-600">As iniciativas com economia estimada aparecem aqui assim que a análise for gerada.</p>
          </Card>
        )}
      </section>

      {/* Automação */}
      {(isNum(ins.automacao?.auto_pct) || !!ins.automacao?.por_motivo?.length) && (
        <Card>
          <SectionTitle
            titulo="Automático × humano"
            sub="Rota definida pelo motor de políticas: o agente resolve sozinho o que a política cobre; o resto vai para um atendente."
          />
          {isNum(ins.automacao?.auto_pct) && isNum(ins.automacao?.humano_pct) && (
            <div className="mb-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="bg-emerald-500" style={{ width: `${ins.automacao!.auto_pct}%` }} />
                <div className="bg-violet-500" style={{ width: `${ins.automacao!.humano_pct}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-xs text-slate-600">
                <span>Automático: <b>{pct(ins.automacao!.auto_pct)}</b></span>
                <span>Humano: <b>{pct(ins.automacao!.humano_pct)}</b></span>
              </div>
            </div>
          )}
          {!!ins.automacao?.por_motivo?.length && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">Motivo</th>
                    <th className="py-1.5 pr-3 font-medium">Rota</th>
                    <th className="py-1.5 font-medium">Por quê</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ins.automacao!.por_motivo!.map((m) => (
                    <tr key={m.motivo}>
                      <td className="py-2 pr-3 font-medium text-slate-800">{m.motivo}</td>
                      <td className="py-2 pr-3">
                        <Pill tom={/humano/i.test(m.rota) ? "alerta" : /auto/i.test(m.rota) ? "bom" : "neutro"}>{m.rota}</Pill>
                      </td>
                      <td className="py-2 text-xs text-slate-600">{m.justificativa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Matriz */}
      <Card>
        <SectionTitle
          titulo="Tag do agente × motivo real"
          sub={
            <>
              A tag atual não serve para gestão: {pct(pctDivergente)} das conversas têm tag que não descreve o motivo, e {num(
                k.reacao_adversa_amostra,
              )}{" "}
              casos de reação adversa estão espalhados em outras tags.
            </>
          }
        />
        <MatrizTag m={b.matriz_tag_x_motivo} />
        {!!ins.tag_vs_motivo?.exemplos?.length && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {ins.tag_vs_motivo.exemplos.map((e) => (
              <span key={`${e.tag_agente}-${e.motivo}`} className="rounded-md bg-amber-50 px-2 py-1 text-amber-900 ring-1 ring-amber-200">
                Tag <b>{e.tag_agente}</b> → na verdade <b>{e.motivo}</b>: {num(e.conversas)}
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className="rounded-lg bg-slate-900 p-6 text-white sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Da análise para a ação</h2>
          <p className="mt-1 text-sm text-slate-300">
            A fila prioriza {num(fila)} conversas pendentes ou reabertas por urgência e risco; o agente executa a ação prevista na política.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 sm:mt-0">
          <Link href="/" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">
            Ir para a fila
          </Link>
          <Link href="/metodologia" className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Metodologia
          </Link>
        </div>
      </div>
    </div>
  );
}
