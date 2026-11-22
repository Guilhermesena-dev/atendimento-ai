"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Visão executiva" },
  { href: "/#demo", label: "Agente" },
  { href: "/fila", label: "Fila" },
  { href: "/metodologia", label: "Metodologia" },
];

export default function Nav() {
  const path = usePathname();
  const ativo = (href: string) =>
    href === "/" ? path === "/" : href.startsWith("/#") ? path.startsWith("/conversa/") : path.startsWith(href);
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">T+A</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-slate-900">Triagem + Ações</span>
            <span className="block text-xs text-slate-500">Atendimento Gocase &amp; GoBeauté</span>
          </span>
        </Link>
        <nav className="flex flex-wrap gap-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                ativo(l.href) ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
