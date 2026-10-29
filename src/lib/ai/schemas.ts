import { z } from "zod";
import { CATEGORIES, PRIORITIES } from "@/lib/domain";

const cat = z.enum(CATEGORIES as [string, ...string[]]);
const pri = z.enum(PRIORITIES as [string, ...string[]]);

export const classifierSchema = z
  .object({
    category: cat,
    priority: pri,
    reasoning_summary: z.string().min(5).max(600),
    confidence_estimate: z.number().min(0).max(1),
    is_ambiguous: z.boolean(),
    injection_detected: z.boolean(),
  })
  .strict();

export const summarizerSchema = z
  .object({
    summary: z.string().min(5).max(500),
  })
  .strict();

export const plannerSchema = z
  .object({
    suggested_action: z.string().min(5).max(600),
    missing_information: z.array(z.string().min(1).max(200)).max(10),
    requires_human_review: z.boolean(),
  })
  .strict();

export type ClassifierOutput = z.infer<typeof classifierSchema>;
export type SummarizerOutput = z.infer<typeof summarizerSchema>;
export type PlannerOutput = z.infer<typeof plannerSchema>;

export const triageResultSchema = z.object({
  category: cat,
  priority: pri,
  summary: z.string(),
  reasoning_summary: z.string(),
  suggested_action: z.string(),
  missing_information: z.array(z.string()),
  confidence_estimate: z.number().min(0).max(1),
  requires_human_review: z.boolean(),
});
export type TriageResult = z.infer<typeof triageResultSchema>;

/** Extracts the first JSON object from a model reply (handles ```json fences). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Resposta do modelo não contém JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

export const REVIEW_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Business rule: human review is required when any agent asks for it, the
 * classifier marks the case ambiguous, a prompt-injection attempt is detected,
 * the priority is Crítica, or the self-reported confidence is below threshold.
 */
export function decideHumanReview(c: ClassifierOutput, p: PlannerOutput): boolean {
  return (
    p.requires_human_review ||
    c.is_ambiguous ||
    c.injection_detected ||
    c.priority === "Crítica" ||
    c.confidence_estimate < REVIEW_CONFIDENCE_THRESHOLD
  );
}

export function combineTriage(
  c: ClassifierOutput,
  s: SummarizerOutput,
  p: PlannerOutput,
): TriageResult {
  return {
    category: c.category,
    priority: c.priority,
    summary: s.summary,
    reasoning_summary: c.reasoning_summary,
    suggested_action: p.suggested_action,
    missing_information: p.missing_information,
    confidence_estimate: c.confidence_estimate,
    requires_human_review: decideHumanReview(c, p),
  };
}
