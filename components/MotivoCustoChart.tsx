"use client";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { brl, brlCompacto, num } from "@/lib/format";

export interface LinhaMotivoCusto {
  motivo: string;
  custo_ano: number;
  conversas: number;
  pct_evitavel?: number;
}

export default function MotivoCustoChart({ dados }: { dados: LinhaMotivoCusto[] }) {
  const altura = Math.max(320, dados.length * 30 + 40);
  return (
    <div style={{ width: "100%", height: altura }}>
      <ResponsiveContainer>
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" tickFormatter={(v: number) => brlCompacto(v)} tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis type="category" dataKey="motivo" width={170} tick={{ fontSize: 12, fill: "#334155" }} interval={0} />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as LinhaMotivoCusto;
              return (
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-md">
                  <div className="mb-1 font-semibold text-slate-900">{d.motivo}</div>
                  <div>Custo anual projetado: <b>{brl(d.custo_ano, true)}</b></div>
                  <div>Conversas na amostra: <b>{num(d.conversas)}</b></div>
                </div>
              );
            }}
          />
          <Bar dataKey="custo_ano" radius={[0, 4, 4, 0]}>
            {dados.map((d) => (
              <Cell key={d.motivo} fill={d.motivo === "Reação adversa" ? "#e11d48" : "#6366f1"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
