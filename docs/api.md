# Endpoints e contratos

## Funções de servidor (autenticadas, chamadas pelo app)
Todas exigem o token do usuário (`Authorization: Bearer`, anexado automaticamente) e respeitam RLS.

| Função | Entrada | Saída |
|---|---|---|
| `getIntegrationStatus` | — | `{ ai: {configured, provider, model}, n8n: {configured}, notifyWebhook: {configured} }` |
| `analyzeRequestFn` | `{ requestId: uuid }` | `{ ok: true, analysisId, result: TriageResult }` ou `{ ok: false, error }` |
| `submitFeedbackFn` | `{ analysisId, rating: 1 \| -1, comment? }` | `{ ok: true }` |
| `runEvalBatchFn` | `{ batchId: uuid, caseIds: string[1..4] }` | `{ ok, results[] }` |
| `dispatchAutomationFn` | `{ requestId }` | `{ ok: true, executionId }` ou `{ ok: false, error, notConfigured? }` |
| `reviewRequestFn` | `{ requestId, category, priority, reviewMinutes? }` | `{ ok: true, corrected }` |

`TriageResult`:
```json
{
  "category": "Suporte técnico",
  "priority": "Alta",
  "summary": "…",
  "reasoning_summary": "…",
  "suggested_action": "…",
  "missing_information": ["…"],
  "confidence_estimate": 0.82,
  "requires_human_review": true
}
```

Regras: duplicidade bloqueada (análise em execução nos últimos 2 min), limite de 40 análises/hora por organização, timeout de 45 s por agente, 1 nova tentativa para erros transitórios ou JSON inválido.

## Endpoints públicos (chamados pelo n8n)
Assinatura obrigatória: `X-FluxoIA-Timestamp: <ms>` e `X-FluxoIA-Signature: sha256=<hex HMAC-SHA256(N8N_WEBHOOK_SECRET, timestamp + "." + corpo bruto)>`. Eventos com mais de 5 minutos são rejeitados.

### `POST /api/public/n8n/analyze`
Corpo: `{ "execution_id": uuid, "request_id": uuid }`
- 200 `{ ok: true, analysis_id, result }`
- 401 assinatura inválida · 400 corpo inválido · 404 execução desconhecida · 409 execução já finalizada · 422 `{ ok:false, error }` falha da análise · 503 não configurado

### `POST /api/public/n8n/callback`
Corpo: `{ execution_id, status: "concluida"|"falhou", error?, notification_sent?, notification_channel? }`
- 200 `{ ok: true }` · 200 `{ ok: true, duplicate: true }` para eventos repetidos · 401/400/404/503 como acima.

## Evento enviado ao n8n
`POST N8N_WEBHOOK_URL` com `{ event: "request.created", execution_id, request_id, sent_at }` e os mesmos cabeçalhos de assinatura. Não inclui o texto da solicitação.

## Webhook de notificação opcional
Se `NOTIFY_WEBHOOK_URL` existir, o servidor envia `{ source: "fluxoia", at, event: "analysis.completed", request_id, requires_human_review }`.
