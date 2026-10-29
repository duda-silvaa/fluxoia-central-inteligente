import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Download, RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyses, useMeasurements, useRequests, useReviews, useRuns } from "@/hooks/use-data";
import { computeImpact, downloadFile, MIN_OBSERVATIONS_FOR_CONCLUSION } from "@/lib/metrics";
import { DemoTag, ErrorState, Loading, PageHeader, StatCard, fmtDate, fmtMin, fmtPct } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/impacto")({
  head: () => ({
    meta: [
      { title: "Impacto e produtividade — FluxoIA" },
      { name: "description", content: "Medição transparente do tempo manual e automatizado, com fórmulas documentadas." },
      { property: "og:title", content: "Impacto e produtividade — FluxoIA" },
      { property: "og:description", content: "Medição transparente do tempo manual e automatizado, com fórmulas documentadas." },
    ],
  }),
  component: ImpactPage,
});

const schema = z.object({
  method: z.enum(["manual", "revisao"]),
  task: z.string().trim().min(2, "Descreva a tarefa").max(200),
  minutes: z.coerce.number({ invalid_type_error: "Informe um número" }).positive("Deve ser maior que zero").max(1440),
  observations: z.coerce.number().int().min(1, "Mínimo 1").max(10000),
  notes: z.string().max(500).optional(),
});
type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

