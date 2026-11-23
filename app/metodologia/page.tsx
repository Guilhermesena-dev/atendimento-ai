import { getBaseMetrics, getClassificacaoResumo, getInsights, getKpis } from "@/lib/data";
import { CANAL_LABEL, brl, isNum, minutos, num, pct } from "@/lib/format";
import { Card, SectionTitle } from "@/components/ui";

export const metadata = { title: "Metodologia · Triagem + Ações" };

type ConcMotivo = Record<string, { n?: number; concordancia_pct?: number }>;

function Formula({ nome, expr, exemplo }: { nome: string; expr: string; exemplo?: string }) {
  return (
    <div className="py-3">
      <div className="text-sm font-medium text-slate-900">{nome}</div>
      <code className="mt-1 block rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 ring-1 ring-slate-200">{expr}</code>
      {exemplo && <div className="mt-1 text-xs text-slate-500">{exemplo}</div>}
    </div>
  );
}

export default function Metodologia() {
  const b = getBaseMetrics();
  const ins = getInsights();
  const k = getKpis();
  const cls = getClassificacaoResumo();

  const canais = Object.keys(b.custo_canal);
  const conc = (cls?.concordancia_por_motivo ?? null) as ConcMotivo | null;
  const concGeral = cls?.concordancia_geral_pct;
  const nClass = cls?.n_classificadas;
  const nAmostra = cls?.n_amostra;
  const modelos = cls?.modelos as Record<string, number> | undefined;
  const nota = typeof cls?.nota_amostra === "string" ? cls.nota_amostra : undefined;
  const parcial = isNum(nClass) && isNum(nAmostra) && nClass < nAmostra;
  const N_MIN = 10; // abaixo disso o percentual por motivo não é informativo
  const concLinhas = conc ? Object.entries(conc).sort((a, c) => (c[1].n ?? 0) - (a[1].n ?? 0)) : [];
  const concVisiveis = concLinhas.filter(([, v]) => (v.n ?? 0) >= N_MIN);
  const concOcultos = concLinhas.length - concVisiveis.length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-muted">Metodologia</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Como os números foram calculados</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Todos os números do painel vêm de arquivos gerados a partir dos dados da operação (data/base_metrics.json, data/insights.json e
          data/conversas.json). Aqui estão as premissas, as fórmulas e o que os dados não permitem afirmar.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle titulo="Premissas" />
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>
              Os dados são uma <b>amostra de 1/3 dos clientes</b>: {num(b.total_conversas)} conversas de 02/07 a 29/09/2026 (90 dias).
            </li>
            <li>
              Total do período = amostra × {b.fatores.periodo}. Ano = amostra × {b.fatores.anual} (×3 da amostra × 4 trimestres), supondo
              sazonalidade estável.
            </li>
            <li>Atendimento humano das 8h às 20h; fora disso só o bot responde. O SLA conta apenas minutos dentro desse horário.</li>
            <li>Custo por conversa é o custo médio do canal informado pela operação, independente do número de mensagens.</li>
          </ul>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Canal</th>
                  <th className="py-1.5 pr-3 font-medium">Custo/conversa</th>
                  <th className="py-1.5 pr-3 font-medium">SLA 1ª resposta</th>
                  <th className="py-1.5 font-medium">Conversas (amostra)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {canais.map((c) => (
                  <tr key={c}>
                    <td className="py-2 pr-3 font-medium text-slate-800">{CANAL_LABEL[c] ?? c}</td>
                    <td className="tabular py-2 pr-3">{brl(b.custo_canal[c])}</td>
                    <td className="tabular py-2 pr-3">{minutos(b.sla_min[c])}</td>
                    <td className="tabular py-2">{num(b.por_canal[c])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <SectionTitle titulo="Como o motivo é identificado" />
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>
              <b>Regras determinísticas</b> (scripts/preprocess.py) sobre o primeiro trecho da 1ª mensagem do cliente, depois de remover
              prefixos de recontato (&quot;Já é a 2ª vez...&quot;), dados pessoais e tentativas de instruir a IA. Se a mensagem traz um
              segundo assunto (&quot;Aproveitando, ...&quot;), ele vira motivo secundário.
            </li>
            <li>
              <b>Reação adversa tem precedência</b>: qualquer mensagem do cliente com alergia, coceira, irritação, vermelhidão, ardência ou
              reação classifica a conversa como Reação adversa, por ser obrigação regulatória.
            </li>
            <li>Conversas sem mensagem do cliente são Abandono no bot.</li>
            <li>
              <b>LLM para validação e enriquecimento</b>: uma amostra estratificada é reclassificada por um modelo via Groq (motivo,
              urgência, evitável, requer humano). Comparamos com as regras para medir a concordância.
            </li>
          </ol>
          {cls ? (
            <div className="mt-4 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <div>
                  <div className="text-xs text-slate-500">Concordância regras × LLM</div>
                  <div className="tabular text-2xl font-semibold text-slate-900">{isNum(concGeral) ? pct(concGeral) : "—"}</div>
                </div>
                <div className="text-xs text-slate-600">
                  {parcial && (
                    <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
                      parcial: {num(nClass)} de {num(nAmostra)}
                    </span>
                  )}
                  {isNum(nClass) && <>{num(nClass)} conversas classificadas</>}
                  {isNum(nAmostra) && <> de {num(nAmostra)} na amostra de validação</>}
                  {modelos && Object.keys(modelos).length > 0 && <> · modelo: {Object.keys(modelos).join(", ")}</>}
                </div>
              </div>
              {concVisiveis.length > 0 && (
                <table className="mt-3 w-full text-xs">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Motivo (regras)</th>
                      <th className="py-1 pr-3 font-medium">n</th>
                      <th className="py-1 font-medium">Concordância</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {concVisiveis.map(([m, v]) => (
                        <tr key={m}>
                          <td className="py-1 pr-3 text-slate-700">{m}</td>
                          <td className="tabular py-1 pr-3">{num(v.n)}</td>
                          <td className="tabular py-1">{pct(v.concordancia_pct)}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {concOcultos > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  {num(concOcultos)} motivo(s) com menos de {N_MIN} conversas classificadas não exibidos: amostra pequena demais para percentual.
                </p>
              )}
              {nota && <p className="mt-2 text-xs text-slate-500">{nota}</p>}
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500">A validação por LLM ainda não foi consolidada nesta versão.</p>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle titulo="Fórmulas" />
        <div className="divide-y divide-slate-100">
          <Formula
            nome="Custo da amostra"
            expr="Σ custo do canal de cada conversa"
            exemplo={`${num(b.por_canal.whatsapp)} × R$ 4,80 + ${num(b.por_canal.email)} × R$ 7,20 + ${num(b.por_canal.reclame_aqui)} × R$ 42,00 = ${brl(b.custo_amostra)}`}
          />
          <Formula
            nome="Custo no período e no ano"
            expr={`custo_periodo = custo_amostra × ${b.fatores.periodo};  custo_ano = custo_amostra × ${b.fatores.anual}`}
            exemplo={`${brl(k.custo_periodo, true)} no período · ${brl(k.custo_ano, true)} por ano`}
          />
          <Formula
            nome="Economia de uma iniciativa"
            expr="economia_ano = contatos evitados na amostra × custo do canal de cada contato × 12"
            exemplo="A taxa de contatos evitados de cada iniciativa é uma premissa explícita, mostrada no card da iniciativa."
          />
          <Formula
            nome="SLA de 1ª resposta"
            expr="minutos entre a abertura e a 1ª mensagem do atendente, contando só 8h–20h > SLA do canal"
            exemplo={`${num(b.sla_estourado)} conversas da amostra (${pct(k.pct_sla_estourado)}) estouraram o SLA.`}
          />
          <Formula
            nome="Recontato"
            expr="cliente já havia aberto outra conversa no período (ordem_contato > 1) ou a mensagem indica novo contato (&quot;Já é a 2ª vez...&quot;, &quot;Ninguém me respondeu&quot;)"
            exemplo={`${num(b.recontato)} conversas (${pct(k.pct_recontato)}).`}
          />
          <Formula
            nome="Tag divergente"
            expr="tag do atendente fora do conjunto de motivos compatíveis com ela (Reação adversa nunca é compatível: não existe tag)"
            exemplo={`${pct(k.pct_tag_divergente)} das conversas.`}
          />
          {ins.criterio_ranking && <Formula nome="Ranking “atacar primeiro”" expr={ins.criterio_ranking} />}
          <Formula
            nome="Prioridade na fila"
            expr="peso da urgência (crítica 1000 · alta 300 · média 100 · baixa 0) + custo do canal em R$ + 10 × contatos do cliente (até 6) + 25 se SLA estourado + 20 se reaberta"
            exemplo="Urgência crítica = reação adversa. Alta = Reclame Aqui, 3+ contatos ou tentativa de instruir a IA. Média = SLA estourado, reaberta ou problema físico/financeiro."
          />
          <Formula
            nome="Rota automática × humana"
            expr="humano se: reação adversa, Reclame Aqui, 3+ contatos, tentativa de instruir a IA, pedido ≥ R$ 300 com impacto financeiro ou endereço após a separação; senão automático"
          />
        </div>
      </Card>

      <Card>
        <SectionTitle titulo="Limitações" />
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>
            Não há data de entrega nos pedidos: usamos os dias entre o pedido e a abertura da conversa como aproximação para prazos de 7 e
            30 dias das políticas.
          </li>
          <li>O custo por conversa é médio por canal; conversas longas ou com várias trocas custam mais na prática.</li>
          <li>A projeção anual supõe que o trimestre observado é representativo (sem sazonalidade de Black Friday ou Natal).</li>
          <li>
            As taxas de contatos evitados por iniciativa são premissas conservadoras, não resultados medidos; devem ser validadas com um
            piloto.
          </li>
          <li>
            A classificação por regras depende das frases usadas pelos clientes; a validação por LLM cobre uma amostra estratificada, não a
            base inteira.
          </li>
          <li>Os dados são sintéticos e trazem dados pessoais já mascarados ([CPF], [CARTÃO], [TELEFONE], [EMAIL]).</li>
        </ul>
      </Card>

      {!!ins.perguntas?.some((p) => p.premissas?.length) && (
        <Card>
          <SectionTitle titulo="Premissas por pergunta" />
          <div className="grid gap-4 md:grid-cols-2">
            {ins.perguntas!
              .filter((p) => p.premissas?.length)
              .map((p) => (
                <div key={p.id}>
                  <div className="text-sm font-medium text-slate-900">{p.titulo}</div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-600">
                    {p.premissas!.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
