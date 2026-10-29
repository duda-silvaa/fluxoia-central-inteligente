import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifySignature } from "@/lib/automation/signature";

const bodySchema = z.object({
  execution_id: z.string().uuid(),
  status: z.enum(["concluida", "falhou"]),
  error: z.string().max(1000).optional(),
  notification_sent: z.boolean().optional(),
  notification_channel: z.string().max(60).optional(),
});

/** Final callback from n8n (step 8). Idempotent: repeated events are acknowledged without changes. */
export const Route = createFileRoute("/api/public/n8n/callback")({
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
        if (!run) return Response.json({ error: "unknown_execution" }, { status: 404 });
        if (run.status === "concluida" || run.status === "falhou")
          return Response.json({ ok: true, duplicate: true });
        const finished = new Date();
        await supabaseAdmin
          .from("automation_runs")
          .update({
            status: body.status,
            error: body.error ?? null,
            finished_at: finished.toISOString(),
            duration_ms: finished.getTime() - new Date(run.started_at).getTime(),
            result: { notification_sent: body.notification_sent ?? false, notification_channel: body.notification_channel ?? null },
          })
          .eq("id", run.id);
        if (run.request_id)
          await supabaseAdmin.from("requests").update({ automation_status: body.status }).eq("id", run.request_id);
        return Response.json({ ok: true });
      },
    },
  },
});
