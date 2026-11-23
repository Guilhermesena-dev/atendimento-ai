"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Fila de atendimento", curto: "Fila" },
  { href: "/resumo", label: "Resumo executivo", curto: "Resumo" },
  { href: "/metodologia", label: "Metodologia", curto: "Metodologia" },
];

export default function Nav() {
  const path = usePathname();
  const ativo = (href: string) => (href === "/" ? path === "/" || path.startsWith("/conversa/") : path.startsWith(href));
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:px-6">
        <Link href="/" className="flex items-center gap-2 py-1">
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded bg-slate-900 text-xs font-bold text-white">
            T+A
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-slate-900">Triagem + Ações</span>
            <span className="block text-[11px] text-muted">Atendimento Gocase &amp; GoBeauté</span>
          </span>
        </Link>
        <nav aria-label="Principal" className="-mx-1 flex max-w-full gap-1 overflow-x-auto text-sm">
          {LINKS.map((l) => {
            const on = ativo(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? "page" : undefined}
                className={`whitespace-nowrap border-b-2 px-2.5 py-2 font-medium ${
                  on ? "border-slate-900 text-slate-900" : "border-transparent text-muted hover:text-slate-900"
                }`}
              >
                <span className="sm:hidden">{l.curto}</span>
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
