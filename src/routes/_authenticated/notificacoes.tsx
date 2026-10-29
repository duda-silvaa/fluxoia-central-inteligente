import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, ErrorState, Loading, PageHeader, fmtDate } from "@/components/app/common";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — FluxoIA" },
      { name: "description", content: "Central de notificações internas sobre solicitações, análises e automações." },
      { property: "og:title", content: "Notificações — FluxoIA" },
      { property: "og:description", content: "Central de notificações internas do FluxoIA." },
    ],
  }),
  component: NotificationsPage,
});

const TYPE_LABEL: Record<string, string> = {
  nova_solicitacao: "Nova solicitação",
  analise_concluida: "Análise concluída",
  aguardando_revisao: "Aguardando revisão",
  falha_automacao: "Falha em automação",
  concluida: "Concluída",
};

function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  async function markAll() {
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }
  async function mark(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }
  async function remove(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }
  return (
    <div>
      <PageHeader title="Notificações" description="Geradas automaticamente pelo banco de dados a cada evento relevante." actions={<Button variant="outline" onClick={markAll}><CheckCheck className="mr-2 h-4 w-4" />Marcar todas como lidas</Button>} />
      {isLoading ? <Loading /> : error ? <ErrorState error={error} /> : !data?.length ? <EmptyState title="Nenhuma notificação" description="Você será avisado sobre novas solicitações, análises, revisões e falhas." /> : (
        <ul className="divide-y rounded-xl border bg-card">
          {data.map((n) => (
            <li key={n.id} className={`flex items-start gap-3 p-4 ${n.read_at ? "" : "bg-accent/40"}`}>
              <Bell className={`mt-0.5 h-4 w-4 ${n.type === "falha_automacao" ? "text-destructive" : "text-primary"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.title} <span className="ml-1 text-xs font-normal text-muted-foreground">{TYPE_LABEL[n.type]}</span></p>
                {n.request_id ? (
                  <Link to="/solicitacoes/$id" params={{ id: n.request_id }} onClick={() => mark(n.id)} className="text-sm text-muted-foreground hover:underline">{n.body}</Link>
                ) : <p className="text-sm text-muted-foreground">{n.body}</p>}
                <p className="text-xs text-muted-foreground">{fmtDate(n.created_at)}</p>
              </div>
              {!n.read_at && <Button size="sm" variant="ghost" onClick={() => mark(n.id)}>Marcar lida</Button>}
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(n.id)} aria-label="Excluir notificação"><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
