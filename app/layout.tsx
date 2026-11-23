import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Triagem + Ações · Atendimento Gocase & GoBeauté",
  description:
    "Diagnóstico do atendimento com números, fila priorizada e agente de IA que executa ações seguindo as políticas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        <Nav />
        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:py-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-muted sm:px-6">
          Amostra de 1/3 dos clientes, conversas de 02/07 a 29/09/2026. Projeções: ×3 para o período e ×12 para o ano.
          Dados pessoais mascarados.
        </footer>
      </body>
    </html>
  );
}
