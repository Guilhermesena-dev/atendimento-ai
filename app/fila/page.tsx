import { redirect } from "next/navigation";

// A fila passou a ser a página inicial; mantemos /fila (com seus filtros) para links antigos.
export default async function FilaRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) for (const x of [v].flat()) q.append(k, x);
  const s = q.toString();
  redirect(s ? `/?${s}` : "/");
}
