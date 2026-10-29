import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AI_STATUS_LABEL, AUTOMATION_STATUS_LABEL, PRIORITY_TONE, type Priority } from "@/lib/domain";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Loading({ label = "Carregando..." }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-14 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="mt-3 font-medium">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error)}</span>
    </div>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

export function PriorityBadge({ value }: { value: Priority | null }) {
  if (!value) return <Pill className="bg-muted text-muted-foreground">—</Pill>;
  return <Pill className={PRIORITY_TONE[value]}>{value}</Pill>;
}

const STATUS_TONE: Record<string, string> = {
  Nova: "bg-info/15 text-info",
  "Em triagem": "bg-accent text-accent-foreground",
  "Pendente de revisão": "bg-warning/20 text-warning-foreground",
  "Em andamento": "bg-primary/15 text-primary",
  "Aguardando informação": "bg-muted text-muted-foreground",
  Concluída: "bg-success/15 text-success",
  Cancelada: "bg-muted text-muted-foreground line-through",
};
export function StatusBadge({ value }: { value: string }) {
  return <Pill className={STATUS_TONE[value] ?? "bg-muted"}>{value}</Pill>;
}

const AI_TONE: Record<string, string> = {
  nao_analisada: "bg-muted text-muted-foreground",
  analisando: "bg-info/15 text-info",
  concluida: "bg-success/15 text-success",
  falhou: "bg-destructive/15 text-destructive",
};
export function AiBadge({ value }: { value: string }) {
  return <Pill className={AI_TONE[value] ?? ""}>{AI_STATUS_LABEL[value] ?? value}</Pill>;
}
const AUTO_TONE: Record<string, string> = {
  nenhuma: "bg-muted text-muted-foreground",
  pendente: "bg-warning/20 text-warning-foreground",
  executando: "bg-info/15 text-info",
  concluida: "bg-success/15 text-success",
  falhou: "bg-destructive/15 text-destructive",
};
export function AutomationBadge({ value }: { value: string }) {
  return <Pill className={AUTO_TONE[value] ?? ""}>{AUTOMATION_STATUS_LABEL[value] ?? value}</Pill>;
}

export function DemoTag() {
  return <Pill className="border border-warning/50 bg-warning/15 text-warning-foreground">Demonstração</Pill>;
}

export function StatCard({ label, value, hint, icon, tone }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon && <span className={cn("text-muted-foreground", tone)}>{icon}</span>}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
export function fmtMin(n: number | null | undefined, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) < 1) return `${(n * 60).toFixed(0)} s`;
  return `${n.toFixed(digits)} min`;
}
export function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(0)}%`;
}
