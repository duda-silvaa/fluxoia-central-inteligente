import type { Database } from "@/integrations/supabase/types";

export type RequestRow = Database["public"]["Tables"]["requests"]["Row"];
export type AnalysisRow = Database["public"]["Tables"]["ai_analyses"]["Row"];
export type RunRow = Database["public"]["Tables"]["automation_runs"]["Row"];
export type ReviewRow = Database["public"]["Tables"]["human_reviews"]["Row"];
export type MeasurementRow = Database["public"]["Tables"]["time_measurements"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type HistoryRow = Database["public"]["Tables"]["request_history"]["Row"];
export type EvalRunRow = Database["public"]["Tables"]["eval_runs"]["Row"];

export type Category = Database["public"]["Enums"]["request_category"];
export type Priority = Database["public"]["Enums"]["request_priority"];
export type Status = Database["public"]["Enums"]["request_status"];

export const CATEGORIES: Category[] = [
  "Suporte técnico",
  "Acesso e permissões",
  "Dados e relatórios",
  "Sistemas e aplicações",
  "Infraestrutura",
  "Administrativo",
  "Outros",
];
export const PRIORITIES: Priority[] = ["Baixa", "Média", "Alta", "Crítica"];
export const STATUSES: Status[] = [
  "Nova",
  "Em triagem",
  "Pendente de revisão",
  "Em andamento",
  "Aguardando informação",
  "Concluída",
  "Cancelada",
];

export const AI_STATUS_LABEL: Record<string, string> = {
  nao_analisada: "Não analisada",
  analisando: "Analisando",
  concluida: "Analisada",
  falhou: "Falhou",
};
export const AUTOMATION_STATUS_LABEL: Record<string, string> = {
  nenhuma: "Sem automação",
  pendente: "Pendente",
  executando: "Executando",
  concluida: "Concluída",
  falhou: "Falhou",
};

export const PRIORITY_TONE: Record<Priority, string> = {
  Baixa: "bg-muted text-muted-foreground",
  Média: "bg-info/15 text-info",
  Alta: "bg-warning/20 text-warning-foreground",
  Crítica: "bg-destructive/15 text-destructive",
};
