import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { runEvalBatchFn } from "@/lib/ai/ai.functions";
import { EVAL_CASES } from "@/lib/ai/eval-cases";
import { evalSummary } from "@/lib/metrics";
import { useIntegrationStatus } from "@/hooks/use-profile";
import { ErrorState, Loading, PageHeader, Pill, StatCard, fmtDate, fmtPct } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/avaliacao")({
  head: () => ({
    meta: [
      { title: "Avaliação da IA — FluxoIA" },
      { name: "description", content: "Execute o conjunto sintético de casos e compare categoria e prioridade previstas com as de referência." },
      { property: "og:title", content: "Avaliação da IA — FluxoIA" },
      { property: "og:description", content: "Execute o conjunto sintético de casos e compare previsões com referências." },
    ],
  }),
  component: EvalPage,
});

function EvalPage() {
  const qc = useQueryClient();
  const run = useServerFn(runEvalBatchFn);
  const { data: integ } = useIntegrationStatus();
  const [progress, setProgress] = useState<number | null>(null);
  const [batch, setBatch] = useState<string>("");
  const runs = useQuery({
    queryKey: ["eval-runs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("eval_runs").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });
  const batches = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of runs.data ?? []) if (!m.has(r.batch_id)) m.set(r.batch_id, r.created_at);
    return [...m.entries()];
  }, [runs.data]);
  const current = batch || batches[0]?.[0] || "";
  const rows = (runs.data ?? []).filter((r) => r.batch_id === current);
  const sum = evalSummary(rows);

  async function start() {
    const id = crypto.randomUUID();
    const ids = EVAL_CASES.map((c) => c.id);
    setProgress(0);
    try {
      for (let i = 0; i < ids.length; i += 3) {
        const res = await run({ data: { batchId: id, caseIds: ids.slice(i, i + 3) } });
        if (!res.ok) throw new Error(res.error);
        setProgress(Math.min(ids.length, i + 3) / ids.length);
        await qc.invalidateQueries({ queryKey: ["eval-runs"] });
        setBatch(id);
      }
      toast.success("Avaliação concluída.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProgress(null);
      qc.invalidateQueries({ queryKey: ["eval-runs"] });
    }
  }

  return (
    <div>
      <PageHeader
        title="Avaliação da IA"
        description="Conjunto inicial SINTÉTICO de 12 casos fictícios (padrão, ambíguos, dados insuficientes e tentativas de injeção). Não representa avaliação de produção; as taxas abaixo são calculadas apenas a partir das execuções registradas."
        actions={
          <Button onClick={start} disabled={progress !== null || !integ?.ai.configured}>
            {progress !== null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Executar avaliação
          </Button>
        }
      />
      {integ && !integ.ai.configured && <p className="mb-4 text-sm text-warning-foreground">Provedor de IA não configurado — a avaliação está indisponível.</p>}
      {progress !== null && <div className="mb-4"><Progress value={progress * 100} /><p className="mt-1 text-xs text-muted-foreground">Executando casos... {Math.round(progress * 100)}%</p></div>}

      {runs.isLoading ? <Loading /> : runs.error ? <ErrorState error={runs.error} /> : rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 font-semibold">Casos de teste</h2>
          <CaseList />
        </div>
      ) : (
        <>
          {batches.length > 1 && (
            <Select value={current} onValueChange={setBatch}>
              <SelectTrigger className="mb-4 w-72" aria-label="Execução"><SelectValue /></SelectTrigger>
              <SelectContent>{batches.map(([id, at]) => <SelectItem key={id} value={id}>Execução de {fmtDate(at)}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Casos executados" value={sum.total} />
            <StatCard label="Respostas válidas" value={`${sum.valid} (${fmtPct(sum.validRate)})`} hint={`${sum.failures} falhas de processamento`} />
            <StatCard label="Acerto de categoria" value={`${sum.categoryHits}/${sum.valid}`} hint={fmtPct(sum.categoryAccuracy)} />
            <StatCard label="Acerto de prioridade" value={`${sum.priorityHits}/${sum.valid}`} hint={fmtPct(sum.priorityAccuracy)} />
            <StatCard label="Sinalizados p/ revisão" value={sum.flaggedForReview} />
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Caso</TableHead><TableHead>Tipo</TableHead><TableHead>Categoria esperada / prevista</TableHead><TableHead>Prioridade esperada / prevista</TableHead><TableHead>Revisão</TableHead><TableHead>Duração</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const c = EVAL_CASES.find((x) => x.id === r.case_id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-xs text-sm font-medium">{c?.title ?? r.case_id}</TableCell>
                      <TableCell><Pill className="bg-muted">{c?.kind}</Pill></TableCell>
                      <TableCell className="text-sm">{r.expected_category} / <Hit ok={r.predicted_category === r.expected_category} v={r.predicted_category} err={r.error} /></TableCell>
                      <TableCell className="text-sm">{r.expected_priority} / <Hit ok={r.predicted_priority === r.expected_priority} v={r.predicted_priority} err={r.error} /></TableCell>
                      <TableCell className="text-sm">{r.requires_review == null ? "—" : r.requires_review ? "Sim" : "Não"}{c?.expect_review && r.requires_review === false && <span className="ml-1 text-xs text-destructive">(esperado: sim)</span>}</TableCell>
                      <TableCell className="text-xs">{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)} s` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Prompt {rows[0]?.prompt_version} · modelo {rows[0]?.model}</p>
        </>
      )}
    </div>
  );
}

function Hit({ ok, v, err }: { ok: boolean; v: string | null; err: string | null }) {
  if (!v) return <span className="text-destructive" title={err ?? ""}>falhou</span>;
  return <span className={ok ? "font-medium text-success" : "font-medium text-destructive"}>{v}</span>;
}

function CaseList() {
  return (
    <ul className="divide-y text-sm">
      {EVAL_CASES.map((c) => (
        <li key={c.id} className="py-2">
          <p className="font-medium">{c.title} <Pill className="ml-1 bg-muted">{c.kind}</Pill></p>
          <p className="text-muted-foreground">{c.description}</p>
          <p className="text-xs">Referência: {c.expected_category} · {c.expected_priority} · revisão {c.expect_review ? "esperada" : "não esperada"}</p>
        </li>
      ))}
    </ul>
  );
}
