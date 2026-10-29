/**
 * Provider abstraction for OpenAI-compatible Chat Completions endpoints.
 * Default: Lovable AI Gateway (LOVABLE_API_KEY). Override with
 * LLM_BASE_URL + LLM_API_KEY + LLM_MODEL to use any compatible provider.
 * Server-only: never import from browser code.
 */
export type ProviderConfig = {
  provider: string;
  baseURL: string;
  model: string;
  headers: Record<string, string>;
};

export class ProviderError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryable: boolean,
  ) {
    super(message);
  }
}

export function getProviderConfig(): ProviderConfig | null {
  const customKey = process.env["LLM_API_KEY"];
  const customUrl = process.env["LLM_BASE_URL"];
  if (customKey && customUrl) {
    return {
      provider: process.env["LLM_PROVIDER_NAME"] ?? "openai-compatible",
      baseURL: customUrl.replace(/\/$/, ""),
      model: process.env["LLM_MODEL"] ?? "gpt-4o-mini",
      headers: { Authorization: `Bearer ${customKey}` },
    };
  }
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  return {
    provider: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    model: process.env["LLM_MODEL"] ?? "google/gemini-3-flash-preview",
    headers: {
      Authorization: `Bearer ${key}`,
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
  };
}

const STEP_TIMEOUT_MS = 45_000;

/** Streams a chat completion and returns the concatenated text. */
export async function chatJson(
  cfg: ProviderConfig,
  system: string,
  user: string,
  runId?: { value?: string },
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STEP_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { ...cfg.headers, "Content-Type": "application/json" };
    if (runId?.value) headers["X-Lovable-AIG-Run-ID"] = runId.value;
    const res = await fetch(`${cfg.baseURL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        model: cfg.model,
        stream: true,
        temperature: 0.1,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (runId && !runId.value) {
      const rid = res.headers.get("X-Lovable-AIG-Run-ID");
      if (rid) runId.value = rid;
    }
    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      let msg = body;
      try {
        msg = JSON.parse(body)?.error?.message ?? JSON.parse(body)?.message ?? body;
      } catch {
        /* keep raw */
      }
      const friendly =
        res.status === 429
          ? "Limite de requisições do provedor de IA atingido. Tente novamente em instantes."
          : res.status === 402
            ? "Créditos de IA insuficientes no workspace."
            : `Provedor de IA retornou ${res.status}: ${String(msg).slice(0, 300)}`;
      throw new ProviderError(friendly, res.status, res.status === 429 || res.status >= 500);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const j = JSON.parse(data);
          if (j.error) throw new ProviderError(String(j.error.message ?? "Erro do provedor"), 500, false);
          text += j.choices?.[0]?.delta?.content ?? "";
        } catch (e) {
          if (e instanceof ProviderError) throw e;
        }
      }
    }
    if (!text.trim()) throw new ProviderError("O modelo retornou uma resposta vazia.", 502, false);
    return text;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError")
      throw new ProviderError(`Tempo limite de ${STEP_TIMEOUT_MS / 1000}s excedido.`, 504, true);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
