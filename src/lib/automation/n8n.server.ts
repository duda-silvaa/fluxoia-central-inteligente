import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { hmacHex } from "./signature";

type DB = SupabaseClient<Database>;

export function n8nConfig() {
  const url = process.env["N8N_WEBHOOK_URL"];
  const secret = process.env["N8N_WEBHOOK_SECRET"];
  return url && secret ? { url, secret } : null;
}

export const MAX_DISPATCH_ATTEMPTS = 3;

/**
 * Sends a signed `request.created` event to n8n. Uses the admin client for
 * the automation_runs table (users can only read it). The caller must have
 * already verified that the request belongs to the user's organization.
 */
export async function dispatchToN8n(
  admin: DB,
  req: { id: string; organization_id: string; is_demo: boolean },
  attempt = 1,
) {
  const cfg = n8nConfig();
  if (!cfg) return { configured: false as const };
  const executionId = crypto.randomUUID();
  const started = Date.now();
  await admin.from("automation_runs").insert({
    execution_id: executionId,
    request_id: req.id,
    organization_id: req.organization_id,
    status: "pendente",
    attempt,
    is_demo: req.is_demo,
  });
  await admin.from("requests").update({ automation_status: "pendente" }).eq("id", req.id);

  const body = JSON.stringify({
    event: "request.created",
    execution_id: executionId,
    request_id: req.id,
    sent_at: new Date().toISOString(),
  });
  let lastError = "";
  for (let i = 0; i < MAX_DISPATCH_ATTEMPTS; i++) {
    const ts = String(Date.now());
    try {
      const res = await fetch(cfg.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FluxoIA-Timestamp": ts,
          "X-FluxoIA-Signature": "sha256=" + (await hmacHex(cfg.secret, `${ts}.${body}`)),
          "X-FluxoIA-Execution-Id": executionId,
        },
        body,
      });
      if (res.ok) return { configured: true as const, executionId, accepted: true };
      lastError = `n8n respondeu HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
      if (res.status < 500 && res.status !== 429) break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** i));
  }
  await admin
    .from("automation_runs")
    .update({ status: "falhou", error: lastError, finished_at: new Date().toISOString(), duration_ms: Date.now() - started })
    .eq("execution_id", executionId);
  await admin.from("requests").update({ automation_status: "falhou" }).eq("id", req.id);
  return { configured: true as const, executionId, accepted: false, error: lastError };
}
