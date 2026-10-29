import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Dispatches (or re-dispatches) the n8n automation for a request the caller can read. */
export const dispatchAutomationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS check: the user must be able to read the request
    const { data: req, error } = await context.supabase
      .from("requests")
      .select("id, organization_id, is_demo, automation_status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) return { ok: false as const, error: "Solicitação não encontrada." };
    if (req.automation_status === "pendente" || req.automation_status === "executando")
      return { ok: false as const, error: "Já existe uma automação em andamento." };
    const { n8nConfig, dispatchToN8n } = await import("./n8n.server");
    if (!n8nConfig()) return { ok: false as const, notConfigured: true, error: "n8n não configurado (N8N_WEBHOOK_URL / N8N_WEBHOOK_SECRET)." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("automation_runs")
      .select("id", { count: "exact", head: true })
      .eq("request_id", req.id);
    const res = await dispatchToN8n(supabaseAdmin, req, (count ?? 0) + 1);
    if (!res.configured) return { ok: false as const, notConfigured: true, error: "n8n não configurado." };
    return res.accepted
      ? { ok: true as const, executionId: res.executionId }
      : { ok: false as const, error: res.error ?? "Falha ao enviar evento ao n8n." };
  });

/** Records a human approval or correction of the AI suggestion. */
export const reviewRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        category: z.string().min(1),
        priority: z.string().min(1),
        reviewMinutes: z.number().min(0).max(600).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: req, error } = await db.from("requests").select("*").eq("id", data.requestId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("Solicitação não encontrada.");
    if (req.ai_status !== "concluida") throw new Error("Não há sugestão de IA concluída para revisar.");
    const { data: prof } = await db.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
    const label = prof?.full_name ?? "Usuário";
    const reviews = [];
    if (data.category !== req.ai_category)
      reviews.push({ field: "categoria", original_value: req.ai_category, corrected_value: data.category });
    if (data.priority !== req.ai_priority)
      reviews.push({ field: "prioridade", original_value: req.ai_priority, corrected_value: data.priority });
    const rows: { action: string; request_id: string; reviewer_id: string; reviewer_label: string; field: string | null; original_value: string | null; corrected_value: string | null; review_minutes: number | null }[] =
      reviews.length > 0
        ? reviews.map((r) => ({ ...r, action: "corrigida", request_id: req.id, reviewer_id: context.userId, reviewer_label: label, review_minutes: data.reviewMinutes ?? null }))
        : [{ action: "aprovada", request_id: req.id, reviewer_id: context.userId, reviewer_label: label, field: null, original_value: null, corrected_value: null, review_minutes: data.reviewMinutes ?? null }];
    const { error: insErr } = await db.from("human_reviews").insert(rows);
    if (insErr) throw new Error(insErr.message);
    const { error: upErr } = await db
      .from("requests")
      .update({
        category: data.category as never,
        priority: data.priority as never,
        human_corrected: req.human_corrected || reviews.length > 0,
        human_approved: true,
        status: req.status === "Pendente de revisão" || req.status === "Em triagem" || req.status === "Nova" ? "Em andamento" : req.status,
      })
      .eq("id", req.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, corrected: reviews.length > 0 };
  });
