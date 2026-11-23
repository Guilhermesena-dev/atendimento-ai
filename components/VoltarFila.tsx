"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

// Volta para a fila com os mesmos filtros (FilaTable guarda a última URL da fila na sessão).
export default function VoltarFila() {
  const [href, setHref] = useState("/");
  useEffect(() => {
    try {
      const u = sessionStorage.getItem("atendimento-ai:fila-url");
      if (u && (u === "/" || u.startsWith("/?"))) setHref(u);
    } catch {
      /* sessionStorage indisponível */
    }
  }, []);
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
      <span aria-hidden>←</span> Fila de atendimento
    </Link>
  );
}
