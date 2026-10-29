<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Data access: browser uses the generated client under RLS; every private table is scoped by `organization_id = current_org_id()` — why: per-organization isolation without trusting the client.
- AI calls live only in `src/lib/ai/*.server.ts`, loaded via dynamic import inside server-function/route handlers — why: keeps keys and prompts out of the client bundle.
- The triage pipeline is three sequential agent steps with Zod-validated JSON; prompt changes must bump `PROMPT_VERSION` — why: every analysis records which prompt produced it.
- n8n endpoints under `/api/public/n8n/*` must verify the HMAC signature (`src/lib/automation/signature.ts`) before any read/write — why: these routes bypass auth.
- Demo data is flagged `is_demo` and must stay separable from observed metrics — why: impact numbers must never mix fictitious and real data.
- Metric formulas live in `src/lib/metrics.ts` with tests in `src/test/business-rules.test.ts` — why: indicators must be derived and verifiable.
