import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Bot, CheckCircle2, Circle, Loader2, Pencil, RefreshCw, Send, ThumbsDown, ThumbsUp, Trash2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { analyzeRequestFn, submitFeedbackFn } from "@/lib/ai/ai.functions";
import { dispatchAutomationFn, reviewRequestFn } from "@/lib/automation/automation.functions";
import { CATEGORIES, PRIORITIES, STATUSES, type AnalysisRow } from "@/lib/domain";
import { useIntegrationStatus } from "@/hooks/use-profile";
import { AiBadge, AutomationBadge, DemoTag, ErrorState, Loading, PriorityBadge, StatusBadge, fmtDate } from "@/components/app/common";
import { RequestFormDialog } from "@/components/app/RequestFormDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/solicitacoes/$id")({
  head: () => ({
    meta: [
      { title: "Detalhes da solicitação — FluxoIA" },
      { name: "description", content: "Informações, análise de IA, histórico e automações da solicitação." },
      { property: "og:title", content: "Detalhes da solicitação — FluxoIA" },
      { property: "og:description", content: "Informações, análise de IA, histórico e automações da solicitação." },
    ],
  }),
  component: RequestDetail,
});

const AGENT_LABEL: Record<string, string> = {
  classifier: "Agente 1 — Classificador",
  summarizer: "Agente 2 — Resumidor",
  planner: "Agente 3 — Planejador de ação",
};

type Step = { agent: string; status: string; duration_ms?: number; output?: unknown; error?: string };

function RequestDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeRequestFn);
  const dispatch = useServerFn(dispatchAutomationFn);
  const { data: integ } = useIntegrationStatus();
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const req = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("requests").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (q.state.data?.ai_status === "analisando" || q.state.data?.automation_status === "pendente" || q.state.data?.automation_status === "executando" ? 2500 : false),
  });
  const analyses = useQuery({
    queryKey: ["request", id, "analyses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_analyses").select("*").eq("request_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (q.state.data?.some((a) => a.status === "running") ? 2000 : false),
  });
  const history = useQuery({
    queryKey: ["request", id, "history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("request_history").select("*").eq("request_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const reviews = useQuery({
    queryKey: ["request", id, "reviews"],
    queryFn: async () => {
      const { data, error } = await supabase.from("human_reviews").select("*").eq("request_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const runs = useQuery({
    queryKey: ["request", id, "runs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("automation_runs").select("*").eq("request_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === "pendente" || r.status === "executando") ? 3000 : false),
  });

  if (req.isLoading) return <Loading />;
  if (req.error) return <ErrorState error={req.error} />;
  const r = req.data;
  if (!r) return <ErrorState error="Solicitação não encontrada ou sem permissão de acesso." />;

  async function runAnalysis() {
    setBusy("ai");
    const p = analyze({ data: { requestId: id } });
    setTimeout(() => qc.invalidateQueries({ queryKey: ["request", id] }), 600);
    const res = await p;
    setBusy(null);
    if (res.ok) toast.success("Análise concluída.");
    else toast.error(res.error);
    qc.invalidateQueries();
  }
  async function runAutomation() {
    setBusy("n8n");
    const res = await dispatch({ data: { requestId: id } });
    setBusy(null);
    if (res.ok) toast.success("Evento enviado ao n8n.");
    else toast.error(res.error);
    qc.invalidateQueries();
  }
  async function changeStatus(status: string) {
    const { error } = await supabase.from("requests").update({ status: status as never }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado.");
    qc.invalidateQueries();
  }
  async function remove() {
    const { error } = await supabase.from("requests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Solicitação excluída.");
    qc.invalidateQueries();
    navigate({ to: "/solicitacoes" });
  }

  const latest = analyses.data?.[0];
  const aiRunning = r.ai_status === "analisando" || busy === "ai";

  return (
    <div>
      <Link to="/solicitacoes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Solicitações</Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">#{r.code} · {r.source} · criada em {fmtDate(r.created_at)}</p>
          <h1 className="mt-1 text-2xl font-semibold">{r.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {r.is_demo && <DemoTag />}
            <StatusBadge value={r.status} /><PriorityBadge value={r.priority} /><AiBadge value={r.ai_status} /><AutomationBadge value={r.automation_status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={r.status} onValueChange={changeStatus}>
            <SelectTrigger className="w-[190px]" aria-label="Alterar status"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={runAnalysis} disabled={aiRunning || !integ?.ai.configured} title={!integ?.ai.configured ? "Provedor de IA não configurado" : undefined}>
            {aiRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
            {r.ai_status === "nao_analisada" ? "Analisar com IA" : "Reanalisar"}
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
                <AlertDialogDescription>A solicitação, suas análises, histórico e execuções serão removidos permanentemente.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {!integ?.ai.configured && integ && <p className="mb-4 text-sm text-warning-foreground">Provedor de IA não configurado: a análise está indisponível. Veja Integrações.</p>}

      <Tabs defaultValue="info">
        <TabsList className="flex-wrap">
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="ai">Análise da IA</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="automation">Automações</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-card p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-muted-foreground">Descrição original</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{r.description}</p>
            </div>
            <dl className="grid gap-3 rounded-xl border bg-card p-5 text-sm">
              {[
                ["Solicitante", r.requester], ["Responsável", r.assignee ?? "—"], ["Categoria", r.category ?? "—"], ["Prioridade", r.priority ?? "—"],
                ["Origem", r.source], ["Criada em", fmtDate(r.created_at)], ["Atualizada em", fmtDate(r.updated_at)], ["Concluída em", fmtDate(r.completed_at)],
                ["Revisão humana", r.human_approved ? (r.human_corrected ? "Corrigida" : "Aprovada") : "Pendente"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
              ))}
            </dl>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-4 space-y-4">
          {latest ? <FlowView a={latest} /> : (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Esta solicitação ainda não foi analisada.</div>
          )}
          {r.ai_status === "concluida" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-xl border bg-card p-5 text-sm">
                <h3 className="font-semibold">Sugestão da IA</h3>
                <p><span className="text-muted-foreground">Resumo: </span>{r.ai_summary}</p>
                <p><span className="text-muted-foreground">Categoria sugerida: </span>{r.ai_category} · <span className="text-muted-foreground">Prioridade sugerida: </span>{r.ai_priority}</p>
                <p><span className="text-muted-foreground">Justificativa: </span>{r.ai_reasoning}</p>
                <p><span className="text-muted-foreground">Próxima ação sugerida: </span>{r.ai_suggested_action}</p>
                {Array.isArray(r.ai_missing_info) && r.ai_missing_info.length > 0 && (
                  <div><span className="text-muted-foreground">Informações ausentes:</span>
                    <ul className="ml-5 list-disc">{(r.ai_missing_info as string[]).map((m) => <li key={m}>{m}</li>)}</ul>
                  </div>
                )}
                <p><span className="text-muted-foreground">Confiança estimada: </span>{r.ai_confidence != null ? Number(r.ai_confidence).toFixed(2) : "—"}
                  <span className="block text-xs text-muted-foreground">Autoavaliação do modelo — não é uma probabilidade calibrada.</span></p>
                {r.ai_requires_review && <p className="rounded-md bg-warning/15 p-2 text-warning-foreground">A IA sinalizou que este caso exige revisão humana.</p>}
                {r.description !== undefined && latest && new Date(r.updated_at) > new Date(latest.created_at) && history.data?.some((h) => h.field === "descrição" && new Date(h.created_at) > new Date(latest.created_at)) && (
                  <p className="rounded-md bg-info/10 p-2 text-info">A descrição foi alterada após a última análise. Reanalise para atualizar a sugestão.</p>
                )}
              </div>
              <ReviewPanel requestId={id} aiCategory={r.ai_category} aiPriority={r.ai_priority} category={r.category} priority={r.priority} approved={r.human_approved} reviews={reviews.data ?? []} />
            </div>
          )}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-3 font-semibold">Histórico de análises</h3>
            {!analyses.data?.length ? <p className="text-sm text-muted-foreground">Nenhuma análise.</p> : (
              <ul className="divide-y text-sm">
                {analyses.data.map((a) => <AnalysisItem key={a.id} a={a} />)}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="rounded-xl border bg-card p-5">
            {!history.data?.length ? <p className="text-sm text-muted-foreground">Sem alterações registradas.</p> : (
              <ol className="relative space-y-4 border-l pl-5">
                {history.data.map((h) => (
                  <li key={h.id} className="text-sm">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                    <p><span className="font-medium">{h.actor_label}</span> alterou <span className="font-medium">{h.field}</span>
                      {h.old_value != null && <> de <span className="rounded bg-muted px-1">{h.old_value}</span></>}
                      {h.new_value != null && <> para <span className="rounded bg-muted px-1">{h.new_value}</span></>}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmtDate(h.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </TabsContent>

        <TabsContent value="automation" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
            <div className="text-sm">
              <p className="font-semibold">Fluxo n8n</p>
              <p className="text-muted-foreground">{integ?.n8n.configured ? "Webhook do n8n configurado." : "n8n não configurado — configure N8N_WEBHOOK_URL e N8N_WEBHOOK_SECRET."}</p>
            </div>
            <Button onClick={runAutomation} disabled={!integ?.n8n.configured || busy === "n8n" || r.automation_status === "pendente" || r.automation_status === "executando"}>
              {busy === "n8n" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : r.automation_status === "falhou" ? <RefreshCw className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
              {r.automation_status === "falhou" ? "Executar novamente" : "Enviar ao n8n"}
            </Button>
          </div>
          <div className="rounded-xl border bg-card p-5">
            {!runs.data?.length ? <p className="text-sm text-muted-foreground">Nenhuma execução registrada.</p> : (
              <ul className="divide-y text-sm">
                {runs.data.map((x) => (
                  <li key={x.id} className="grid gap-1 py-3 md:grid-cols-5 md:items-center">
                    <span className="font-mono text-xs">{x.execution_id}</span>
                    <span>Tentativa {x.attempt}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(x.started_at)} → {fmtDate(x.finished_at)}</span>
                    <span>{x.duration_ms != null ? `${(x.duration_ms / 1000).toFixed(1)} s` : "—"}</span>
                    <span className="flex items-center gap-2"><AutomationBadge value={x.status} />{x.is_demo && <DemoTag />}</span>
                    {x.error && <span className="text-xs text-destructive md:col-span-5">{x.error}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>
      <RequestFormDialog open={editOpen} onOpenChange={setEditOpen} request={r} />
    </div>
  );
}

function FlowView({ a }: { a: AnalysisRow }) {
  const steps = (Array.isArray(a.steps) ? a.steps : []) as Step[];
  const all = ["classifier", "summarizer", "planner"].map((k) => steps.find((s) => s.agent === k) ?? { agent: k, status: "pending" });
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <h3 className="font-semibold">Fluxo de processamento</h3>
        <span className="text-xs text-muted-foreground">{a.provider} · {a.model} · prompt {a.prompt_version} · origem {a.trigger_source}</span>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {all.map((s, i) => (
          <li key={s.agent} className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              {s.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-success" /> : s.status === "failed" ? <XCircle className="h-4 w-4 text-destructive" /> : s.status === "running" ? <Loader2 className="h-4 w-4 animate-spin text-info" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              {i + 1}. {AGENT_LABEL[s.agent]}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{s.status === "completed" ? `Concluído em ${((s.duration_ms ?? 0) / 1000).toFixed(1)} s` : s.status === "failed" ? "Falhou" : s.status === "running" ? "Executando" : "Aguardando"}</p>
            {s.error && <p className="mt-1 text-xs text-destructive">{s.error}</p>}
            {s.output != null && (
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-[11px] leading-snug">{JSON.stringify(s.output, null, 2)}</pre>
            )}
          </li>
        ))}
      </ol>
      {a.error && <p className="mt-3 text-sm text-destructive">Erro: {a.error}. Use “Reanalisar” para tentar novamente — a solicitação não é duplicada.</p>}
    </div>
  );
}

function AnalysisItem({ a }: { a: AnalysisRow }) {
  const qc = useQueryClient();
  const fb = useServerFn(submitFeedbackFn);
  async function rate(v: 1 | -1) {
    try {
      await fb({ data: { analysisId: a.id, rating: v } });
      toast.success("Feedback registrado.");
      qc.invalidateQueries({ queryKey: ["request"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <li className="flex flex-wrap items-center gap-3 py-2">
      <span className="text-xs text-muted-foreground">{fmtDate(a.created_at)}</span>
      <span className={a.status === "completed" ? "text-success" : a.status === "failed" ? "text-destructive" : "text-info"}>{a.status === "completed" ? "Concluída" : a.status === "failed" ? "Falhou" : "Executando"}</span>
      <span className="text-xs">{a.duration_ms != null ? `${(a.duration_ms / 1000).toFixed(1)} s` : ""}</span>
      <span className="text-xs text-muted-foreground">{a.model} · {a.prompt_version}</span>
      {a.status === "completed" && (
        <span className="ml-auto flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Qualidade:</span>
          <Button size="icon" variant={a.feedback_rating === 1 ? "default" : "ghost"} className="h-7 w-7" onClick={() => rate(1)} aria-label="Resposta útil"><ThumbsUp className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant={a.feedback_rating === -1 ? "destructive" : "ghost"} className="h-7 w-7" onClick={() => rate(-1)} aria-label="Resposta ruim"><ThumbsDown className="h-3.5 w-3.5" /></Button>
        </span>
      )}
    </li>
  );
}

function ReviewPanel(props: {
  requestId: string; aiCategory: string | null; aiPriority: string | null; category: string | null; priority: string | null; approved: boolean;
  reviews: { id: string; action: string; field: string | null; original_value: string | null; corrected_value: string | null; reviewer_label: string | null; created_at: string }[];
}) {
  const qc = useQueryClient();
  const review = useServerFn(reviewRequestFn);
  const [cat, setCat] = useState(props.category ?? props.aiCategory ?? "");
  const [pri, setPri] = useState(props.priority ?? props.aiPriority ?? "");
  const [mins, setMins] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setCat(props.aiCategory ?? ""); setPri(props.aiPriority ?? ""); }, [props.aiCategory, props.aiPriority]);
  async function submit() {
    setSaving(true);
    try {
      const m = mins ? Number(mins) : undefined;
      const res = await review({ data: { requestId: props.requestId, category: cat, priority: pri, reviewMinutes: m && m > 0 ? m : undefined } });
      toast.success(res.corrected ? "Correção registrada." : "Sugestão aprovada.");
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-3 rounded-xl border bg-card p-5 text-sm">
      <h3 className="font-semibold">Revisão humana</h3>
      <p className="text-muted-foreground">Aprove ou corrija a sugestão. O valor original, o corrigido, o revisor e o horário ficam registrados.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Categoria</Label>
          <Select value={cat} onValueChange={setCat}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="space-y-1.5"><Label>Prioridade</Label>
          <Select value={pri} onValueChange={setPri}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rv-min">Tempo gasto na revisão (min, opcional)</Label>
        <Input id="rv-min" type="number" min={0} step={0.5} value={mins} onChange={(e) => setMins(e.target.value)} className="w-40" />
      </div>
      <Button onClick={submit} disabled={saving || !cat || !pri}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {cat === props.aiCategory && pri === props.aiPriority ? "Aprovar sugestão" : "Registrar correção"}
      </Button>
      {props.reviews.length > 0 && (
        <ul className="mt-2 space-y-1 border-t pt-3 text-xs">
          {props.reviews.map((rv) => (
            <li key={rv.id}>
              <span className="font-medium">{rv.reviewer_label}</span> {rv.action === "aprovada" ? "aprovou a sugestão" : <>corrigiu {rv.field}: <s>{rv.original_value}</s> → {rv.corrected_value}</>} · {fmtDate(rv.created_at)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