function ImpactPage() {
  const qc = useQueryClient();
  const measurements = useMeasurements();
  const analyses = useAnalyses();
  const reviews = useReviews();
  const runs = useRuns();
  const requests = useRequests();
  const [includeDemo, setIncludeDemo] = useState(false);
  const f = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(schema), defaultValues: { method: "manual", observations: 1 } });

  const demoIds = useMemo(() => new Set((requests.data ?? []).filter((r) => r.is_demo).map((r) => r.id)), [requests.data]);
  const impact = useMemo(() => {
    const keep = (rid: string | null) => includeDemo || !rid || !demoIds.has(rid);
    return computeImpact({
      measurements: (measurements.data ?? []).filter((m) => includeDemo || !m.is_demo),
      analyses: (analyses.data ?? []).filter((a) => keep(a.request_id)),
      reviews: (reviews.data ?? []).filter((r) => keep(r.request_id)),
      runs: (runs.data ?? []).filter((r) => includeDemo || !r.is_demo),
    });
  }, [measurements.data, analyses.data, reviews.data, runs.data, includeDemo, demoIds]);

  const onSubmit = f.handleSubmit(async (v) => {
    const { error } = await supabase.from("time_measurements").insert({ ...v, notes: v.notes || null });
    if (error) return toast.error(error.message);
    toast.success("Amostra registrada.");
    f.reset({ method: v.method, observations: 1, task: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["measurements"] });
  });

  async function del(id: string) {
    const { error } = await supabase.from("time_measurements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["measurements"] });
  }
  async function resetDemo() {
    const { error } = await supabase.rpc("reset_demo_data");
    if (error) return toast.error(error.message);
    toast.success("Dados de demonstração removidos.");
    qc.invalidateQueries();
  }
  async function seedDemo() {
    const { error } = await supabase.rpc("seed_demo_data");
    if (error) return toast.error(error.message);
    toast.success("Dados de demonstração carregados.");
    qc.invalidateQueries();
  }

  function exportReport() {
    const all = requests.data ?? [];
    const scoped = all.filter((r) => includeDemo || !r.is_demo);
    const dates = scoped.map((r) => r.created_at).sort();
    const lines = [
      "# Relatório de impacto — FluxoIA",
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
      `Escopo: ${includeDemo ? "inclui dados de DEMONSTRAÇÃO (fictícios)" : "apenas dados observados"}`,
      `Período analisado: ${dates[0] ? fmtDate(dates[0]) : "—"} a ${dates.at(-1) ? fmtDate(dates.at(-1)) : "—"}`,
      `Solicitações no escopo: ${scoped.length}`,
      "",
      "## Tempos medidos",
      `- Tempo manual médio: ${fmtMin(impact.manualMinutes)} (${impact.manualObservations} observações)`,
      `- Tempo de revisão humana médio: ${fmtMin(impact.reviewMinutes)} (${impact.reviewObservations} observações)`,
      `- Tempo automatizado médio (IA): ${fmtMin(impact.automatedMinutes)} (${impact.completedAnalyses} análises concluídas)`,
      `- Tempo por solicitação com IA + revisão: ${fmtMin(impact.perRequestAutomated)}`,
      `- Economia por solicitação: ${fmtMin(impact.savingPerRequest)}`,
      `- Economia acumulada: ${fmtMin(impact.accumulatedSaving)} (${impact.processed} solicitações analisadas)`,
      `- Redução percentual: ${impact.reductionPct == null ? "—" : impact.reductionPct.toFixed(1) + "%"}`,
      `- Taxa de correção humana: ${fmtPct(impact.correctionRate)} (${impact.correctedCount}/${impact.reviewedCount})`,
      `- Taxa de sucesso das automações: ${fmtPct(impact.automationSuccessRate)} (${impact.failedRuns} falhas)`,
      `- Análises com falha: ${impact.failedAnalyses}`,
      "",
      "## Metodologia",
      "- manual_medio = Σ(minutos × observações) / Σ observações das amostras manuais registradas.",
      "- automatizado_medio = média da duração das análises de IA concluídas (registrada pelo backend).",
      "- tempo_com_IA = automatizado_medio + revisao_media.",
      "- economia_por_solicitacao = manual_medio − tempo_com_IA; economia_acumulada = economia × solicitações analisadas.",
      `- Conclusão só é indicada com ≥ ${MIN_OBSERVATIONS_FOR_CONCLUSION} observações manuais e ≥ ${MIN_OBSERVATIONS_FOR_CONCLUSION} análises concluídas.`,
      `- Suficiência dos dados: ${impact.sufficient ? "suficiente" : "INSUFICIENTE para conclusão"}.`,
    ];
    downloadFile(`fluxoia-impacto-${new Date().toISOString().slice(0, 10)}.md`, lines.join("\n"), "text/markdown;charset=utf-8");
  }

  if (measurements.isLoading) return <Loading />;
  if (measurements.error) return <ErrorState error={measurements.error} />;

  return (
    <div>
      <PageHeader
        title="Impacto e produtividade"
        description="Mede — não presume — o benefício da automação. Os tempos manuais vêm das amostras registradas abaixo; os automatizados, da duração real das análises."
        actions={<Button variant="outline" onClick={exportReport}><Download className="mr-2 h-4 w-4" />Exportar relatório</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 text-sm">
        <Switch id="incl" checked={includeDemo} onCheckedChange={setIncludeDemo} />
        <Label htmlFor="incl">Incluir dados de demonstração</Label>
        {includeDemo && <DemoTag />}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={seedDemo}>Carregar demonstração</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button size="sm" variant="outline"><RotateCcw className="mr-2 h-3.5 w-3.5" />Reiniciar demonstração</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Remover dados de demonstração?</AlertDialogTitle>
                <AlertDialogDescription>Remove apenas registros marcados como demonstração. Dados observados não são afetados.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={resetDemo}>Remover</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {!impact.sufficient && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
          Dados insuficientes para uma conclusão: são necessárias ao menos {MIN_OBSERVATIONS_FOR_CONCLUSION} observações manuais (atual: {impact.manualObservations}) e {MIN_OBSERVATIONS_FOR_CONCLUSION} análises de IA concluídas (atual: {impact.completedAnalyses}).
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Manual médio" value={fmtMin(impact.manualMinutes)} hint={`${impact.manualObservations} observações`} />
        <StatCard label="IA média" value={fmtMin(impact.automatedMinutes)} hint={`${impact.completedAnalyses} análises`} />
        <StatCard label="Revisão humana média" value={fmtMin(impact.reviewMinutes)} hint={`${impact.reviewObservations} observações`} />
        <StatCard label="Economia por solicitação" value={fmtMin(impact.savingPerRequest)} />
        <StatCard label="Economia acumulada" value={fmtMin(impact.accumulatedSaving)} hint={`${impact.processed} solicitações analisadas`} />
        <StatCard label="Redução de tempo" value={impact.reductionPct == null ? "—" : `${impact.reductionPct.toFixed(0)}%`} />
        <StatCard label="Taxa de correção humana" value={fmtPct(impact.correctionRate)} hint={`${impact.correctedCount} de ${impact.reviewedCount} revisadas`} />
        <StatCard label="Sucesso das automações" value={fmtPct(impact.automationSuccessRate)} hint={`${impact.failedRuns} falhas · ${impact.failedAnalyses} análises falharam`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <form onSubmit={onSubmit} className="space-y-3 rounded-xl border bg-card p-5 lg:col-span-2" noValidate>
          <h2 className="font-semibold">Registrar amostra de tempo</h2>
          <div className="space-y-1.5"><Label>Método</Label>
            <Select value={f.watch("method")} onValueChange={(v) => f.setValue("method", v as "manual" | "revisao")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="manual">Tratamento manual (sem IA)</SelectItem><SelectItem value="revisao">Revisão humana da sugestão de IA</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="tm-task">Tarefa observada</Label><Input id="tm-task" {...f.register("task")} placeholder="Ex.: triagem e encaminhamento de 1 solicitação" />
            {f.formState.errors.task && <p className="text-xs text-destructive">{f.formState.errors.task.message}</p>}</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="tm-min">Minutos (média)</Label><Input id="tm-min" type="number" step="0.1" {...f.register("minutes")} />
              {f.formState.errors.minutes && <p className="text-xs text-destructive">{f.formState.errors.minutes.message}</p>}</div>
            <div className="space-y-1.5"><Label htmlFor="tm-obs">Nº de observações</Label><Input id="tm-obs" type="number" {...f.register("observations")} />
              {f.formState.errors.observations && <p className="text-xs text-destructive">{f.formState.errors.observations.message}</p>}</div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="tm-notes">Observações</Label><Input id="tm-notes" {...f.register("notes")} /></div>
          <Button type="submit" disabled={f.formState.isSubmitting}>Registrar</Button>
        </form>
        <div className="rounded-xl border bg-card p-5 lg:col-span-3">
          <h2 className="mb-3 font-semibold">Amostras registradas</h2>
          {!measurements.data?.length ? <p className="text-sm text-muted-foreground">Nenhuma amostra registrada.</p> : (
            <ul className="divide-y text-sm">
              {measurements.data.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  <span className="w-20 text-xs text-muted-foreground">{m.method === "manual" ? "Manual" : "Revisão"}</span>
                  <span className="min-w-0 flex-1 truncate">{m.task}</span>
                  {m.is_demo && <DemoTag />}
                  <span>{fmtMin(Number(m.minutes))}</span>
                  <span className="text-xs text-muted-foreground">× {m.observations}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del(m.id)} aria-label="Excluir amostra"><Trash2 className="h-3.5 w-3.5" /></Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-card p-5 text-sm">
        <h2 className="mb-2 font-semibold">Metodologia e fórmulas (unidade: minutos)</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li><b>Manual médio</b> = Σ(minutos × observações) ÷ Σ observações das amostras manuais.</li>
          <li><b>IA média</b> = média da duração registrada das análises concluídas (3 agentes, ponta a ponta).</li>
          <li><b>Tempo com IA</b> = IA média + revisão humana média.</li>
          <li><b>Economia por solicitação</b> = Manual médio − Tempo com IA. <b>Acumulada</b> = economia × solicitações analisadas com sucesso.</li>
          <li><b>Redução</b> = Economia ÷ Manual médio × 100. <b>Correção humana</b> = solicitações corrigidas ÷ revisadas.</li>
          <li><b>Sucesso das automações</b> = execuções concluídas ÷ execuções finalizadas (concluídas + falhas).</li>
        </ul>
      </div>
    </div>
  );
}
