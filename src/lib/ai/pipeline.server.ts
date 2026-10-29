import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { chatJson, getProviderConfig, ProviderError } from "./provider.server";
import {
  CLASSIFIER_PROMPT,
  PLANNER_PROMPT,
  PROMPT_VERSION,
  SUMMARIZER_PROMPT,
  wrapRequest,
} from "./prompts";
import {
  classifierSchema,
  combineTriage,
  extractJson,
  plannerSchema,
  summarizerSchema,
  type ClassifierOutput,
  type TriageResult,
} from "./schemas";
import type { z } from "zod";

type DB = SupabaseClient<Database>;

export type StepRecord = {
  agent: string;
  status: "pending" | "running" | "completed" | "failed";
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  output?: unknown;
  error?: string;
};

export const MAX_ANALYSES_PER_HOUR = 40;
const DUPLICATE_WINDOW_MS = 2 * 60_000;

async function runStep<T extends z.ZodTypeAny>(
  cfg: NonNullable<ReturnType<typeof getProviderConfig>>,
  system: string,
  user: string,
  schema: T,
  runId: { value?: string },
): Promise<z.infer<T>> {
  let lastErr: unknown;
  // one retry for transient provider failures or schema-invalid output
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await chatJson(cfg, system, user, runId);
      const parsed = schema.safeParse(extractJson(text));
      if (!parsed.success)
        throw new Error("Saída inválida segundo o schema: " + parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; "));
      return parsed.data;
    } catch (e) {
      lastErr = e;
      if (e instanceof ProviderError && !e.retryable) break;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
    }
  }
  throw lastErr;
}

/** Runs the three agents on raw text. Used by the pipeline and the evaluation suite. */
export async function runAgents(
  title: string,
  description: string,
  onStep?: (steps: StepRecord[]) => Promise<void>,
) {
  const cfg = getProviderConfig();
  if (!cfg) throw new ProviderError("Provedor de IA não configurado (LOVABLE_API_KEY ou LLM_API_KEY ausente).", 503, false);
  const runId: { value?: string } = {};
  const input = wrapRequest(title, description);
  const steps: StepRecord[] = [
    { agent: "classifier", status: "pending" },
    { agent: "summarizer", status: "pending" },
    { agent: "planner", status: "pending" },
  ];
  const exec = async <T>(i: number, fn: () => Promise<T>): Promise<T> => {
    const t0 = Date.now();
    steps[i] = { ...steps[i], status: "running", started_at: new Date().toISOString() };
    await onStep?.(steps);
    try {
      const out = await fn();
      steps[i] = { ...steps[i], status: "completed", output: out, finished_at: new Date().toISOString(), duration_ms: Date.now() - t0 };
      await onStep?.(steps);
      return out;
    } catch (e) {
      steps[i] = { ...steps[i], status: "failed", error: e instanceof Error ? e.message : String(e), finished_at: new Date().toISOString(), duration_ms: Date.now() - t0 };
      await onStep?.(steps);
      throw Object.assign(e instanceof Error ? e : new Error(String(e)), { steps });
    }
  };
  const c: ClassifierOutput = await exec(0, () => runStep(cfg, CLASSIFIER_PROMPT.system, input, classifierSchema, runId));
  const s = await exec(1, () => runStep(cfg, SUMMARIZER_PROMPT.system, input, summarizerSchema, runId));
  const plannerInput = `${input}\n<classificacao_sugerida>${JSON.stringify({ category: c.category, priority: c.priority, is_ambiguous: c.is_ambiguous, injection_detected: c.injection_detected })}</classificacao_sugerida>`;
  const p = await exec(2, () => runStep(cfg, PLANNER_PROMPT.system, plannerInput, plannerSchema, runId));
  return { result: combineTriage(c, s, p), steps, provider: cfg.provider, model: cfg.model };
}

export class PipelineRejected extends Error {}

/**
 * Orchestrates the analysis of a persisted request. `db` may be the user's
 * RLS client or the admin client (for verified n8n calls); every query is
 * scoped by organization_id explicitly.
 */
