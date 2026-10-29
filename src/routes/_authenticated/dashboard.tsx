import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, Bot, CheckCircle2, Clock, Database, Inbox, Loader, PenLine, Timer, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyses, useMeasurements, useRequests, useReviews, useRuns } from "@/hooks/use-data";
import { classificationAccuracy, computeDashboard, computeImpact, filterRequests, groupCount, perDay } from "@/lib/metrics";
import { CATEGORIES, PRIORITIES, STATUSES } from "@/lib/domain";
import {
  AiBadge, AutomationBadge, DemoTag, EmptyState, ErrorState, Loading, PageHeader, PriorityBadge, StatCard, StatusBadge, fmtDate, fmtMin, fmtPct,
} from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useIntegrationStatus } from "@/hooks/use-profile";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — FluxoIA" },
      { name: "description", content: "Indicadores operacionais calculados a partir das solicitações registradas." },
      { property: "og:title", content: "Dashboard — FluxoIA" },
      { property: "og:description", content: "Indicadores operacionais calculados a partir das solicitações registradas." },
    ],
  }),
  component: Dashboard,
});

const ALL = "__all";
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)", "var(--accent-foreground)"];

function Dashboard() {
  const qc = useQueryClient();
  const requests = useRequests();
  const analyses = useAnalyses();
  const runs = useRuns();
  const reviews = useReviews();
  const measurements = useMeasurements();
  const { data: integ } = useIntegrationStatus();
  const [period, setPeriod] = useState("30");
  const [category, setCategory] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [includeDemo, setIncludeDemo] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const view = useMemo(() => {
    const all = (requests.data ?? []).filter((r) => includeDemo || !r.is_demo);
    const from = period === ALL ? null : new Date(Date.now() - Number(period) * 86400_000);
    const rows = filterRequests(all, {
      from,
      category: category === ALL ? null : category,
      priority: priority === ALL ? null : priority,
      status: status === ALL ? null : status,
    });
    const ids = new Set(rows.map((r) => r.id));
    const runRows = (runs.data ?? []).filter((r) => r.request_id && ids.has(r.request_id));
    const anRows = (analyses.data ?? []).filter((a) => a.request_id && ids.has(a.request_id));
    const revRows = (reviews.data ?? []).filter((r) => ids.has(r.request_id));
    const meas = (measurements.data ?? []).filter((m) => includeDemo || !m.is_demo);
    const impact = computeImpact({ measurements: meas, analyses: anRows, reviews: revRows, runs: runRows });
    return {
      rows,
      runRows,
      stats: computeDashboard(rows),
      impact,
      accuracy: classificationAccuracy(revRows),
      byDay: perDay(rows, period === "7" ? 7 : 14),
      byCat: groupCount(rows, (r) => r.category),
      byPri: PRIORITIES.map((p) => ({ name: p, value: rows.filter((r) => r.priority === p).length })),
      byStatus: groupCount(rows, (r) => r.status),
      hasDemo: all.some((r) => r.is_demo),
    };
  }, [requests.data, runs.data, analyses.data, reviews.data, measurements.data, period, category, priority, status, includeDemo]);

  async function seed() {
    setSeeding(true);
    const { error } = await supabase.rpc("seed_demo_data");
    setSeeding(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Dados de demonstração carregados.");
    qc.invalidateQueries();
  }

  if (requests.isLoading) return <Loading />;
  if (requests.error) return <ErrorState error={requests.error} />;

  const s = view.stats;
  const im = view.impact;
  const totalAll = requests.data?.length ?? 0;
  const failedRuns = view.runRows.filter((r) => r.status === "falhou");
  const needReview = view.rows.filter((r) => r.status === "Pendente de revisão").slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Dashboard operacional"
        description="Todos os indicadores são calculados a partir das solicitações, análises e execuções registradas na sua organização."
        actions={
          <Button asChild><Link to="/solicitacoes" search={{ new: true }}>Nova solicitação</Link></Button>
        }
      />

      {integ && (!integ.ai.configured || !integ.n8n.configured) && (
        <div className="mb-4 rounded-xl border bg-card p-3 text-sm text-muted-foreground">
          {!integ.ai.configured && <p>⚠️ Provedor de IA não configurado — análises indisponíveis.</p>}
          {!integ.n8n.configured && (
            <p>
              n8n ainda não configurado: novas solicitações são analisadas diretamente pelo backend.{" "}
              <Link to="/integracoes" className="text-primary underline">Ver integrações</Link>
            </p>
          )}
        </div>
      )}

      {totalAll === 0 ? (
        <EmptyState
          title="Nenhuma solicitação registrada"
          description="Cadastre a primeira solicitação ou carregue um conjunto de dados fictícios, marcado como demonstração, para explorar o painel."
          action={
            <div className="flex gap-2">
              <Button asChild><Link to="/solicitacoes" search={{ new: true }}>Cadastrar solicitação</Link></Button>
              <Button variant="outline" onClick={seed} disabled={seeding}><Database className="mr-2 h-4 w-4" />Carregar demonstração</Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
            <FilterSelect label="Período" value={period} onChange={setPeriod} options={[["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], [ALL, "Todo o período"]]} />
            <FilterSelect label="Categoria" value={category} onChange={setCategory} options={[[ALL, "Todas as categorias"], ...CATEGORIES.map((c) => [c, c] as [string, string])]} />
            <FilterSelect label="Prioridade" value={priority} onChange={setPriority} options={[[ALL, "Todas as prioridades"], ...PRIORITIES.map((c) => [c, c] as [string, string])]} />
            <FilterSelect label="Status" value={status} onChange={setStatus} options={[[ALL, "Todos os status"], ...STATUSES.map((c) => [c, c] as [string, string])]} />
            {view.hasDemo && (
              <div className="ml-auto flex items-center gap-2">
                <Switch id="demo" checked={includeDemo} onCheckedChange={setIncludeDemo} />
                <Label htmlFor="demo" className="text-sm">Incluir demonstração</Label>
              </div>
            )}
          </div>
          {view.hasDemo && includeDemo && (
            <p className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
              <DemoTag /> Os números incluem registros fictícios de demonstração. Desative a opção para ver apenas dados observados.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
            <StatCard label="Recebidas" value={s.total} icon={<Inbox className="h-4 w-4" />} />
            <StatCard label="Pendentes" value={s.pending} icon={<Clock className="h-4 w-4" />} />
            <StatCard label="Em andamento" value={s.inProgress} icon={<Loader className="h-4 w-4" />} />
            <StatCard label="Concluídas" value={s.completed} icon={<CheckCircle2 className="h-4 w-4" />} tone="text-success" />
            <StatCard label="Classificadas pela IA" value={s.aiClassified} icon={<Bot className="h-4 w-4" />} tone="text-primary" />
            <StatCard label="Corrigidas por humano" value={s.humanCorrected} icon={<PenLine className="h-4 w-4" />} />
            <StatCard label="Tempo médio automatizado" value={fmtMin(im.automatedMinutes)} hint={`${im.completedAnalyses} análises concluídas`} icon={<Timer className="h-4 w-4" />} />
            <StatCard label="Tempo médio manual" value={fmtMin(im.manualMinutes)} hint={`${im.manualObservations} observações registradas`} icon={<Clock className="h-4 w-4" />} />
            <StatCard label="Tempo economizado (est.)" value={fmtMin(im.accumulatedSaving)} hint={im.sufficient ? "Ver metodologia em Impacto" : "Dados insuficientes para conclusão"} icon={<TrendingDown className="h-4 w-4" />} />
            <StatCard label="Classificação correta" value={fmtPct(view.accuracy)} hint={view.accuracy == null ? "Sem revisões humanas" : "Aprovadas sem correção / revisadas"} icon={<CheckCircle2 className="h-4 w-4" />} />
          </div>

          {(failedRuns.length > 0 || needReview.length > 0) && (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {failedRuns.length > 0 && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-destructive"><AlertTriangle className="h-4 w-4" />{failedRuns.length} automação(ões) com falha</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {failedRuns.slice(0, 4).map((r) => (
                      <li key={r.id}><Link to="/solicitacoes/$id" params={{ id: r.request_id! }} className="hover:underline">{r.error ?? "Falha"}</Link></li>
                    ))}
                  </ul>
                </div>
              )}
              {needReview.length > 0 && (
                <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
                  <p className="text-sm font-medium text-warning-foreground">{s.needsReview} solicitação(ões) exigem revisão humana</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {needReview.map((r) => (
                      <li key={r.id}><Link to="/solicitacoes/$id" params={{ id: r.id }} className="hover:underline">{r.title}</Link></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <ChartCard title="Solicitações por dia" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={view.byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" fontSize={11} stroke="var(--muted-foreground)" />
                  <YAxis allowDecimals={false} fontSize={11} stroke="var(--muted-foreground)" />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" name="Solicitações" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Distribuição por status">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={view.byStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                    {view.byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Por categoria" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={view.byCat} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} fontSize={11} stroke="var(--muted-foreground)" />
                  <YAxis type="category" dataKey="name" width={130} fontSize={11} stroke="var(--muted-foreground)" />
                  <Tooltip />
                  <Bar dataKey="value" name="Solicitações" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Por prioridade">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={view.byPri}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
                  <YAxis allowDecimals={false} fontSize={11} stroke="var(--muted-foreground)" />
                  <Tooltip />
                  <Bar dataKey="value" name="Solicitações" radius={[4, 4, 0, 0]}>
                    {view.byPri.map((_, i) => <Cell key={i} fill={["var(--muted-foreground)", "var(--chart-3)", "var(--chart-2)", "var(--chart-5)"][i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Manual × automatizado (min por solicitação)">
              {im.manualMinutes == null || im.perRequestAutomated == null ? (
                <p className="py-16 text-center text-sm text-muted-foreground">Registre amostras de tempo manual e conclua análises de IA para comparar.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={[{ name: "Manual", v: +im.manualMinutes.toFixed(2) }, { name: "IA + revisão", v: +im.perRequestAutomated.toFixed(2) }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
                    <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                    <Tooltip />
                    <Bar dataKey="v" name="Minutos" radius={[4, 4, 0, 0]}>
                      <Cell fill="var(--chart-2)" /><Cell fill="var(--chart-1)" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Automações recentes" className="lg:col-span-2">
              {view.runRows.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">Nenhuma execução de automação registrada.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {view.runRows.slice(0, 6).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                      <span className="truncate font-mono text-xs text-muted-foreground">{r.execution_id.slice(0, 18)}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(r.started_at)}</span>
                      <span className="text-xs">{r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)} s` : "—"}</span>
                      <AutomationBadge value={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>
          </div>

          <div className="mt-6 rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="font-semibold">Solicitações recentes</h2>
              <Link to="/solicitacoes" className="text-sm text-primary hover:underline">Ver todas</Link>
            </div>
            {view.rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma solicitação para os filtros selecionados.</p>
            ) : (
              <ul className="divide-y">
                {view.rows.slice(0, 6).map((r) => (
                  <li key={r.id}>
                    <Link to="/solicitacoes/$id" params={{ id: r.id }} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/50">
                      <span className="text-xs text-muted-foreground">#{r.code}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.title}</span>
                      {r.is_demo && <DemoTag />}
                      <PriorityBadge value={r.priority} />
                      <StatusBadge value={r.status} />
                      <AiBadge value={r.ai_status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border bg-card p-4 ${className ?? ""}`}>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}
