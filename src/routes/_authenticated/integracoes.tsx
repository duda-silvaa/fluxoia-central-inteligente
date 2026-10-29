import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";
import { useIntegrationStatus } from "@/hooks/use-profile";
import { Loading, PageHeader } from "@/components/app/common";

export const Route = createFileRoute("/_authenticated/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações — FluxoIA" },
      { name: "description", content: "Estado e contrato das integrações de IA, n8n e notificações externas." },
      { property: "og:title", content: "Integrações — FluxoIA" },
      { property: "og:description", content: "Estado e contrato das integrações de IA, n8n e notificações externas." },
    ],
  }),
  component: IntegrationsPage,
});

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${ok ? "text-success" : "text-muted-foreground"}`}>
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {label}
    </span>
  );
}

function IntegrationsPage() {
  const { data, isLoading } = useIntegrationStatus();
  if (isLoading || !data) return <Loading />;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div>
      <PageHeader title="Integrações" description="O estado abaixo reflete as variáveis configuradas no servidor. Nenhuma credencial é enviada ao navegador." />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border bg-card p-5 text-sm">
          <h2 className="font-semibold">Provedor de IA</h2>
          <div className="mt-2"><Status ok={data.ai.configured} label={data.ai.configured ? "Configurado" : "Não configurado"} /></div>
          {data.ai.configured && <p className="mt-2 text-muted-foreground">{data.ai.provider} · {data.ai.model}</p>}
          <p className="mt-3 text-muted-foreground">Padrão: Lovable AI Gateway. Para outro provedor compatível com OpenAI, defina <code>LLM_BASE_URL</code>, <code>LLM_API_KEY</code> e <code>LLM_MODEL</code>.</p>
        </section>
        <section className="rounded-xl border bg-card p-5 text-sm">
          <h2 className="font-semibold">n8n</h2>
          <div className="mt-2"><Status ok={data.n8n.configured} label={data.n8n.configured ? "Webhook configurado (não verificado)" : "Não configurado"} /></div>
          <p className="mt-3 text-muted-foreground">Defina <code>N8N_WEBHOOK_URL</code> e <code>N8N_WEBHOOK_SECRET</code>. O fluxo só é considerado ativo após uma execução concluída aparecer em uma solicitação.</p>
        </section>
        <section className="rounded-xl border bg-card p-5 text-sm">
          <h2 className="font-semibold">Notificação externa</h2>
          <div className="mt-2"><Status ok={data.notifyWebhook.configured} label={data.notifyWebhook.configured ? "Webhook configurado" : "Não configurado"} /></div>
          <p className="mt-3 text-muted-foreground">Opcional: <code>NOTIFY_WEBHOOK_URL</code> recebe eventos de análise concluída. Sem ela, apenas notificações internas são geradas — nenhum e-mail é enviado.</p>
        </section>
      </div>

      <section className="mt-6 space-y-3 rounded-xl border bg-card p-5 text-sm">
        <h2 className="font-semibold">Contrato da integração n8n</h2>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Ao registrar uma solicitação, o backend envia <code>POST</code> ao <code>N8N_WEBHOOK_URL</code> com <code>{"{event, execution_id, request_id, sent_at}"}</code>, até 3 tentativas com backoff.</li>
          <li>Cabeçalhos: <code>X-FluxoIA-Timestamp</code> e <code>X-FluxoIA-Signature: sha256=HMAC(secret, timestamp + "." + corpo)</code>.</li>
          <li>O n8n valida a assinatura e chama <code>POST {origin}/api/public/n8n/analyze</code> assinado com o mesmo segredo.</li>
          <li>O n8n opcionalmente notifica o responsável e chama <code>POST {origin}/api/public/n8n/callback</code> com <code>{"{execution_id, status: \"concluida\"|\"falhou\", error?, notification_sent?}"}</code>.</li>
          <li>Eventos repetidos são idempotentes (execution_id único); assinaturas com mais de 5 minutos são rejeitadas.</li>
        </ol>
        <p className="text-muted-foreground">Workflow importável e instruções: <code>docs/n8n-workflow.json</code> e <code>docs/n8n-setup.md</code> no repositório.</p>
      </section>
    </div>
  );
}