export async function analyzeRequest(
  db: DB,
  opts: { requestId: string; organizationId?: string; userId?: string | null; source: "manual" | "n8n" },
): Promise<{ analysisId: string; result: TriageResult }> {
  let q = db.from("requests").select("*").eq("id", opts.requestId);
  if (opts.organizationId) q = q.eq("organization_id", opts.organizationId);
  const { data: req, error } = await q.maybeSingle();
  if (error) throw error;
  if (!req) throw new PipelineRejected("Solicitação não encontrada.");

  if (!getProviderConfig()) throw new PipelineRejected("Provedor de IA não configurado.");

  // duplicate protection
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const { data: running } = await db
    .from("ai_analyses")
    .select("id")
    .eq("request_id", req.id)
    .eq("status", "running")
    .gte("created_at", since)
    .limit(1);
  if (running && running.length) throw new PipelineRejected("Já existe uma análise em execução para esta solicitação.");

  // usage limit per organization
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db
    .from("ai_analyses")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", req.organization_id)
    .gte("created_at", hourAgo);
  if ((count ?? 0) >= MAX_ANALYSES_PER_HOUR)
    throw new PipelineRejected(`Limite de ${MAX_ANALYSES_PER_HOUR} análises por hora atingido para a organização.`);

  const cfg = getProviderConfig()!;
  const { data: analysis, error: insErr } = await db
    .from("ai_analyses")
    .insert({
      request_id: req.id,
      organization_id: req.organization_id,
      triggered_by: opts.userId ?? null,
      trigger_source: opts.source,
      prompt_version: PROMPT_VERSION,
      provider: cfg.provider,
      model: cfg.model,
      status: "running",
    })
    .select("id")
    .single();
  if (insErr) throw insErr;

  await db.from("requests").update({ ai_status: "analisando" }).eq("id", req.id);
  const t0 = Date.now();
  try {
    const { result, steps } = await runAgents(req.title, req.description, async (s) => {
      await db.from("ai_analyses").update({ steps: s as never }).eq("id", analysis.id);
    });
    const duration = Date.now() - t0;
    await db
      .from("ai_analyses")
      .update({ status: "completed", output: result as never, steps: steps as never, duration_ms: duration, finished_at: new Date().toISOString() })
      .eq("id", analysis.id);

    const nextStatus =
      req.status === "Nova" || req.status === "Em triagem"
        ? result.requires_human_review
          ? "Pendente de revisão"
          : "Em triagem"
        : req.status;
    await db
      .from("requests")
      .update({
        ai_status: "concluida",
        ai_category: result.category as never,
        ai_priority: result.priority as never,
        ai_summary: result.summary,
        ai_reasoning: result.reasoning_summary,
        ai_suggested_action: result.suggested_action,
        ai_missing_info: result.missing_information,
        ai_confidence: result.confidence_estimate,
        ai_requires_review: result.requires_human_review,
        ai_analyzed_at: new Date().toISOString(),
        // suggestions only fill empty fields; human values are never overwritten
        category: (req.category ?? result.category) as never,
        priority: (req.priority ?? result.priority) as never,
        status: nextStatus,
        human_approved: false,
      })
      .eq("id", req.id);
    await notifyExternal({ event: "analysis.completed", request_id: req.id, requires_human_review: result.requires_human_review });
    return { analysisId: analysis.id, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const steps = (e as { steps?: StepRecord[] }).steps;
    await db
      .from("ai_analyses")
      .update({ status: "failed", error: msg, duration_ms: Date.now() - t0, finished_at: new Date().toISOString(), ...(steps ? { steps: steps as never } : {}) })
      .eq("id", analysis.id);
    await db.from("requests").update({ ai_status: "falhou" }).eq("id", req.id);
    throw e;
  }
}

/** Optional external notification webhook (NOTIFY_WEBHOOK_URL). No-op when unset. */
export async function notifyExternal(payload: Record<string, unknown>) {
  const url = process.env["NOTIFY_WEBHOOK_URL"];
  if (!url) return { sent: false, reason: "NOTIFY_WEBHOOK_URL não configurada" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "fluxoia", at: new Date().toISOString(), ...payload }),
    });
    return { sent: res.ok, reason: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
