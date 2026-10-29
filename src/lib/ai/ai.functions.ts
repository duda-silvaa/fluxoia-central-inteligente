import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getProviderConfig } = await import("./provider.server");
    const { n8nConfig } = await import("@/lib/automation/n8n.server");
    const cfg = getProviderConfig();
    return {
      ai: cfg ? { configured: true, provider: cfg.provider, model: cfg.model } : { configured: false, provider: null, model: null },
      n8n: { configured: !!n8nConfig() },
      notifyWebhook: { configured: !!process.env["NOTIFY_WEBHOOK_URL"] },
    };
  });

export const analyzeRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { analyzeRequest } = await import("./pipeline.server");
    try {
      const out = await analyzeRequest(context.supabase, {
        requestId: data.requestId,
        userId: context.userId,
        source: "manual",
      });
      return { ok: true as const, ...out };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  });

export const submitFeedbackFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        analysisId: z.string().uuid(),
        rating: z.union([z.literal(1), z.literal(-1)]),
        comment: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ai_analyses")
      .update({ feedback_rating: data.rating, feedback_comment: data.comment ?? null, feedback_by: context.userId })
      .eq("id", data.analysisId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Runs a slice of the synthetic evaluation set (max 4 cases per call to keep requests short). */
export const runEvalBatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ batchId: z.string().uuid(), caseIds: z.array(z.string()).min(1).max(4) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { runAgents } = await import("./pipeline.server");
    const { getProviderConfig } = await import("./provider.server");
    const { EVAL_CASES } = await import("./eval-cases");
    const { PROMPT_VERSION } = await import("./prompts");
    const cfg = getProviderConfig();
    if (!cfg) return { ok: false as const, error: "Provedor de IA não configurado." };
    const { data: org } = await context.supabase.rpc("current_org_id");
    if (!org) return { ok: false as const, error: "Organização não encontrada." };
    const results = [];
    for (const id of data.caseIds) {
      const c = EVAL_CASES.find((x) => x.id === id);
      if (!c) continue;
      const t0 = Date.now();
      let row: { predicted_category: string | null; predicted_priority: string | null; requires_review: boolean | null; valid_output: boolean; error: string | null };
      try {
        const { result } = await runAgents(c.title, c.description);
        row = { predicted_category: result.category, predicted_priority: result.priority, requires_review: result.requires_human_review, valid_output: true, error: null };
      } catch (e) {
        row = { predicted_category: null, predicted_priority: null, requires_review: null, valid_output: false, error: e instanceof Error ? e.message : String(e) };
      }
      const rec = {
        organization_id: org as string,
        batch_id: data.batchId,
        case_id: c.id,
        prompt_version: PROMPT_VERSION,
        model: cfg.model,
        expected_category: c.expected_category,
        expected_priority: c.expected_priority,
        duration_ms: Date.now() - t0,
        ...row,
      };
      const { error } = await context.supabase.from("eval_runs").insert(rec);
      if (error) throw new Error(error.message);
      results.push(rec);
    }
    return { ok: true as const, results };
  });
