// Heatmap tag do agente (linhas) × motivo identificado (colunas). Servidor.
import { num, pctFrac } from "@/lib/format";

// Correspondência esperada entre a tag atual da operação e o motivo real.
// Células fora dessa correspondência são divergências (tag não descreve o motivo).
// Mesmo mapa de scripts/insights.py (COMPATIVEL), para que cores e % batam com insights.json.
export const TAG_COMPATIVEL: Record<string, string[]> = {
  Rastreio: ["Onde está meu pedido", "Atraso na entrega"],
  Atraso: ["Atraso na entrega", "Onde está meu pedido"],
  "Produto faltando": ["Item faltante", "Promoção/cupom/brinde"],
  Avaria: ["Avaria/vazamento", "Erro de personalização"],
  Troca: ["Troca", "Arrependimento/cancelamento", "Erro de personalização"],
  Cancelamento: ["Arrependimento/cancelamento"],
  "Reclamação produto": ["Avaria/vazamento", "Erro de personalização", "Troca"],
  Financeiro: ["Cobrança duplicada", "Pagamento/financeiro"],
  Dúvida: ["Dúvida de produto"],
  Promoção: ["Promoção/cupom/brinde"],
  Endereço: ["Endereço"],
  Elogio: ["Elogio"],
  Outros: ["Abandono no bot", "Outros"],
  "(vazia)": ["Abandono no bot"],
};
// Reação adversa nunca é compatível: não existe tag própria (risco regulatório).

export function divergencia(m: { linhas: string[]; colunas: string[]; valores: number[][] }) {
  let total = 0;
  let div = 0;
  m.linhas.forEach((tag, i) =>
    m.colunas.forEach((mot, j) => {
      const v = m.valores[i]?.[j] ?? 0;
      total += v;
      if (!(TAG_COMPATIVEL[tag] ?? []).includes(mot)) div += v;
    }),
  );
  return { total, div, pct: total ? div / total : 0 };
}

export default function MatrizTag({ m }: { m: { linhas: string[]; colunas: string[]; valores: number[][] } }) {
  const max = Math.max(1, ...m.valores.flat());
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white p-1 text-left align-bottom font-medium text-slate-500">
              Tag do agente ↓ / Motivo real →
            </th>
            {m.colunas.map((c) => (
              <th key={c} className="h-32 w-9 p-0 align-bottom">
                <div
                  className={`mx-auto w-6 whitespace-nowrap text-left font-medium [writing-mode:vertical-rl] rotate-180 ${
                    c === "Reação adversa" ? "text-rose-700" : "text-slate-600"
                  }`}
                >
                  {c}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {m.linhas.map((tag, i) => (
            <tr key={tag}>
              <th className="sticky left-0 z-10 whitespace-nowrap bg-white pr-2 text-left font-medium text-slate-700">{tag}</th>
              {m.colunas.map((mot, j) => {
                const v = m.valores[i]?.[j] ?? 0;
                const ok = (TAG_COMPATIVEL[tag] ?? []).includes(mot);
                const alpha = v === 0 ? 0 : 0.12 + 0.88 * Math.sqrt(v / max);
                const bg =
                  v === 0
                    ? "#f8fafc"
                    : ok
                      ? `rgba(79,70,229,${alpha})`
                      : mot === "Reação adversa"
                        ? `rgba(225,29,72,${Math.max(alpha, 0.55)})`
                        : `rgba(245,158,11,${Math.max(alpha, 0.25)})`;
                const escuro = alpha > 0.55 || (mot === "Reação adversa" && v > 0);
                return (
                  <td
                    key={mot}
                    title={`${tag} × ${mot}: ${num(v)} conversas${ok ? "" : v ? " (divergente)" : ""}`}
                    className={`tabular h-8 w-9 rounded text-center ${escuro ? "text-white" : "text-slate-700"} ${
                      !ok && v > 0 ? "font-semibold" : ""
                    }`}
                    style={{ background: bg }}
                  >
                    {v || ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded bg-indigo-600" /> Tag coerente com o motivo</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded bg-amber-400" /> Divergente</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded bg-rose-600" /> Reação adversa (não existe tag)</span>
        <span>Divergência nesta matriz: {pctFrac(divergencia(m).pct)} das conversas.</span>
      </div>
    </div>
  );
}
