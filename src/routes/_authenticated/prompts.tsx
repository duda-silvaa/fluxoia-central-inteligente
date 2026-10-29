import { createFileRoute } from "@tanstack/react-router";
import { AGENT_PROMPTS, EVALUATION_CRITERIA, PROMPT_CHANGELOG, PROMPT_VERSION } from "@/lib/ai/prompts";
import { REVIEW_CONFIDENCE_THRESHOLD } from "@/lib/ai/schemas";
import { PageHeader } from "@/components/app/common";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/_authenticated/prompts")({
  head: () => ({
    meta: [
      { title: "Prompts dos agentes — FluxoIA" },
      { name: "description", content: "Documentação versionada dos prompts do classificador, resumidor e planejador." },
      { property: "og:title", content: "Prompts dos agentes — FluxoIA" },
      { property: "og:description", content: "Documentação versionada dos prompts dos agentes de IA." },
    ],
  }),
  component: PromptsPage,
});

const EXAMPLE_IN = `<solicitacao>
<titulo>Erro ao salvar pedido no sistema de compras</titulo>
<descricao>Ao clicar em salvar aparece 'Erro 500'. Tenho 15 pedidos para lançar até amanhã.</descricao>
</solicitacao>`;
const EXAMPLE_OUT = `{"category":"Sistemas e aplicações","priority":"Alta","summary":"O solicitante relata erro 500 ao salvar pedidos no sistema de compras, com prazo até amanhã.","reasoning_summary":"Falha em aplicação que impede o trabalho com prazo curto.","suggested_action":"Verificar logs do sistema de compras e a disponibilidade do serviço.","missing_information":["Horário da primeira ocorrência"],"confidence_estimate":0.8,"requires_human_review":false}`;

function PromptsPage() {
  return (
    <div>
      <PageHeader
        title="Prompts dos agentes"
        description={`Versão ativa: ${PROMPT_VERSION}. Os prompts são versionados no código-fonte (edição controlada via revisão de código); esta página é documentação somente leitura.`}
      />
      <div className="mb-6 rounded-xl border bg-card p-5 text-sm">
        <h2 className="mb-2 font-semibold">Arquitetura de orquestração implementada</h2>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Agente 1 (Classificador) recebe a solicitação delimitada e retorna categoria, prioridade, justificativa, confiança, ambiguidade e detecção de injeção.</li>
          <li>Agente 2 (Resumidor) recebe a mesma entrada e retorna somente o resumo factual.</li>
          <li>Agente 3 (Planejador) recebe a entrada + classificação e retorna próxima ação, informações ausentes e necessidade de revisão.</li>
          <li>Cada etapa é validada por schema Zod (campos extras são rejeitados); falhas transitórias ou saídas inválidas têm 1 nova tentativa; timeout de 45 s por etapa.</li>
          <li>Regra determinística final: revisão humana obrigatória se qualquer agente pedir, houver ambiguidade, injeção detectada, prioridade Crítica ou confiança &lt; {REVIEW_CONFIDENCE_THRESHOLD}.</li>
          <li>A IA só preenche categoria/prioridade vazias e muda o status para “Em triagem” ou “Pendente de revisão”. Nunca exclui, encaminha dados ou altera permissões.</li>
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">Os três agentes usam o mesmo modelo com prompts distintos — não são agentes autônomos independentes.</p>
      </div>
      <Accordion type="multiple" className="rounded-xl border bg-card px-5">
        {AGENT_PROMPTS.map((p) => (
          <AccordionItem key={p.id} value={p.id}>
            <AccordionTrigger className="text-left font-semibold">{p.name}</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              <p><b>Objetivo:</b> {p.objective}</p>
              <p><b>Entrada:</b> <code className="rounded bg-muted px-1">{p.inputFormat}</code></p>
              <p><b>Saída:</b> <code className="rounded bg-muted px-1">{p.outputFormat}</code></p>
              <div><b>Instruções de sistema:</b><pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">{p.system}</pre></div>
            </AccordionContent>
          </AccordionItem>
        ))}
        <AccordionItem value="example">
          <AccordionTrigger className="font-semibold">Exemplo de entrada e saída combinada</AccordionTrigger>
          <AccordionContent className="space-y-2 text-sm">
            <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-xs">{EXAMPLE_IN}</pre>
            <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-xs">{EXAMPLE_OUT}</pre>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="criteria">
          <AccordionTrigger className="font-semibold">Critérios de avaliação e casos de teste</AccordionTrigger>
          <AccordionContent className="text-sm">
            <ul className="list-disc space-y-1 pl-5">{EVALUATION_CRITERIA.map((c) => <li key={c}>{c}</li>)}</ul>
            <p className="mt-2 text-muted-foreground">Casos de teste sintéticos: página “Avaliação da IA” e arquivo src/lib/ai/eval-cases.ts.</p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="changelog">
          <AccordionTrigger className="font-semibold">Histórico de versões</AccordionTrigger>
          <AccordionContent className="text-sm">
            <ul className="space-y-1">{PROMPT_CHANGELOG.map((c) => <li key={c.version}><b>{c.version}</b> ({c.date}): {c.changes}</li>)}</ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
