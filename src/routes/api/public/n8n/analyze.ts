import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifySignature } from "@/lib/automation/signature";

const bodySchema = z.object({ execution_id: z.string().uuid(), request_id: z.string().uuid() });

/**
 * Called by n8n (step 4 of the flow). Requires an HMAC signature with
 * N8N_WEBHOOK_SECRET over `${X-FluxoIA-Timestamp}.${rawBody}`.
 * Never returns request content — only the structured triage result.
 */
export const Route = createFileRoute("/api/public/n8n/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["N8N_WEBHOOK_SECRET"];
        if (!secret) return Response.json({ error: "not_configured" }, { status: 503 });
        const raw = await request.text();
        const ok = await verifySignature(secret, raw, request.headers.get("x-fluxoia-timestamp"), request.headers.get("x-fluxoia-signature"));
        if (!ok) return Response.json({ error: "invalid_signature" }, { status: 401 });
        let body;
        try {
          body = bodySchema.parse(JSON.parse(raw));
        } catch {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: run } = await supabaseAdmin
          .from("automation_runs")
          .select("*")
          .eq("execution_id", body.execution_id)
          .maybeSingle();
        if (!run || run.request_id !== body.request_id)
          return Response.json({ error: "unknown_execution" }, { status: 404 });
        if (run.status === "concluida" || run.status === "falhou")
          return Response.json({ error: "execution_already_finished", status: run.status }, { status: 409 });
        await supabaseAdmin.from("automation_runs").update({ status: "executando" }).eq("id", run.id);
        await supabaseAdmin.from("requests").update({ automation_status: "executando" }).eq("id", run.request_id!);
        const { analyzeRequest } = await import("@/lib/ai/pipeline.server");
        try {
          const out = await analyzeRequest(supabaseAdmin, {
            requestId: body.request_id,
            organizationId: run.organization_id,
            source: "n8n",
          });
          return Response.json({ ok: true, analysis_id: out.analysisId, result: out.result });
        } catch (e) {
          return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 422 });
        }
      },
    },
  },
});
