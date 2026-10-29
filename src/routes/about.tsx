import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, ClipboardCheck, Database, FlaskConical, ShieldCheck, Timer, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "Sobre o FluxoIA — Projeto de portfólio AI Builder" },
      { name: "description", content: "Problema, solução, arquitetura e tecnologias do FluxoIA, central de solicitações com agentes de IA e n8n." },
      { property: "og:title", content: "Sobre o FluxoIA — Projeto de portfólio AI Builder" },
      { property: "og:description", content: "Central de solicitações com agentes de IA supervisionados, automação n8n e métricas verificáveis." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: About,
});

const FEATURES = [
  { icon: Bot, t: "Triagem com 3 agentes", d: "Classificador, resumidor e planejador com saída JSON validada por schema." },
  { icon: ClipboardCheck, t: "Supervisão humana", d: "Toda sugestão pode ser aprovada ou corrigida, com registro de valor original, revisor e horário." },
  { icon: Workflow, t: "Automação n8n", d: "Webhooks assinados com HMAC, idempotência, retentativas e auditoria de cada execução." },
  { icon: Timer, t: "Impacto medido", d: "Tempos manuais observados versus duração real das análises, com fórmulas documentadas." },
  { icon: FlaskConical, t: "Avaliação da IA", d: "Conjunto sintético com casos ambíguos e tentativas de injeção de instruções." },
  { icon: ShieldCheck, t: "Segurança", d: "Isolamento por organização com RLS e credenciais apenas no servidor." },
];

function About() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 font-display text-lg font-semibold"><Workflow className="h-5 w-5 text-primary" />FluxoIA</span>
          <Button asChild><Link to="/dashboard">Abrir aplicação</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-14">
        <p className="text-sm font-medium text-primary">Projeto de portfólio · Trilha AI Builder</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">Central Inteligente de Solicitações</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Pequenas equipes de operações, suporte e administração recebem demandas de vários canais e gastam tempo lendo, classificando, priorizando e encaminhando cada uma. O FluxoIA centraliza esse trabalho e usa IA generativa para sugerir — nunca decidir sozinha.
        </p>

        <section className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-semibold">O problema</h2>
            <p className="mt-2 text-sm text-muted-foreground">Triagem manual demorada, critérios inconsistentes de prioridade, pouca rastreabilidade e nenhuma medição de quanto tempo o processo realmente consome.</p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-semibold">A solução</h2>
            <p className="mt-2 text-sm text-muted-foreground">Registro estruturado, análise por agentes de IA com responsabilidades separadas, revisão humana obrigatória em casos sensíveis, orquestração via n8n e um painel com métricas derivadas dos dados.</p>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Funcionalidades</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.t} className="rounded-xl border bg-card p-5">
                <f.icon className="h-5 w-5 text-primary" />
                <p className="mt-3 font-medium">{f.t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-xl border bg-card p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold"><Database className="h-5 w-5 text-primary" />Tecnologias</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            React 19 + TypeScript, TanStack Start (SSR e funções de servidor), Tailwind CSS v4, shadcn/ui, Recharts, React Hook Form + Zod, Lovable Cloud (PostgreSQL, autenticação e RLS), LLM via API compatível com OpenAI (padrão: Lovable AI Gateway) e n8n para orquestração.
          </p>
        </section>
        <p className="mt-10 text-xs text-muted-foreground">Todos os dados de demonstração são fictícios.</p>
      </main>
    </div>
  );
}
