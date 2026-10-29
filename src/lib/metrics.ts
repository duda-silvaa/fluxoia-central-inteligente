import type {
  AnalysisRow,
  MeasurementRow,
  RequestRow,
  ReviewRow,
  RunRow,
  EvalRunRow,
} from "@/lib/domain";

export const MIN_OBSERVATIONS_FOR_CONCLUSION = 5;

/** Weighted mean of minutes by number of observations. Returns null without data. */
export function weightedMinutes(rows: Pick<MeasurementRow, "minutes" | "observations">[]) {
  const obs = rows.reduce((s, r) => s + r.observations, 0);
  if (obs === 0) return { mean: null as number | null, observations: 0 };
  const total = rows.reduce((s, r) => s + Number(r.minutes) * r.observations, 0);
  return { mean: total / obs, observations: obs };
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export type ImpactInput = {
  measurements: Pick<MeasurementRow, "method" | "minutes" | "observations">[];
  analyses: Pick<AnalysisRow, "status" | "duration_ms" | "request_id">[];
  reviews: Pick<ReviewRow, "action" | "request_id" | "review_minutes">[];
  runs: Pick<RunRow, "status">[];
};

/**
 * Fórmulas (todas em minutos):
 * - manual_medio = Σ(minutos × observações) / Σ observações   (amostras "manual")
 * - revisao_media = idem para amostras "revisao"
 * - automatizado_medio = média(duration_ms das análises concluídas) / 60000
 * - tempo_por_solicitacao_automatizado = automatizado_medio + revisao_media
 * - economia_por_solicitacao = manual_medio − tempo_por_solicitacao_automatizado
 * - economia_acumulada = economia_por_solicitacao × solicitações analisadas com sucesso
 * - reducao_percentual = economia_por_solicitacao / manual_medio × 100
 */
export function computeImpact(input: ImpactInput) {
  const manual = weightedMinutes(input.measurements.filter((m) => m.method === "manual"));
  const review = weightedMinutes(input.measurements.filter((m) => m.method === "revisao"));
  const completed = input.analyses.filter((a) => a.status === "completed" && a.duration_ms != null);
  const failedAnalyses = input.analyses.filter((a) => a.status === "failed").length;
  const autoMs = mean(completed.map((a) => a.duration_ms as number));
  const automatedMinutes = autoMs == null ? null : autoMs / 60000;
  const processed = new Set(completed.map((a) => a.request_id).filter(Boolean)).size;

  const reviewedRequests = new Set(input.reviews.map((r) => r.request_id));
  const correctedRequests = new Set(
    input.reviews.filter((r) => r.action === "corrigida").map((r) => r.request_id),
  );
  const correctionRate =
    reviewedRequests.size === 0 ? null : correctedRequests.size / reviewedRequests.size;

  const finishedRuns = input.runs.filter((r) => r.status === "concluida" || r.status === "falhou");
  const failedRuns = input.runs.filter((r) => r.status === "falhou").length;
  const automationSuccessRate =
    finishedRuns.length === 0 ? null : (finishedRuns.length - failedRuns) / finishedRuns.length;

  const perRequestAutomated =
    automatedMinutes == null ? null : automatedMinutes + (review.mean ?? 0);
  const savingPerRequest =
    manual.mean == null || perRequestAutomated == null ? null : manual.mean - perRequestAutomated;
  const accumulatedSaving = savingPerRequest == null ? null : savingPerRequest * processed;
  const reductionPct =
    savingPerRequest == null || !manual.mean ? null : (savingPerRequest / manual.mean) * 100;

  const sufficient =
    manual.observations >= MIN_OBSERVATIONS_FOR_CONCLUSION &&
    completed.length >= MIN_OBSERVATIONS_FOR_CONCLUSION;

  return {
    manualMinutes: manual.mean,
    manualObservations: manual.observations,
    reviewMinutes: review.mean,
    reviewObservations: review.observations,
    automatedMinutes,
    completedAnalyses: completed.length,
    failedAnalyses,
    processed,
    correctedCount: correctedRequests.size,
    reviewedCount: reviewedRequests.size,
    correctionRate,
    failedRuns,
    automationSuccessRate,
    perRequestAutomated,
    savingPerRequest,
    accumulatedSaving,
    reductionPct,
    totalManualObserved: manual.mean == null ? 0 : manual.mean * manual.observations,
    totalAutomatedObserved: automatedMinutes == null ? 0 : automatedMinutes * completed.length,
    sufficient,
  };
}

export type DashboardFilters = {
  from?: Date | null;
  category?: string | null;
  priority?: string | null;
  status?: string | null;
};

export function filterRequests(rows: RequestRow[], f: DashboardFilters) {
  return rows.filter(
    (r) =>
      (!f.from || new Date(r.created_at) >= f.from) &&
      (!f.category || r.category === f.category) &&
      (!f.priority || r.priority === f.priority) &&
      (!f.status || r.status === f.status),
  );
}

export function computeDashboard(rows: RequestRow[]) {
  const count = (pred: (r: RequestRow) => boolean) => rows.filter(pred).length;
  const pendingStatuses = ["Nova", "Em triagem", "Pendente de revisão", "Aguardando informação"];
  return {
    total: rows.length,
    pending: count((r) => pendingStatuses.includes(r.status)),
    inProgress: count((r) => r.status === "Em andamento"),
    completed: count((r) => r.status === "Concluída"),
    aiClassified: count((r) => r.ai_status === "concluida"),
    humanCorrected: count((r) => r.human_corrected),
    needsReview: count((r) => r.status === "Pendente de revisão" || r.ai_requires_review === true),
    automationFailed: count((r) => r.automation_status === "falhou"),
  };
}

/** Accuracy only from requests that a human approved or corrected. */
export function classificationAccuracy(reviews: Pick<ReviewRow, "action" | "request_id">[]) {
  const reviewed = new Set(reviews.map((r) => r.request_id));
  if (reviewed.size === 0) return null;
  const corrected = new Set(reviews.filter((r) => r.action === "corrigida").map((r) => r.request_id));
  return (reviewed.size - corrected.size) / reviewed.size;
}

export function groupCount<T>(rows: T[], key: (r: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) ?? "Sem valor";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([name, value]) => ({ name, value }));
}

export function perDay(rows: Pick<RequestRow, "created_at">[], days = 14) {
  const out: { day: string; total: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key.slice(5).split("-").reverse().join("/"), total: 0 });
    for (const r of rows) if (r.created_at.slice(0, 10) === key) out[out.length - 1].total++;
  }
  return out;
}

export function evalSummary(runs: Pick<EvalRunRow, "expected_category" | "predicted_category" | "expected_priority" | "predicted_priority" | "valid_output" | "requires_review" | "error">[]) {
  const valid = runs.filter((r) => r.valid_output);
  return {
    total: runs.length,
    valid: valid.length,
    failures: runs.length - valid.length,
    categoryHits: valid.filter((r) => r.predicted_category === r.expected_category).length,
    priorityHits: valid.filter((r) => r.predicted_priority === r.expected_priority).length,
    flaggedForReview: valid.filter((r) => r.requires_review).length,
    validRate: runs.length ? valid.length / runs.length : null,
    categoryAccuracy: valid.length ? valid.filter((r) => r.predicted_category === r.expected_category).length / valid.length : null,
    priorityAccuracy: valid.length ? valid.filter((r) => r.predicted_priority === r.expected_priority).length / valid.length : null,
  };
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    // neutralize spreadsheet formula injection
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export function downloadFile(name: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["\ufeff" + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
