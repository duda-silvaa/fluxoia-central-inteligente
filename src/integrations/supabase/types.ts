export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_analyses: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          feedback_by: string | null
          feedback_comment: string | null
          feedback_rating: number | null
          finished_at: string | null
          id: string
          model: string | null
          organization_id: string
          output: Json | null
          prompt_version: string
          provider: string | null
          request_id: string | null
          status: string
          steps: Json
          trigger_source: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          feedback_by?: string | null
          feedback_comment?: string | null
          feedback_rating?: number | null
          finished_at?: string | null
          id?: string
          model?: string | null
          organization_id: string
          output?: Json | null
          prompt_version: string
          provider?: string | null
          request_id?: string | null
          status?: string
          steps?: Json
          trigger_source?: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          feedback_by?: string | null
          feedback_comment?: string | null
          feedback_rating?: number | null
          finished_at?: string | null
          id?: string
          model?: string | null
          organization_id?: string
          output?: Json | null
          prompt_version?: string
          provider?: string | null
          request_id?: string | null
          status?: string
          steps?: Json
          trigger_source?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analyses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          attempt: number
          created_at: string
          duration_ms: number | null
          error: string | null
          event_type: string
          execution_id: string
          finished_at: string | null
          id: string
          is_demo: boolean
          organization_id: string
          request_id: string | null
          result: Json | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          event_type?: string
          execution_id: string
          finished_at?: string | null
          id?: string
          is_demo?: boolean
          organization_id: string
          request_id?: string | null
          result?: Json | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          event_type?: string
          execution_id?: string
          finished_at?: string | null
          id?: string
          is_demo?: boolean
          organization_id?: string
          request_id?: string | null
          result?: Json | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_runs: {
        Row: {
          batch_id: string
          case_id: string
          created_at: string
          duration_ms: number | null
          error: string | null
          expected_category: string
          expected_priority: string
          id: string
          model: string | null
          organization_id: string
          predicted_category: string | null
          predicted_priority: string | null
          prompt_version: string
          requires_review: boolean | null
          valid_output: boolean
        }
        Insert: {
          batch_id: string
          case_id: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          expected_category: string
          expected_priority: string
          id?: string
          model?: string | null
          organization_id: string
          predicted_category?: string | null
          predicted_priority?: string | null
          prompt_version: string
          requires_review?: boolean | null
          valid_output?: boolean
        }
        Update: {
          batch_id?: string
          case_id?: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          expected_category?: string
          expected_priority?: string
          id?: string
          model?: string | null
          organization_id?: string
          predicted_category?: string | null
          predicted_priority?: string | null
          prompt_version?: string
          requires_review?: boolean | null
          valid_output?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "eval_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      human_reviews: {
        Row: {
          action: string
          corrected_value: string | null
          created_at: string
          field: string | null
          id: string
          organization_id: string
          original_value: string | null
          request_id: string
          review_minutes: number | null
          reviewer_id: string
          reviewer_label: string | null
        }
        Insert: {
          action: string
          corrected_value?: string | null
          created_at?: string
          field?: string | null
          id?: string
          organization_id?: string
          original_value?: string | null
          request_id: string
          review_minutes?: number | null
          reviewer_id?: string
          reviewer_label?: string | null
        }
        Update: {
          action?: string
          corrected_value?: string | null
          created_at?: string
          field?: string | null
          id?: string
          organization_id?: string
          original_value?: string | null
          request_id?: string
          review_minutes?: number | null
          reviewer_id?: string
          reviewer_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "human_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "human_reviews_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          organization_id: string
          read_at: string | null
          request_id: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          organization_id: string
          read_at?: string | null
          request_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          read_at?: string | null
          request_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          job_title: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          job_title?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      request_history: {
        Row: {
          actor_id: string | null
          actor_label: string | null
          created_at: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          organization_id: string
          request_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          organization_id: string
          request_id: string
        }
        Update: {
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          organization_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          ai_analyzed_at: string | null
          ai_category: Database["public"]["Enums"]["request_category"] | null
          ai_confidence: number | null
          ai_missing_info: Json | null
          ai_priority: Database["public"]["Enums"]["request_priority"] | null
          ai_reasoning: string | null
          ai_requires_review: boolean | null
          ai_status: Database["public"]["Enums"]["ai_state"]
          ai_suggested_action: string | null
          ai_summary: string | null
          assignee: string | null
          automation_status: Database["public"]["Enums"]["automation_state"]
          category: Database["public"]["Enums"]["request_category"] | null
          code: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          human_approved: boolean
          human_corrected: boolean
          id: string
          is_demo: boolean
          organization_id: string
          priority: Database["public"]["Enums"]["request_priority"] | null
          requester: string
          source: string
          status: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at: string
        }
        Insert: {
          ai_analyzed_at?: string | null
          ai_category?: Database["public"]["Enums"]["request_category"] | null
          ai_confidence?: number | null
          ai_missing_info?: Json | null
          ai_priority?: Database["public"]["Enums"]["request_priority"] | null
          ai_reasoning?: string | null
          ai_requires_review?: boolean | null
          ai_status?: Database["public"]["Enums"]["ai_state"]
          ai_suggested_action?: string | null
          ai_summary?: string | null
          assignee?: string | null
          automation_status?: Database["public"]["Enums"]["automation_state"]
          category?: Database["public"]["Enums"]["request_category"] | null
          code?: never
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          human_approved?: boolean
          human_corrected?: boolean
          id?: string
          is_demo?: boolean
          organization_id?: string
          priority?: Database["public"]["Enums"]["request_priority"] | null
          requester: string
          source?: string
          status?: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at?: string
        }
        Update: {
          ai_analyzed_at?: string | null
          ai_category?: Database["public"]["Enums"]["request_category"] | null
          ai_confidence?: number | null
          ai_missing_info?: Json | null
          ai_priority?: Database["public"]["Enums"]["request_priority"] | null
          ai_reasoning?: string | null
          ai_requires_review?: boolean | null
          ai_status?: Database["public"]["Enums"]["ai_state"]
          ai_suggested_action?: string | null
          ai_summary?: string | null
          assignee?: string | null
          automation_status?: Database["public"]["Enums"]["automation_state"]
          category?: Database["public"]["Enums"]["request_category"] | null
          code?: never
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          human_approved?: boolean
          human_corrected?: boolean
          id?: string
          is_demo?: boolean
          organization_id?: string
          priority?: Database["public"]["Enums"]["request_priority"] | null
          requester?: string
          source?: string
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_measurements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          method: string
          minutes: number
          notes: string | null
          observations: number
          organization_id: string
          task: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          method: string
          minutes: number
          notes?: string | null
          observations?: number
          organization_id?: string
          task: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          method?: string
          minutes?: number
          notes?: string | null
          observations?: number
          organization_id?: string
          task?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_measurements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_org_id: { Args: never; Returns: string }
      reset_demo_data: { Args: never; Returns: undefined }
      seed_demo_data: { Args: never; Returns: number }
    }
    Enums: {
      ai_state: "nao_analisada" | "analisando" | "concluida" | "falhou"
      automation_state:
        | "nenhuma"
        | "pendente"
        | "executando"
        | "concluida"
        | "falhou"
      request_category:
        | "Suporte técnico"
        | "Acesso e permissões"
        | "Dados e relatórios"
        | "Sistemas e aplicações"
        | "Infraestrutura"
        | "Administrativo"
        | "Outros"
      request_priority: "Baixa" | "Média" | "Alta" | "Crítica"
      request_status:
        | "Nova"
        | "Em triagem"
        | "Pendente de revisão"
        | "Em andamento"
        | "Aguardando informação"
        | "Concluída"
        | "Cancelada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_state: ["nao_analisada", "analisando", "concluida", "falhou"],
      automation_state: [
        "nenhuma",
        "pendente",
        "executando",
        "concluida",
        "falhou",
      ],
      request_category: [
        "Suporte técnico",
        "Acesso e permissões",
        "Dados e relatórios",
        "Sistemas e aplicações",
        "Infraestrutura",
        "Administrativo",
        "Outros",
      ],
      request_priority: ["Baixa", "Média", "Alta", "Crítica"],
      request_status: [
        "Nova",
        "Em triagem",
        "Pendente de revisão",
        "Em andamento",
        "Aguardando informação",
        "Concluída",
        "Cancelada",
      ],
    },
  },
} as const
