// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/gen-db-types.mjs <postgres-url>
// Source of truth is supabase/migrations/*.sql.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      absences: {
        Row: {
          id: string
          org_id: string
          code: string | null
          employee_id: string
          kind: "Vacaciones" | "Incapacidad" | "Permiso" | "Licencia" | "Cita médica" | "Otro"
          starts_on: string
          ends_on: string
          status: "Programada" | "Activa" | "Finalizada" | "Resuelta" | "Rechazada"
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
          days: number | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          employee_id: string
          kind: "Vacaciones" | "Incapacidad" | "Permiso" | "Licencia" | "Cita médica" | "Otro"
          starts_on: string
          ends_on: string
          status?: "Programada" | "Activa" | "Finalizada" | "Resuelta" | "Rechazada"
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          employee_id?: string
          kind?: "Vacaciones" | "Incapacidad" | "Permiso" | "Licencia" | "Cita médica" | "Otro"
          starts_on?: string
          ends_on?: string
          status?: "Programada" | "Activa" | "Finalizada" | "Resuelta" | "Rechazada"
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "absences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_programs: {
        Row: {
          id: string
          org_id: string
          code: string | null
          name: string
          level: string
          duration_terms: number | null
          tuition_cents: number
          coordinator_id: string | null
          description: string
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          name: string
          level?: string
          duration_terms?: number | null
          tuition_cents?: number
          coordinator_id?: string | null
          description?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          name?: string
          level?: string
          duration_terms?: number | null
          tuition_cents?: number
          coordinator_id?: string | null
          description?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_programs_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_programs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      account_memberships: {
        Row: {
          account_id: string
          user_id: string
          role: "owner" | "billing" | "admin"
          created_at: string
          updated_at: string
        }
        Insert: {
          account_id: string
          user_id: string
          role: "owner" | "billing" | "admin"
          created_at?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          user_id?: string
          role?: "owner" | "billing" | "admin"
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_memberships_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          id: string
          name: string
          plan: "starter" | "growth" | "enterprise"
          billing_customer_id: string | null
          billing_subscription_id: string | null
          billing_status: string | null
          onboarding_completed_at: string | null
          created_at: string
          updated_at: string
          billing_provider: string | null
        }
        Insert: {
          id?: string
          name: string
          plan?: "starter" | "growth" | "enterprise"
          billing_customer_id?: string | null
          billing_subscription_id?: string | null
          billing_status?: string | null
          onboarding_completed_at?: string | null
          created_at?: string
          updated_at?: string
          billing_provider?: string | null
        }
        Update: {
          id?: string
          name?: string
          plan?: "starter" | "growth" | "enterprise"
          billing_customer_id?: string | null
          billing_subscription_id?: string | null
          billing_status?: string | null
          onboarding_completed_at?: string | null
          created_at?: string
          updated_at?: string
          billing_provider?: string | null
        }
        Relationships: [
        ]
      }
      ai_conversations: {
        Row: {
          id: string
          org_id: string
          user_id: string
          title: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          title?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          title?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          id: string
          org_id: string
          kind: "dashboard" | "riesgos"
          payload: Json
          generated_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          org_id: string
          kind: "dashboard" | "riesgos"
          payload: Json
          generated_at?: string
          expires_at: string
        }
        Update: {
          id?: string
          org_id?: string
          kind?: "dashboard" | "riesgos"
          payload?: Json
          generated_at?: string
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          id: string
          conversation_id: string
          role: "user" | "assistant" | "system" | "tool"
          content: string
          citations: Json
          usage: Json
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: "user" | "assistant" | "system" | "tool"
          content?: string
          citations?: Json
          usage?: Json
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: "user" | "assistant" | "system" | "tool"
          content?: string
          citations?: Json
          usage?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_monthly_budgets: {
        Row: {
          org_id: string
          month_start: string
          limit_cents: number
          reserved_cents: number
          mode: "soft" | "hard"
          updated_at: string
        }
        Insert: {
          org_id: string
          month_start: string
          limit_cents?: number
          reserved_cents?: number
          mode?: "soft" | "hard"
          updated_at?: string
        }
        Update: {
          org_id?: string
          month_start?: string
          limit_cents?: number
          reserved_cents?: number
          mode?: "soft" | "hard"
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_monthly_budgets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          id: string
          org_id: string
          user_id: string | null
          document_id: string | null
          operation: "chat" | "embedding" | "retrieval" | "review"
          model: string
          input_tokens: number
          output_tokens: number
          embedding_tokens: number
          estimated_cost_cents: number
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id?: string | null
          document_id?: string | null
          operation: "chat" | "embedding" | "retrieval" | "review"
          model: string
          input_tokens?: number
          output_tokens?: number
          embedding_tokens?: number
          estimated_cost_cents?: number
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string | null
          document_id?: string | null
          operation?: "chat" | "embedding" | "retrieval" | "review"
          model?: string
          input_tokens?: number
          output_tokens?: number
          embedding_tokens?: number
          estimated_cost_cents?: number
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          id: number
          org_id: string
          actor_id: string | null
          actor_email: string | null
          action: "insert" | "update" | "delete"
          table_name: string
          record_id: string | null
          record_code: string | null
          changes: Json
          occurred_at: string
        }
        Insert: {
          org_id: string
          actor_id?: string | null
          actor_email?: string | null
          action: "insert" | "update" | "delete"
          table_name: string
          record_id?: string | null
          record_code?: string | null
          changes?: Json
          occurred_at?: string
        }
        Update: {
          org_id?: string
          actor_id?: string | null
          actor_email?: string | null
          action?: "insert" | "update" | "delete"
          table_name?: string
          record_id?: string | null
          record_code?: string | null
          changes?: Json
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      benefits: {
        Row: {
          id: string
          org_id: string
          name: string
          kind: "Salud" | "Alimentación" | "Seguro" | "Transporte" | "Educación" | "Otro"
          monthly_cost_cents: number
          coverage_pct: number
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          kind?: "Salud" | "Alimentación" | "Seguro" | "Transporte" | "Educación" | "Otro"
          monthly_cost_cents?: number
          coverage_pct?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          kind?: "Salud" | "Alimentación" | "Seguro" | "Transporte" | "Educación" | "Otro"
          monthly_cost_cents?: number
          coverage_pct?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "benefits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          id: string
          provider: string
          event_id: string
          kind: string
          account_id: string | null
          payload: Json
          received_at: string
          applied_at: string | null
          error: string | null
        }
        Insert: {
          id?: string
          provider: string
          event_id: string
          kind: string
          account_id?: string | null
          payload?: Json
          received_at?: string
          applied_at?: string | null
          error?: string | null
        }
        Update: {
          id?: string
          provider?: string
          event_id?: string
          kind?: string
          account_id?: string | null
          payload?: Json
          received_at?: string
          applied_at?: string | null
          error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_attendees: {
        Row: {
          id: string
          calendar_event_id: string
          employee_id: string | null
          email: string | null
          response: "Pendiente" | "Aceptada" | "Rechazada"
        }
        Insert: {
          id?: string
          calendar_event_id: string
          employee_id?: string | null
          email?: string | null
          response?: "Pendiente" | "Aceptada" | "Rechazada"
        }
        Update: {
          id?: string
          calendar_event_id?: string
          employee_id?: string | null
          email?: string | null
          response?: "Pendiente" | "Aceptada" | "Rechazada"
        }
        Relationships: [
          {
            foreignKeyName: "calendar_attendees_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_attendees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          id: string
          org_id: string
          code: string | null
          title: string
          kind: "Interna" | "1:1" | "Entrevista" | "Onboarding" | "Consultoría" | "Reclutamiento" | "Confidencial" | "Otro"
          starts_at: string
          ends_at: string
          location: string
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          title: string
          kind?: "Interna" | "1:1" | "Entrevista" | "Onboarding" | "Consultoría" | "Reclutamiento" | "Confidencial" | "Otro"
          starts_at: string
          ends_at: string
          location?: string
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          title?: string
          kind?: "Interna" | "1:1" | "Entrevista" | "Onboarding" | "Consultoría" | "Reclutamiento" | "Confidencial" | "Otro"
          starts_at?: string
          ends_at?: string
          location?: string
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          id: string
          job_opening_id: string
          full_name: string
          email: string | null
          stage: "Postulado" | "Preselección" | "Entrevista" | "Prueba" | "Oferta" | "Contratado" | "Descartado"
          score: number | null
          source: string
          created_at: string
          updated_at: string
          phone: string
          rating: number | null
          expected_salary_cents: number
          resume_url: string | null
          notes: string
          applied_on: string
          employee_id: string | null
        }
        Insert: {
          id?: string
          job_opening_id: string
          full_name: string
          email?: string | null
          stage?: "Postulado" | "Preselección" | "Entrevista" | "Prueba" | "Oferta" | "Contratado" | "Descartado"
          score?: number | null
          source?: string
          created_at?: string
          updated_at?: string
          phone?: string
          rating?: number | null
          expected_salary_cents?: number
          resume_url?: string | null
          notes?: string
          applied_on?: string
          employee_id?: string | null
        }
        Update: {
          id?: string
          job_opening_id?: string
          full_name?: string
          email?: string | null
          stage?: "Postulado" | "Preselección" | "Entrevista" | "Prueba" | "Oferta" | "Contratado" | "Descartado"
          score?: number | null
          source?: string
          created_at?: string
          updated_at?: string
          phone?: string
          rating?: number | null
          expected_salary_cents?: number
          resume_url?: string | null
          notes?: string
          applied_on?: string
          employee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "job_openings"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          id: string
          session_id: string
          kind: "Ingreso" | "Egreso" | "Retiro" | "Gasto"
          amount_cents: number
          concept: string
          method: "Transferencia" | "Efectivo" | "Tarjeta" | "Cheque" | "Otro"
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          kind?: "Ingreso" | "Egreso" | "Retiro" | "Gasto"
          amount_cents: number
          concept: string
          method?: "Transferencia" | "Efectivo" | "Tarjeta" | "Cheque" | "Otro"
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          kind?: "Ingreso" | "Egreso" | "Retiro" | "Gasto"
          amount_cents?: number
          concept?: string
          method?: "Transferencia" | "Efectivo" | "Tarjeta" | "Cheque" | "Otro"
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          id: string
          org_id: string
          code: string | null
          opened_by: string | null
          opened_at: string
          opening_float_cents: number
          closed_at: string | null
          closed_by: string | null
          counted_cents: number | null
          expected_cents: number | null
          status: "Abierta" | "Cerrada"
          notes: string
          created_at: string
          updated_at: string
          site_id: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          opened_by?: string | null
          opened_at?: string
          opening_float_cents?: number
          closed_at?: string | null
          closed_by?: string | null
          counted_cents?: number | null
          expected_cents?: number | null
          status?: "Abierta" | "Cerrada"
          notes?: string
          created_at?: string
          updated_at?: string
          site_id?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          opened_by?: string | null
          opened_at?: string
          opening_float_cents?: number
          closed_at?: string | null
          closed_by?: string | null
          counted_cents?: number | null
          expected_cents?: number | null
          status?: "Abierta" | "Cerrada"
          notes?: string
          created_at?: string
          updated_at?: string
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          id: string
          org_id: string
          employee_id: string | null
          name: string
          provider: string
          issued_on: string | null
          expires_on: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          employee_id?: string | null
          name: string
          provider?: string
          issued_on?: string | null
          expires_on?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          employee_id?: string | null
          name?: string
          provider?: string
          issued_on?: string | null
          expires_on?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          id: string
          channel_id: string
          employee_id: string
        }
        Insert: {
          id?: string
          channel_id: string
          employee_id: string
        }
        Update: {
          id?: string
          channel_id?: string
          employee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_messages: {
        Row: {
          id: string
          channel_id: string
          author_id: string | null
          body: string
          project_id: string | null
          created_at: string
          edited_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          channel_id: string
          author_id?: string | null
          body: string
          project_id?: string | null
          created_at?: string
          edited_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          channel_id?: string
          author_id?: string | null
          body?: string
          project_id?: string | null
          created_at?: string
          edited_at?: string | null
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          id: string
          org_id: string
          slug: string
          name: string
          kind: "grupo" | "directo"
          project_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          slug: string
          name: string
          kind?: "grupo" | "directo"
          project_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          slug?: string
          name?: string
          kind?: "grupo" | "directo"
          project_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedules: {
        Row: {
          id: string
          org_id: string
          program_id: string | null
          subject: string
          teacher_id: string | null
          weekday: "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado" | "Domingo"
          start_time: string
          end_time: string
          classroom: string
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          program_id?: string | null
          subject: string
          teacher_id?: string | null
          weekday: "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado" | "Domingo"
          start_time: string
          end_time: string
          classroom?: string
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          program_id?: string | null
          subject?: string
          teacher_id?: string | null
          weekday?: "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado" | "Domingo"
          start_time?: string
          end_time?: string
          classroom?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "academic_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          id: string
          client_id: string
          full_name: string
          position: string
          email: string | null
          phone: string
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          full_name: string
          position?: string
          email?: string | null
          phone?: string
          is_primary?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          full_name?: string
          position?: string
          email?: string | null
          phone?: string
          is_primary?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_interactions: {
        Row: {
          id: string
          client_id: string
          kind: "Llamada" | "Correo" | "Reunión" | "Visita" | "Nota"
          subject: string
          detail: string
          employee_id: string | null
          happened_at: string
          follow_up_on: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          kind?: "Llamada" | "Correo" | "Reunión" | "Visita" | "Nota"
          subject?: string
          detail?: string
          employee_id?: string | null
          happened_at?: string
          follow_up_on?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          kind?: "Llamada" | "Correo" | "Reunión" | "Visita" | "Nota"
          subject?: string
          detail?: string
          employee_id?: string | null
          happened_at?: string
          follow_up_on?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_interactions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          id: string
          org_id: string
          code: string | null
          name: string
          legal_name: string
          tax_id: string
          kind: "Empresa" | "Persona natural" | "Entidad pública" | "Otro"
          status: "Prospecto" | "Activo" | "Inactivo" | "Perdido"
          industry: string
          email: string | null
          phone: string
          address: string
          city: string
          owner_id: string | null
          credit_limit_cents: number
          payment_terms_days: number
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          name: string
          legal_name?: string
          tax_id?: string
          kind?: "Empresa" | "Persona natural" | "Entidad pública" | "Otro"
          status?: "Prospecto" | "Activo" | "Inactivo" | "Perdido"
          industry?: string
          email?: string | null
          phone?: string
          address?: string
          city?: string
          owner_id?: string | null
          credit_limit_cents?: number
          payment_terms_days?: number
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          name?: string
          legal_name?: string
          tax_id?: string
          kind?: "Empresa" | "Persona natural" | "Entidad pública" | "Otro"
          status?: "Prospecto" | "Activo" | "Inactivo" | "Perdido"
          industry?: string
          email?: string | null
          phone?: string
          address?: string
          city?: string
          owner_id?: string | null
          credit_limit_cents?: number
          payment_terms_days?: number
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          id: string
          org_id: string
          code: string | null
          topic: string
          requester_id: string | null
          category: "Regulatorio" | "Normativo" | "Contractual" | "Laboral" | "Otro"
          advisor: string
          status: "Agendada" | "En curso" | "Resuelta" | "Cancelada"
          answer: string
          scheduled_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          topic: string
          requester_id?: string | null
          category?: "Regulatorio" | "Normativo" | "Contractual" | "Laboral" | "Otro"
          advisor?: string
          status?: "Agendada" | "En curso" | "Resuelta" | "Cancelada"
          answer?: string
          scheduled_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          topic?: string
          requester_id?: string | null
          category?: "Regulatorio" | "Normativo" | "Contractual" | "Laboral" | "Otro"
          advisor?: string
          status?: "Agendada" | "En curso" | "Resuelta" | "Cancelada"
          answer?: string
          scheduled_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_milestones: {
        Row: {
          id: string
          contract_id: string
          title: string
          due_on: string | null
          amount_cents: number
          completed_at: string | null
          position: number
        }
        Insert: {
          id?: string
          contract_id: string
          title: string
          due_on?: string | null
          amount_cents?: number
          completed_at?: string | null
          position?: number
        }
        Update: {
          id?: string
          contract_id?: string
          title?: string
          due_on?: string | null
          amount_cents?: number
          completed_at?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_milestones_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          id: string
          org_id: string
          code: string | null
          title: string
          kind: "Cliente" | "Proveedor" | "Laboral" | "Arrendamiento" | "Confidencialidad" | "Otro"
          status: "Borrador" | "Vigente" | "Por vencer" | "Vencido" | "Terminado"
          counterparty: string
          client_id: string | null
          employee_id: string | null
          document_id: string | null
          owner_id: string | null
          value_cents: number
          starts_on: string | null
          ends_on: string | null
          notice_days: number
          auto_renew: boolean
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          title: string
          kind?: "Cliente" | "Proveedor" | "Laboral" | "Arrendamiento" | "Confidencialidad" | "Otro"
          status?: "Borrador" | "Vigente" | "Por vencer" | "Vencido" | "Terminado"
          counterparty?: string
          client_id?: string | null
          employee_id?: string | null
          document_id?: string | null
          owner_id?: string | null
          value_cents?: number
          starts_on?: string | null
          ends_on?: string | null
          notice_days?: number
          auto_renew?: boolean
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          title?: string
          kind?: "Cliente" | "Proveedor" | "Laboral" | "Arrendamiento" | "Confidencialidad" | "Otro"
          status?: "Borrador" | "Vigente" | "Por vencer" | "Vencido" | "Terminado"
          counterparty?: string
          client_id?: string | null
          employee_id?: string | null
          document_id?: string | null
          owner_id?: string | null
          value_cents?: number
          starts_on?: string | null
          ends_on?: string | null
          notice_days?: number
          auto_renew?: boolean
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      contratacion_oferentes: {
        Row: {
          id: string
          org_id: string
          proceso_id: string
          name: string
          contacto: string | null
          estado: "invitado" | "presentado" | "habilitado" | "adjudicado" | "rechazado"
          valor_oferta: number
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          proceso_id: string
          name: string
          contacto?: string | null
          estado?: "invitado" | "presentado" | "habilitado" | "adjudicado" | "rechazado"
          valor_oferta?: number
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          proceso_id?: string
          name?: string
          contacto?: string | null
          estado?: "invitado" | "presentado" | "habilitado" | "adjudicado" | "rechazado"
          valor_oferta?: number
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratacion_oferentes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratacion_oferentes_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "contratacion_procesos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratacion_pliegos: {
        Row: {
          id: string
          org_id: string
          proceso_id: string
          name: string
          description: string
          obligatorio: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          proceso_id: string
          name: string
          description: string
          obligatorio?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          proceso_id?: string
          name?: string
          description?: string
          obligatorio?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratacion_pliegos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratacion_pliegos_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "contratacion_procesos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratacion_procesos: {
        Row: {
          id: string
          org_id: string
          numero: string
          objeto: string
          modalidad: "licitacion" | "seleccion_abreviada" | "minima_cuantia" | "contratacion_directa"
          estado: "borrador" | "publicado" | "en_evaluacion" | "adjudicado" | "cancelado"
          valor: number
          publicado_on: string | null
          cierre_on: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          numero: string
          objeto: string
          modalidad?: "licitacion" | "seleccion_abreviada" | "minima_cuantia" | "contratacion_directa"
          estado?: "borrador" | "publicado" | "en_evaluacion" | "adjudicado" | "cancelado"
          valor?: number
          publicado_on?: string | null
          cierre_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          numero?: string
          objeto?: string
          modalidad?: "licitacion" | "seleccion_abreviada" | "minima_cuantia" | "contratacion_directa"
          estado?: "borrador" | "publicado" | "en_evaluacion" | "adjudicado" | "cancelado"
          valor?: number
          publicado_on?: string | null
          cierre_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratacion_procesos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          id: string
          course_id: string
          employee_id: string
          status: "Inscrito" | "En curso" | "Aprobado" | "Reprobado" | "Cancelado"
          completed_on: string | null
          score: number | null
          expires_on: string | null
          certificate_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          employee_id: string
          status?: "Inscrito" | "En curso" | "Aprobado" | "Reprobado" | "Cancelado"
          completed_on?: string | null
          score?: number | null
          expires_on?: string | null
          certificate_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          employee_id?: string
          status?: "Inscrito" | "En curso" | "Aprobado" | "Reprobado" | "Cancelado"
          completed_on?: string | null
          score?: number | null
          expires_on?: string | null
          certificate_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          id: string
          org_id: string
          name: string
          category: string
          duration_hours: number | null
          created_at: string
          updated_at: string
          code: string | null
          mode: "Presencial" | "Virtual" | "Mixto"
          provider: string
          instructor: string
          cost_cents: number
          seats: number | null
          validity_months: number | null
          is_mandatory: boolean
          starts_on: string | null
          ends_on: string | null
          description: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          category?: string
          duration_hours?: number | null
          created_at?: string
          updated_at?: string
          code?: string | null
          mode?: "Presencial" | "Virtual" | "Mixto"
          provider?: string
          instructor?: string
          cost_cents?: number
          seats?: number | null
          validity_months?: number | null
          is_mandatory?: boolean
          starts_on?: string | null
          ends_on?: string | null
          description?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          category?: string
          duration_hours?: number | null
          created_at?: string
          updated_at?: string
          code?: string | null
          mode?: "Presencial" | "Virtual" | "Mixto"
          provider?: string
          instructor?: string
          cost_cents?: number
          seats?: number | null
          validity_months?: number | null
          is_mandatory?: boolean
          starts_on?: string | null
          ends_on?: string | null
          description?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_cycles: {
        Row: {
          id: string
          org_id: string
          lot_id: string
          crop: string
          variety: string
          status: "Planificado" | "Sembrado" | "En crecimiento" | "Cosechado" | "Perdido"
          hectares: number
          sown_on: string | null
          expected_harvest_on: string | null
          expected_yield_kg: number | null
          input_cost_cents: number
          responsible_id: string | null
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          lot_id: string
          crop: string
          variety?: string
          status?: "Planificado" | "Sembrado" | "En crecimiento" | "Cosechado" | "Perdido"
          hectares?: number
          sown_on?: string | null
          expected_harvest_on?: string | null
          expected_yield_kg?: number | null
          input_cost_cents?: number
          responsible_id?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          lot_id?: string
          crop?: string
          variety?: string
          status?: "Planificado" | "Sembrado" | "En crecimiento" | "Cosechado" | "Perdido"
          hectares?: number
          sown_on?: string | null
          expected_harvest_on?: string | null
          expected_yield_kg?: number | null
          input_cost_cents?: number
          responsible_id?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_cycles_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "farm_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_cycles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_cycles_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_treatments: {
        Row: {
          id: string
          cycle_id: string
          kind: "Fertilización" | "Herbicida" | "Fungicida" | "Insecticida" | "Foliar" | "Otro"
          product: string
          active_ingredient: string
          dose: string
          applied_on: string
          responsible_id: string | null
          withholding_days: number | null
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          cycle_id: string
          kind?: "Fertilización" | "Herbicida" | "Fungicida" | "Insecticida" | "Foliar" | "Otro"
          product: string
          active_ingredient?: string
          dose?: string
          applied_on?: string
          responsible_id?: string | null
          withholding_days?: number | null
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          cycle_id?: string
          kind?: "Fertilización" | "Herbicida" | "Fungicida" | "Insecticida" | "Foliar" | "Otro"
          product?: string
          active_ingredient?: string
          dose?: string
          applied_on?: string
          responsible_id?: string | null
          withholding_days?: number | null
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crop_treatments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "crop_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_treatments_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_routes: {
        Row: {
          id: string
          org_id: string
          origin: string
          destination: string
          vehicle_id: string | null
          driver_id: string | null
          distance_km: number | null
          scheduled_on: string
          status: "Planificada" | "En curso" | "Completada" | "Cancelada"
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          origin?: string
          destination: string
          vehicle_id?: string | null
          driver_id?: string | null
          distance_km?: number | null
          scheduled_on?: string
          status?: "Planificada" | "En curso" | "Completada" | "Cancelada"
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          origin?: string
          destination?: string
          vehicle_id?: string | null
          driver_id?: string | null
          distance_km?: number | null
          scheduled_on?: string
          status?: "Planificada" | "En curso" | "Completada" | "Cancelada"
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_routes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_requests: {
        Row: {
          id: string
          name: string
          email: string
          company: string | null
          message: string
          source: string
          status: "nuevo" | "contactado" | "descartado"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          company?: string | null
          message: string
          source?: string
          status?: "nuevo" | "contactado" | "descartado"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          company?: string | null
          message?: string
          source?: string
          status?: "nuevo" | "contactado" | "descartado"
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      dental_chart_teeth: {
        Row: {
          id: string
          chart_id: string
          tooth: number
          surface: "Oclusal" | "Mesial" | "Distal" | "Vestibular" | "Lingual" | "Palatina" | null
          condition: "Sano" | "Caries" | "Obturado" | "Corona" | "Ausente" | "Implante" | "Endodoncia" | "Fracturado" | "Sellante" | "Extracción indicada" | "Protesis" | "Ortodoncia"
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          chart_id: string
          tooth: number
          surface?: "Oclusal" | "Mesial" | "Distal" | "Vestibular" | "Lingual" | "Palatina" | null
          condition: "Sano" | "Caries" | "Obturado" | "Corona" | "Ausente" | "Implante" | "Endodoncia" | "Fracturado" | "Sellante" | "Extracción indicada" | "Protesis" | "Ortodoncia"
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          chart_id?: string
          tooth?: number
          surface?: "Oclusal" | "Mesial" | "Distal" | "Vestibular" | "Lingual" | "Palatina" | null
          condition?: "Sano" | "Caries" | "Obturado" | "Corona" | "Ausente" | "Implante" | "Endodoncia" | "Fracturado" | "Sellante" | "Extracción indicada" | "Protesis" | "Ortodoncia"
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dental_chart_teeth_chart_id_fkey"
            columns: ["chart_id"]
            isOneToOne: false
            referencedRelation: "dental_charts"
            referencedColumns: ["id"]
          },
        ]
      }
      dental_charts: {
        Row: {
          id: string
          org_id: string
          patient_id: string
          professional_id: string | null
          charted_on: string
          kind: "Inicial" | "Control" | "Final"
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          patient_id: string
          professional_id?: string | null
          charted_on?: string
          kind?: "Inicial" | "Control" | "Final"
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          patient_id?: string
          professional_id?: string | null
          charted_on?: string
          kind?: "Inicial" | "Control" | "Final"
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dental_charts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dental_charts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dental_charts_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      dental_lab_orders: {
        Row: {
          id: string
          org_id: string
          patient_id: string
          plan_item_id: string | null
          code: string | null
          lab_name: string
          work_type: "Corona" | "Puente" | "Prótesis total" | "Prótesis parcial" | "Incrustación" | "Carilla" | "Férula" | "Placa" | "Otro"
          tooth: number | null
          sent_on: string
          due_on: string | null
          received_on: string | null
          status: "Enviado" | "En proceso" | "Recibido" | "Reproceso" | "Cancelado"
          cost_cents: number
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          patient_id: string
          plan_item_id?: string | null
          code?: string | null
          lab_name?: string
          work_type?: "Corona" | "Puente" | "Prótesis total" | "Prótesis parcial" | "Incrustación" | "Carilla" | "Férula" | "Placa" | "Otro"
          tooth?: number | null
          sent_on?: string
          due_on?: string | null
          received_on?: string | null
          status?: "Enviado" | "En proceso" | "Recibido" | "Reproceso" | "Cancelado"
          cost_cents?: number
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          patient_id?: string
          plan_item_id?: string | null
          code?: string | null
          lab_name?: string
          work_type?: "Corona" | "Puente" | "Prótesis total" | "Prótesis parcial" | "Incrustación" | "Carilla" | "Férula" | "Placa" | "Otro"
          tooth?: number | null
          sent_on?: string
          due_on?: string | null
          received_on?: string | null
          status?: "Enviado" | "En proceso" | "Recibido" | "Reproceso" | "Cancelado"
          cost_cents?: number
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dental_lab_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dental_lab_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dental_lab_orders_plan_item_id_fkey"
            columns: ["plan_item_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_items"
            referencedColumns: ["id"]
          },
        ]
      }
      departures: {
        Row: {
          id: string
          org_id: string
          employee_id: string | null
          full_name: string
          department: string
          reason: "Renuncia voluntaria" | "Mutuo acuerdo" | "Vencimiento contrato" | "Terminación con justa causa" | "Otro"
          departed_on: string
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          employee_id?: string | null
          full_name: string
          department?: string
          reason?: "Renuncia voluntaria" | "Mutuo acuerdo" | "Vencimiento contrato" | "Terminación con justa causa" | "Otro"
          departed_on: string
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          employee_id?: string | null
          full_name?: string
          department?: string
          reason?: "Renuncia voluntaria" | "Mutuo acuerdo" | "Vencimiento contrato" | "Terminación con justa causa" | "Otro"
          departed_on?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departures_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departures_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dian_documents: {
        Row: {
          id: string
          org_id: string
          invoice_id: string
          invoice_code: string
          client_name: string
          total_cents: number
          ambiente: string
          status: "procesando" | "aceptada" | "rechazada" | "pendiente"
          cufe: string
          xml_content: string
          error: string
          sent_at: string
          responded_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          invoice_id: string
          invoice_code?: string
          client_name?: string
          total_cents?: number
          ambiente?: string
          status?: "procesando" | "aceptada" | "rechazada" | "pendiente"
          cufe?: string
          xml_content?: string
          error?: string
          sent_at?: string
          responded_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          invoice_id?: string
          invoice_code?: string
          client_name?: string
          total_cents?: number
          ambiente?: string
          status?: "procesando" | "aceptada" | "rechazada" | "pendiente"
          cufe?: string
          xml_content?: string
          error?: string
          sent_at?: string
          responded_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dian_documents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dian_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dian_events: {
        Row: {
          id: string
          org_id: string
          dian_document_id: string
          kind: "envio" | "aceptacion" | "rechazo" | "consulta" | "error"
          message: string
          response_raw: string
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          dian_document_id: string
          kind: "envio" | "aceptacion" | "rechazo" | "consulta" | "error"
          message?: string
          response_raw?: string
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          dian_document_id?: string
          kind?: "envio" | "aceptacion" | "rechazo" | "consulta" | "error"
          message?: string
          response_raw?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dian_events_dian_document_id_fkey"
            columns: ["dian_document_id"]
            isOneToOne: false
            referencedRelation: "dian_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dian_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dining_tables: {
        Row: {
          id: string
          org_id: string
          label: string
          zone: string
          seats: number
          status: "Libre" | "Ocupada" | "Reservada" | "Fuera de servicio"
          created_at: string
          updated_at: string
          deleted_at: string | null
          site_id: string | null
        }
        Insert: {
          id?: string
          org_id: string
          label: string
          zone?: string
          seats?: number
          status?: "Libre" | "Ocupada" | "Reservada" | "Fuera de servicio"
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          site_id?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          label?: string
          zone?: string
          seats?: number
          status?: "Libre" | "Ocupada" | "Reservada" | "Fuera de servicio"
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dining_tables_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_tables_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_coupons: {
        Row: {
          id: string
          org_id: string
          code: string
          percent_off: number | null
          amount_off_cents: number | null
          min_total_cents: number
          max_uses: number | null
          used_count: number
          starts_on: string | null
          expires_on: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          code: string
          percent_off?: number | null
          amount_off_cents?: number | null
          min_total_cents?: number
          max_uses?: number | null
          used_count?: number
          starts_on?: string | null
          expires_on?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          code?: string
          percent_off?: number | null
          amount_off_cents?: number | null
          min_total_cents?: number
          max_uses?: number | null
          used_count?: number
          starts_on?: string | null
          expires_on?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_coupons_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          id: string
          org_id: string
          document_id: string
          chunk_index: number
          content: string
          content_hash: string
          token_count: number
          embedding: unknown | null
          embedding_model: string | null
          status: "pending" | "ready" | "failed" | "stale" | "deleted"
          error: string | null
          metadata: Json
          created_at: string
          updated_at: string
          content_tsv: unknown | null
        }
        Insert: {
          id?: string
          org_id: string
          document_id: string
          chunk_index: number
          content: string
          content_hash: string
          token_count?: number
          embedding?: unknown | null
          embedding_model?: string | null
          status?: "pending" | "ready" | "failed" | "stale" | "deleted"
          error?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          document_id?: string
          chunk_index?: number
          content?: string
          content_hash?: string
          token_count?: number
          embedding?: unknown | null
          embedding_model?: string | null
          status?: "pending" | "ready" | "failed" | "stale" | "deleted"
          error?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          id: string
          org_id: string
          key: string
          name: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          key: string
          name: string
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          key?: string
          name?: string
          position?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_shares: {
        Row: {
          id: string
          document_id: string
          employee_id: string | null
          email: string | null
          access: "Propietario" | "Puede editar" | "Puede ver"
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          employee_id?: string | null
          email?: string | null
          access?: "Propietario" | "Puede editar" | "Puede ver"
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          employee_id?: string | null
          email?: string | null
          access?: "Propietario" | "Puede editar" | "Puede ver"
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_shares_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_shares_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          id: string
          org_id: string
          code: string | null
          folder_id: string | null
          name: string
          kind: "Contrato" | "Política" | "Acta" | "Plan" | "Manual" | "Anexo" | "Otro"
          department: string
          owner_id: string | null
          status: "Vigente" | "Borrador" | "Archivado" | "Vencido"
          tags: string[]
          storage_path: string | null
          mime_type: string | null
          size_bytes: number | null
          ai_verdict: string | null
          ai_checked_at: string | null
          expires_on: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          ai_status: "Correcto" | "Revisar" | "Incompleto" | null
          visibility: "Privada" | "Pública"
          uploaded_by: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          folder_id?: string | null
          name: string
          kind?: "Contrato" | "Política" | "Acta" | "Plan" | "Manual" | "Anexo" | "Otro"
          department?: string
          owner_id?: string | null
          status?: "Vigente" | "Borrador" | "Archivado" | "Vencido"
          tags?: string[]
          storage_path?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          ai_verdict?: string | null
          ai_checked_at?: string | null
          expires_on?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          ai_status?: "Correcto" | "Revisar" | "Incompleto" | null
          visibility?: "Privada" | "Pública"
          uploaded_by?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          folder_id?: string | null
          name?: string
          kind?: "Contrato" | "Política" | "Acta" | "Plan" | "Manual" | "Anexo" | "Otro"
          department?: string
          owner_id?: string | null
          status?: "Vigente" | "Borrador" | "Archivado" | "Vencido"
          tags?: string[]
          storage_path?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          ai_verdict?: string | null
          ai_checked_at?: string | null
          expires_on?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          ai_status?: "Correcto" | "Revisar" | "Incompleto" | null
          visibility?: "Privada" | "Pública"
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          id: string
          org_id: string
          donor_id: string | null
          donor_name: string | null
          kind: "monetaria" | "especie" | "tiempo"
          amount_cents: number | null
          description: string | null
          donated_on: string
          campaign: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          donor_id?: string | null
          donor_name?: string | null
          kind?: "monetaria" | "especie" | "tiempo"
          amount_cents?: number | null
          description?: string | null
          donated_on?: string
          campaign?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          donor_id?: string | null
          donor_name?: string | null
          kind?: "monetaria" | "especie" | "tiempo"
          amount_cents?: number | null
          description?: string | null
          donated_on?: string
          campaign?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donations_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      donors: {
        Row: {
          id: string
          org_id: string
          name: string
          email: string | null
          phone: string | null
          kind: "persona" | "empresa"
          status: "activo" | "inactivo"
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          email?: string | null
          phone?: string | null
          kind?: "persona" | "empresa"
          status?: "activo" | "inactivo"
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          kind?: "persona" | "empresa"
          status?: "activo" | "inactivo"
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_events: {
        Row: {
          id: string
          employee_id: string
          occurred_on: string
          event: string
          tag: "Ingreso" | "Ascenso" | "Traslado" | "Reconocimiento" | "Salida" | "Otro"
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          occurred_on: string
          event: string
          tag?: "Ingreso" | "Ascenso" | "Traslado" | "Reconocimiento" | "Salida" | "Otro"
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          occurred_on?: string
          event?: string
          tag?: "Ingreso" | "Ascenso" | "Traslado" | "Reconocimiento" | "Salida" | "Otro"
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_goals: {
        Row: {
          id: string
          org_id: string
          employee_id: string
          cycle_id: string | null
          title: string
          detail: string
          metric: string
          target_value: number | null
          current_value: number
          weight: number
          status: "En progreso" | "Cumplido" | "No cumplido" | "Cancelado"
          due_on: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          employee_id: string
          cycle_id?: string | null
          title: string
          detail?: string
          metric?: string
          target_value?: number | null
          current_value?: number
          weight?: number
          status?: "En progreso" | "Cumplido" | "No cumplido" | "Cancelado"
          due_on?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          employee_id?: string
          cycle_id?: string | null
          title?: string
          detail?: string
          metric?: string
          target_value?: number | null
          current_value?: number
          weight?: number
          status?: "En progreso" | "Cumplido" | "No cumplido" | "Cancelado"
          due_on?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_goals_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "review_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_goals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_skills: {
        Row: {
          id: string
          employee_id: string
          skill: string
          level: number
        }
        Insert: {
          id?: string
          employee_id: string
          skill: string
          level: number
        }
        Update: {
          id?: string
          employee_id?: string
          skill?: string
          level?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_skills_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          id: string
          org_id: string
          code: string | null
          user_id: string | null
          full_name: string
          email: string | null
          position: string
          department: string
          location: string
          status: "Activo" | "Inactivo" | "Onboarding" | "En licencia" | "Salida"
          employment_type: "Tiempo completo" | "Medio tiempo" | "Contrato" | "Prácticas"
          intended_role: string
          manager_id: string | null
          hired_on: string | null
          ended_on: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          site_id: string | null
          tax_id: string
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          user_id?: string | null
          full_name: string
          email?: string | null
          position?: string
          department?: string
          location?: string
          status?: "Activo" | "Inactivo" | "Onboarding" | "En licencia" | "Salida"
          employment_type?: "Tiempo completo" | "Medio tiempo" | "Contrato" | "Prácticas"
          intended_role?: string
          manager_id?: string | null
          hired_on?: string | null
          ended_on?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          site_id?: string | null
          tax_id?: string
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          user_id?: string | null
          full_name?: string
          email?: string | null
          position?: string
          department?: string
          location?: string
          status?: "Activo" | "Inactivo" | "Onboarding" | "En licencia" | "Salida"
          employment_type?: "Tiempo completo" | "Medio tiempo" | "Contrato" | "Prácticas"
          intended_role?: string
          manager_id?: string | null
          hired_on?: string | null
          ended_on?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          site_id?: string | null
          tax_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_intended_role_fkey"
            columns: ["org_id", "intended_role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["org_id", "key"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          id: string
          org_id: string
          code: string | null
          employee_id: string
          evaluator_id: string | null
          period_label: string
          score: number | null
          objectives_done: number
          objectives_total: number
          status: "Pendiente" | "En revisión" | "Completada" | "Calibrada"
          evaluated_on: string | null
          created_at: string
          updated_at: string
          cycle_id: string | null
          strengths: string
          improvements: string
          comments: string
          submitted_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          employee_id: string
          evaluator_id?: string | null
          period_label?: string
          score?: number | null
          objectives_done?: number
          objectives_total?: number
          status?: "Pendiente" | "En revisión" | "Completada" | "Calibrada"
          evaluated_on?: string | null
          created_at?: string
          updated_at?: string
          cycle_id?: string | null
          strengths?: string
          improvements?: string
          comments?: string
          submitted_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          employee_id?: string
          evaluator_id?: string | null
          period_label?: string
          score?: number | null
          objectives_done?: number
          objectives_total?: number
          status?: "Pendiente" | "En revisión" | "Completada" | "Calibrada"
          evaluated_on?: string | null
          created_at?: string
          updated_at?: string
          cycle_id?: string | null
          strengths?: string
          improvements?: string
          comments?: string
          submitted_at?: string | null
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "review_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_inputs: {
        Row: {
          id: string
          org_id: string
          name: string
          kind: "Semilla" | "Fertilizante" | "Agroquímico" | "Biocontrol" | "Otro"
          stock_qty: number
          unit: string
          supplier: string
          unit_cost_cents: number
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          kind?: "Semilla" | "Fertilizante" | "Agroquímico" | "Biocontrol" | "Otro"
          stock_qty?: number
          unit?: string
          supplier?: string
          unit_cost_cents?: number
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          kind?: "Semilla" | "Fertilizante" | "Agroquímico" | "Biocontrol" | "Otro"
          stock_qty?: number
          unit?: string
          supplier?: string
          unit_cost_cents?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_inputs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_lots: {
        Row: {
          id: string
          org_id: string
          code: string | null
          name: string
          farm: string
          hectares: number
          soil_type: string
          location: string
          status: "Disponible" | "Sembrado" | "En cosecha" | "En descanso"
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          name: string
          farm?: string
          hectares?: number
          soil_type?: string
          location?: string
          status?: "Disponible" | "Sembrado" | "En cosecha" | "En descanso"
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          name?: string
          farm?: string
          hectares?: number
          soil_type?: string
          location?: string
          status?: "Disponible" | "Sembrado" | "En cosecha" | "En descanso"
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_lots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_machinery: {
        Row: {
          id: string
          org_id: string
          name: string
          kind: "Tractor" | "Implemento" | "Cosechadora" | "Riego" | "Otro"
          serial_no: string
          status: "Operativa" | "En mantenimiento" | "Fuera de servicio"
          hours_used: number
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          kind?: "Tractor" | "Implemento" | "Cosechadora" | "Riego" | "Otro"
          serial_no?: string
          status?: "Operativa" | "En mantenimiento" | "Fuera de servicio"
          hours_used?: number
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          kind?: "Tractor" | "Implemento" | "Cosechadora" | "Riego" | "Otro"
          serial_no?: string
          status?: "Operativa" | "En mantenimiento" | "Fuera de servicio"
          hours_used?: number
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_machinery_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_bookings: {
        Row: {
          id: string
          class_id: string
          member_id: string
          status: "Reservada" | "En espera" | "Asistió" | "No asistió" | "Cancelada"
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          member_id: string
          status?: "Reservada" | "En espera" | "Asistió" | "No asistió" | "Cancelada"
          created_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          member_id?: string
          status?: "Reservada" | "En espera" | "Asistió" | "No asistió" | "Cancelada"
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fitness_bookings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "fitness_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitness_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "fitness_members"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_checkins: {
        Row: {
          id: string
          member_id: string
          class_id: string | null
          entered_at: string
          method: "Manual" | "Documento" | "Código" | "Huella"
          created_at: string
        }
        Insert: {
          id?: string
          member_id: string
          class_id?: string | null
          entered_at?: string
          method?: "Manual" | "Documento" | "Código" | "Huella"
          created_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          class_id?: string | null
          entered_at?: string
          method?: "Manual" | "Documento" | "Código" | "Huella"
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fitness_checkins_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "fitness_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitness_checkins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "fitness_members"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_classes: {
        Row: {
          id: string
          org_id: string
          name: string
          instructor_id: string | null
          starts_at: string
          duration_min: number
          capacity: number
          room: string
          status: "Programada" | "En curso" | "Dictada" | "Cancelada"
          notes: string
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          instructor_id?: string | null
          starts_at: string
          duration_min?: number
          capacity?: number
          room?: string
          status?: "Programada" | "En curso" | "Dictada" | "Cancelada"
          notes?: string
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          instructor_id?: string | null
          starts_at?: string
          duration_min?: number
          capacity?: number
          room?: string
          status?: "Programada" | "En curso" | "Dictada" | "Cancelada"
          notes?: string
          created_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fitness_classes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitness_classes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_members: {
        Row: {
          id: string
          org_id: string
          code: string | null
          full_name: string
          document_id: string
          email: string | null
          phone: string
          birth_date: string | null
          status: "Activo" | "Inactivo" | "Suspendido" | "Retirado"
          joined_on: string
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          full_name: string
          document_id?: string
          email?: string | null
          phone?: string
          birth_date?: string | null
          status?: "Activo" | "Inactivo" | "Suspendido" | "Retirado"
          joined_on?: string
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          full_name?: string
          document_id?: string
          email?: string | null
          phone?: string
          birth_date?: string | null
          status?: "Activo" | "Inactivo" | "Suspendido" | "Retirado"
          joined_on?: string
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fitness_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_plans: {
        Row: {
          id: string
          org_id: string
          name: string
          description: string
          price_cents: number
          billing: "Mensual" | "Trimestral" | "Semestral" | "Anual" | "Bono" | "Sesión"
          credits: number | null
          duration_days: number
          active: boolean
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          description?: string
          price_cents?: number
          billing?: "Mensual" | "Trimestral" | "Semestral" | "Anual" | "Bono" | "Sesión"
          credits?: number | null
          duration_days?: number
          active?: boolean
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          description?: string
          price_cents?: number
          billing?: "Mensual" | "Trimestral" | "Semestral" | "Anual" | "Bono" | "Sesión"
          credits?: number | null
          duration_days?: number
          active?: boolean
          created_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fitness_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_subscriptions: {
        Row: {
          id: string
          member_id: string
          plan_id: string | null
          plan_name: string
          price_cents: number
          starts_on: string
          ends_on: string
          credits_left: number | null
          status: "Vigente" | "Vencida" | "Cancelada" | "Congelada"
          paid: boolean
          invoice_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          member_id: string
          plan_id?: string | null
          plan_name: string
          price_cents?: number
          starts_on?: string
          ends_on: string
          credits_left?: number | null
          status?: "Vigente" | "Vencida" | "Cancelada" | "Congelada"
          paid?: boolean
          invoice_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          plan_id?: string | null
          plan_name?: string
          price_cents?: number
          starts_on?: string
          ends_on?: string
          credits_left?: number | null
          status?: "Vigente" | "Vencida" | "Cancelada" | "Congelada"
          paid?: boolean
          invoice_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fitness_subscriptions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitness_subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "fitness_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitness_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "fitness_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_logs: {
        Row: {
          id: string
          vehicle_id: string
          liters: number
          cost_cents: number
          odometer_km: number | null
          station: string
          driver_id: string | null
          filled_on: string
          created_at: string
        }
        Insert: {
          id?: string
          vehicle_id: string
          liters: number
          cost_cents?: number
          odometer_km?: number | null
          station?: string
          driver_id?: string | null
          filled_on?: string
          created_at?: string
        }
        Update: {
          id?: string
          vehicle_id?: string
          liters?: number
          cost_cents?: number
          odometer_km?: number | null
          station?: string
          driver_id?: string | null
          filled_on?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_accounts: {
        Row: {
          code: string
          name: string
          nature: "Débito" | "Crédito"
          kind: "Activo" | "Pasivo" | "Patrimonio" | "Ingresos" | "Gastos" | "Costos"
          parent_code: string | null
          is_active: boolean
        }
        Insert: {
          code: string
          name: string
          nature: "Débito" | "Crédito"
          kind: "Activo" | "Pasivo" | "Patrimonio" | "Ingresos" | "Gastos" | "Costos"
          parent_code?: string | null
          is_active?: boolean
        }
        Update: {
          code?: string
          name?: string
          nature?: "Débito" | "Crédito"
          kind?: "Activo" | "Pasivo" | "Patrimonio" | "Ingresos" | "Gastos" | "Costos"
          parent_code?: string | null
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "gl_accounts_parent_code_fkey"
            columns: ["parent_code"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["code"]
          },
        ]
      }
      guard_posts: {
        Row: {
          id: string
          org_id: string
          name: string
          client_id: string | null
          address: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          client_id?: string | null
          address?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          client_id?: string | null
          address?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guard_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_posts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      harvests: {
        Row: {
          id: string
          cycle_id: string
          quantity_kg: number
          quality: string
          price_per_kg_cents: number
          buyer: string
          harvested_on: string
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          cycle_id: string
          quantity_kg: number
          quality?: string
          price_per_kg_cents?: number
          buyer?: string
          harvested_on?: string
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          cycle_id?: string
          quantity_kg?: number
          quality?: string
          price_per_kg_cents?: number
          buyer?: string
          harvested_on?: string
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "harvests_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "crop_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_rooms: {
        Row: {
          id: string
          org_id: string
          number: string
          kind: "Sencilla" | "Doble" | "Triple" | "Suite" | "Familiar"
          status: "Disponible" | "Ocupada" | "Limpieza" | "Mantenimiento" | "Bloqueada"
          floor: number | null
          capacity: number
          rate_cents: number
          amenities: string
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
          site_id: string | null
        }
        Insert: {
          id?: string
          org_id: string
          number: string
          kind?: "Sencilla" | "Doble" | "Triple" | "Suite" | "Familiar"
          status?: "Disponible" | "Ocupada" | "Limpieza" | "Mantenimiento" | "Bloqueada"
          floor?: number | null
          capacity?: number
          rate_cents?: number
          amenities?: string
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          site_id?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          number?: string
          kind?: "Sencilla" | "Doble" | "Triple" | "Suite" | "Familiar"
          status?: "Disponible" | "Ocupada" | "Limpieza" | "Mantenimiento" | "Bloqueada"
          floor?: number | null
          capacity?: number
          rate_cents?: number
          amenities?: string
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_rooms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_rooms_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_season_rates: {
        Row: {
          id: string
          season_id: string
          kind: "Sencilla" | "Doble" | "Triple" | "Suite" | "Familiar"
          rate_cents: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          season_id: string
          kind: "Sencilla" | "Doble" | "Triple" | "Suite" | "Familiar"
          rate_cents?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          season_id?: string
          kind?: "Sencilla" | "Doble" | "Triple" | "Suite" | "Familiar"
          rate_cents?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_season_rates_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "hotel_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_seasons: {
        Row: {
          id: string
          org_id: string
          name: string
          starts_on: string
          ends_on: string
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          starts_on: string
          ends_on: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          starts_on?: string
          ends_on?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_seasons_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hseq_checklist_items: {
        Row: {
          id: string
          hseq_report_id: string
          label: string
          is_done: boolean
          position: number
        }
        Insert: {
          id?: string
          hseq_report_id: string
          label: string
          is_done?: boolean
          position?: number
        }
        Update: {
          id?: string
          hseq_report_id?: string
          label?: string
          is_done?: boolean
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "hseq_checklist_items_hseq_report_id_fkey"
            columns: ["hseq_report_id"]
            isOneToOne: false
            referencedRelation: "hseq_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      hseq_reports: {
        Row: {
          id: string
          org_id: string
          code: string | null
          category: "Seguridad" | "Calidad" | "Ambiente"
          kind: "Incidente" | "Permiso" | "Hallazgo" | "Auditoría"
          status: "Pendiente" | "En curso" | "Cerrado"
          priority: "Alta" | "Media" | "Baja"
          severity: "Crítica" | "Alta" | "Media" | "Baja"
          area: string
          project_id: string | null
          location: string
          amount_cents: number
          owner_id: string | null
          notes: string
          reported_on: string
          due_on: string | null
          closed_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          category: "Seguridad" | "Calidad" | "Ambiente"
          kind?: "Incidente" | "Permiso" | "Hallazgo" | "Auditoría"
          status?: "Pendiente" | "En curso" | "Cerrado"
          priority?: "Alta" | "Media" | "Baja"
          severity?: "Crítica" | "Alta" | "Media" | "Baja"
          area?: string
          project_id?: string | null
          location?: string
          amount_cents?: number
          owner_id?: string | null
          notes?: string
          reported_on?: string
          due_on?: string | null
          closed_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          category?: "Seguridad" | "Calidad" | "Ambiente"
          kind?: "Incidente" | "Permiso" | "Hallazgo" | "Auditoría"
          status?: "Pendiente" | "En curso" | "Cerrado"
          priority?: "Alta" | "Media" | "Baja"
          severity?: "Crítica" | "Alta" | "Media" | "Baja"
          area?: string
          project_id?: string | null
          location?: string
          amount_cents?: number
          owner_id?: string | null
          notes?: string
          reported_on?: string
          due_on?: string | null
          closed_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hseq_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hseq_reports_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hseq_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      hseq_updates: {
        Row: {
          id: string
          hseq_report_id: string
          actor_id: string | null
          note: string
          occurred_at: string
        }
        Insert: {
          id?: string
          hseq_report_id: string
          actor_id?: string | null
          note: string
          occurred_at?: string
        }
        Update: {
          id?: string
          hseq_report_id?: string
          actor_id?: string | null
          note?: string
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hseq_updates_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hseq_updates_hseq_report_id_fkey"
            columns: ["hseq_report_id"]
            isOneToOne: false
            referencedRelation: "hseq_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          id: string
          org_id: string
          kind: "pagos" | "whatsapp" | "dian"
          provider: "wompi" | "payu" | "epayco" | "stripe" | "whatsapp" | "dian_demo" | "otro"
          enabled: boolean
          config: Json
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          kind: "pagos" | "whatsapp" | "dian"
          provider?: "wompi" | "payu" | "epayco" | "stripe" | "whatsapp" | "dian_demo" | "otro"
          enabled?: boolean
          config?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          kind?: "pagos" | "whatsapp" | "dian"
          provider?: "wompi" | "payu" | "epayco" | "stripe" | "whatsapp" | "dian_demo" | "otro"
          enabled?: boolean
          config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_assets: {
        Row: {
          id: string
          org_id: string
          code: string | null
          name: string
          category: "Cómputo" | "Monitor" | "Móvil" | "Tablet" | "Periférico" | "Mobiliario" | "Herramientas" | "Vehículos" | "Electrónica" | "Otro"
          employee_id: string | null
          serial: string
          status: "Asignado" | "Disponible" | "Mantenimiento" | "Baja"
          acquired_on: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          site_id: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          name: string
          category?: "Cómputo" | "Monitor" | "Móvil" | "Tablet" | "Periférico" | "Mobiliario" | "Herramientas" | "Vehículos" | "Electrónica" | "Otro"
          employee_id?: string | null
          serial?: string
          status?: "Asignado" | "Disponible" | "Mantenimiento" | "Baja"
          acquired_on?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          site_id?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          name?: string
          category?: "Cómputo" | "Monitor" | "Móvil" | "Tablet" | "Periférico" | "Mobiliario" | "Herramientas" | "Vehículos" | "Electrónica" | "Otro"
          employee_id?: string | null
          serial?: string
          status?: "Asignado" | "Disponible" | "Mantenimiento" | "Baja"
          acquired_on?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_assets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_assets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_orders: {
        Row: {
          id: string
          org_id: string
          code: string | null
          item: string
          supplier: string
          quantity: number
          est_price_cents: number
          requested_by_id: string | null
          status: "Solicitado" | "Aprobado" | "En tránsito" | "Facturado" | "Cancelado"
          ordered_on: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          item: string
          supplier?: string
          quantity: number
          est_price_cents?: number
          requested_by_id?: string | null
          status?: "Solicitado" | "Aprobado" | "En tránsito" | "Facturado" | "Cancelado"
          ordered_on?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          item?: string
          supplier?: string
          quantity?: number
          est_price_cents?: number
          requested_by_id?: string | null
          status?: "Solicitado" | "Aprobado" | "En tránsito" | "Facturado" | "Cancelado"
          ordered_on?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_orders_requested_by_id_fkey"
            columns: ["requested_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          id: string
          org_id: string
          email: string
          role: string
          token_hash: string
          invited_by: string | null
          expires_at: string
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          email: string
          role: string
          token_hash: string
          invited_by?: string | null
          expires_at: string
          accepted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          email?: string
          role?: string
          token_hash?: string
          invited_by?: string | null
          expires_at?: string
          accepted_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_role_fkey"
            columns: ["org_id", "role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["org_id", "key"]
          },
        ]
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          product_id: string | null
          description: string
          quantity: number
          unit_price_cents: number
          tax_rate: number
          position: number
        }
        Insert: {
          id?: string
          invoice_id: string
          product_id?: string | null
          description: string
          quantity?: number
          unit_price_cents?: number
          tax_rate?: number
          position?: number
        }
        Update: {
          id?: string
          invoice_id?: string
          product_id?: string | null
          description?: string
          quantity?: number
          unit_price_cents?: number
          tax_rate?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          id: string
          invoice_id: string
          amount_cents: number
          method: "Transferencia" | "Efectivo" | "Tarjeta" | "Cheque" | "Otro"
          reference: string
          paid_on: string
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          amount_cents: number
          method?: "Transferencia" | "Efectivo" | "Tarjeta" | "Cheque" | "Otro"
          reference?: string
          paid_on?: string
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          amount_cents?: number
          method?: "Transferencia" | "Efectivo" | "Tarjeta" | "Cheque" | "Otro"
          reference?: string
          paid_on?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          id: string
          org_id: string
          code: string | null
          client_id: string | null
          client_name: string
          quote_id: string | null
          project_id: string | null
          status: "Borrador" | "Emitida" | "Pagada" | "Vencida" | "Anulada"
          issued_on: string
          due_on: string | null
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          paid_cents: number
          currency: string
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          client_id?: string | null
          client_name?: string
          quote_id?: string | null
          project_id?: string | null
          status?: "Borrador" | "Emitida" | "Pagada" | "Vencida" | "Anulada"
          issued_on?: string
          due_on?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          paid_cents?: number
          currency?: string
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          client_id?: string | null
          client_name?: string
          quote_id?: string | null
          project_id?: string | null
          status?: "Borrador" | "Emitida" | "Pagada" | "Vencida" | "Anulada"
          issued_on?: string
          due_on?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          paid_cents?: number
          currency?: string
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      irrigation_events: {
        Row: {
          id: string
          lot_id: string
          method: "Goteo" | "Aspersión" | "Gravedad" | "Pivote" | "Manual" | "Otro"
          duration_min: number
          water_m3: number
          started_on: string
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          lot_id: string
          method?: "Goteo" | "Aspersión" | "Gravedad" | "Pivote" | "Manual" | "Otro"
          duration_min?: number
          water_m3?: number
          started_on?: string
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          lot_id?: string
          method?: "Goteo" | "Aspersión" | "Gravedad" | "Pivote" | "Manual" | "Otro"
          duration_min?: number
          water_m3?: number
          started_on?: string
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "irrigation_events_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "farm_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      job_openings: {
        Row: {
          id: string
          org_id: string
          code: string | null
          title: string
          department: string
          employment_type: "Tiempo completo" | "Medio tiempo" | "Contrato" | "Prácticas"
          status: "Abierta" | "En proceso" | "Cerrada" | "Cancelada"
          opened_on: string
          created_at: string
          updated_at: string
          location: string
          openings: number
          salary_min_cents: number
          salary_max_cents: number
          hiring_manager_id: string | null
          description: string
          closed_on: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          title: string
          department?: string
          employment_type?: "Tiempo completo" | "Medio tiempo" | "Contrato" | "Prácticas"
          status?: "Abierta" | "En proceso" | "Cerrada" | "Cancelada"
          opened_on?: string
          created_at?: string
          updated_at?: string
          location?: string
          openings?: number
          salary_min_cents?: number
          salary_max_cents?: number
          hiring_manager_id?: string | null
          description?: string
          closed_on?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          title?: string
          department?: string
          employment_type?: "Tiempo completo" | "Medio tiempo" | "Contrato" | "Prácticas"
          status?: "Abierta" | "En proceso" | "Cerrada" | "Cancelada"
          opened_on?: string
          created_at?: string
          updated_at?: string
          location?: string
          openings?: number
          salary_min_cents?: number
          salary_max_cents?: number
          hiring_manager_id?: string | null
          description?: string
          closed_on?: string | null
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_openings_hiring_manager_id_fkey"
            columns: ["hiring_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_openings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          id: string
          org_id: string
          entry_date: string
          memo: string
          source: "Manual" | "Venta" | "Cobro" | "Compra" | "Pago" | "Caja"
          source_id: string | null
          status: "Borrador" | "Publicado"
          posted_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          entry_date?: string
          memo: string
          source?: "Manual" | "Venta" | "Cobro" | "Compra" | "Pago" | "Caja"
          source_id?: string | null
          status?: "Borrador" | "Publicado"
          posted_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          entry_date?: string
          memo?: string
          source?: "Manual" | "Venta" | "Cobro" | "Compra" | "Pago" | "Caja"
          source_id?: string | null
          status?: "Borrador" | "Publicado"
          posted_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          id: string
          org_id: string
          entry_id: string
          account_code: string
          description: string
          debit_cents: number
          credit_cents: number
        }
        Insert: {
          id?: string
          org_id: string
          entry_id: string
          account_code: string
          description?: string
          debit_cents?: number
          credit_cents?: number
        }
        Update: {
          id?: string
          org_id?: string
          entry_id?: string
          account_code?: string
          description?: string
          debit_cents?: number
          credit_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_code"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          id: string
          org_id: string
          lead_id: string
          kind: "Llamada" | "Correo" | "Nota" | "Agenda"
          note: string
          occurred_at: string
        }
        Insert: {
          id?: string
          org_id: string
          lead_id: string
          kind?: "Llamada" | "Correo" | "Nota" | "Agenda"
          note: string
          occurred_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          lead_id?: string
          kind?: "Llamada" | "Correo" | "Nota" | "Agenda"
          note?: string
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          id: string
          org_id: string
          name: string
          company_name: string
          email: string
          phone: string
          source: "Referido" | "Web" | "Campaña" | "Llamada" | "Otro"
          stage: "Nuevo" | "Contactado" | "Calificado" | "Perdido" | "Convertido"
          owner_id: string | null
          lost_reason: string
          notes: string
          converted_client_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          company_name?: string
          email?: string
          phone?: string
          source?: "Referido" | "Web" | "Campaña" | "Llamada" | "Otro"
          stage?: "Nuevo" | "Contactado" | "Calificado" | "Perdido" | "Convertido"
          owner_id?: string | null
          lost_reason?: string
          notes?: string
          converted_client_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          company_name?: string
          email?: string
          phone?: string
          source?: "Referido" | "Web" | "Campaña" | "Llamada" | "Otro"
          stage?: "Nuevo" | "Contactado" | "Calificado" | "Perdido" | "Convertido"
          owner_id?: string | null
          lost_reason?: string
          notes?: string
          converted_client_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_payments: {
        Row: {
          id: string
          lease_id: string
          period: string
          amount_cents: number
          paid_cents: number
          due_on: string
          paid_on: string | null
          method: "Transferencia" | "Efectivo" | "Tarjeta" | "Cheque" | "Otro"
          reference: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lease_id: string
          period: string
          amount_cents: number
          paid_cents?: number
          due_on: string
          paid_on?: string | null
          method?: "Transferencia" | "Efectivo" | "Tarjeta" | "Cheque" | "Otro"
          reference?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lease_id?: string
          period?: string
          amount_cents?: number
          paid_cents?: number
          due_on?: string
          paid_on?: string | null
          method?: "Transferencia" | "Efectivo" | "Tarjeta" | "Cheque" | "Otro"
          reference?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_payments_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          id: string
          org_id: string
          property_id: string
          tenant_name: string
          tenant_document: string
          tenant_email: string | null
          tenant_phone: string
          client_id: string | null
          contract_id: string | null
          status: "Activo" | "Por vencer" | "Terminado" | "En mora"
          rent_cents: number
          deposit_cents: number
          due_day: number
          starts_on: string
          ends_on: string | null
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          property_id: string
          tenant_name: string
          tenant_document?: string
          tenant_email?: string | null
          tenant_phone?: string
          client_id?: string | null
          contract_id?: string | null
          status?: "Activo" | "Por vencer" | "Terminado" | "En mora"
          rent_cents?: number
          deposit_cents?: number
          due_day?: number
          starts_on?: string
          ends_on?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          property_id?: string
          tenant_name?: string
          tenant_document?: string
          tenant_email?: string | null
          tenant_phone?: string
          client_id?: string | null
          contract_id?: string | null
          status?: "Activo" | "Por vencer" | "Terminado" | "En mora"
          rent_cents?: number
          deposit_cents?: number
          due_day?: number
          starts_on?: string
          ends_on?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_installments: {
        Row: {
          id: string
          org_id: string
          loan_id: string
          number: number
          due_date: string
          amount_cents: number
          status: "pendiente" | "pagada"
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          loan_id: string
          number: number
          due_date: string
          amount_cents: number
          status?: "pendiente" | "pagada"
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          loan_id?: string
          number?: number
          due_date?: string
          amount_cents?: number
          status?: "pendiente" | "pagada"
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_installments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          id: string
          org_id: string
          client_id: string | null
          amount_cents: number
          interest_rate_bps: number
          term_months: number
          start_date: string
          status: "activo" | "pagado" | "castigado"
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id?: string | null
          amount_cents: number
          interest_rate_bps?: number
          term_months: number
          start_date?: string
          status?: "activo" | "pagado" | "castigado"
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string | null
          amount_cents?: number
          interest_rate_bps?: number
          term_months?: number
          start_date?: string
          status?: "activo" | "pagado" | "castigado"
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          id: string
          org_id: string
          client_id: string
          points: number
          reason: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          points: number
          reason: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          points?: number
          reason?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          id: string
          org_id: string
          name: string
          channel: "whatsapp" | "email" | "sms" | "otro"
          message: string
          status: "borrador" | "programada" | "enviada" | "cancelada"
          scheduled_for: string | null
          sent_at: string | null
          audience_count: number
          sent_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          channel?: "whatsapp" | "email" | "sms" | "otro"
          message?: string
          status?: "borrador" | "programada" | "enviada" | "cancelada"
          scheduled_for?: string | null
          sent_at?: string | null
          audience_count?: number
          sent_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          channel?: "whatsapp" | "email" | "sms" | "otro"
          message?: string
          status?: "borrador" | "programada" | "enviada" | "cancelada"
          scheduled_for?: string | null
          sent_at?: string | null
          audience_count?: number
          sent_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_recipients: {
        Row: {
          id: string
          campaign_id: string
          client_id: string | null
          contact_name: string
          contact_address: string
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          client_id?: string | null
          contact_name?: string
          contact_address?: string
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          client_id?: string | null
          contact_name?: string
          contact_address?: string
          sent_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_recipients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_templates: {
        Row: {
          id: string
          org_id: string
          name: string
          channel: "whatsapp" | "email" | "sms" | "otro"
          message: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          channel?: "whatsapp" | "email" | "sms" | "otro"
          message?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          channel?: "whatsapp" | "email" | "sms" | "otro"
          message?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_sites: {
        Row: {
          org_id: string
          user_id: string
          site_id: string
          created_at: string
        }
        Insert: {
          org_id: string
          user_id: string
          site_id: string
          created_at?: string
        }
        Update: {
          org_id?: string
          user_id?: string
          site_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_sites_org_id_user_id_fkey"
            columns: ["org_id", "user_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["org_id", "user_id"]
          },
          {
            foreignKeyName: "membership_sites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          id: string
          org_id: string
          user_id: string
          role: string
          created_at: string
          updated_at: string
          last_active_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          role: string
          created_at?: string
          updated_at?: string
          last_active_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          role?: string
          created_at?: string
          updated_at?: string
          last_active_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_role_fkey"
            columns: ["org_id", "role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["org_id", "key"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_ingredients: {
        Row: {
          id: string
          menu_item_id: string
          name: string
          quantity: number
          unit: "g" | "kg" | "ml" | "L" | "UN" | "Porción"
          cost_cents: number
          created_at: string
        }
        Insert: {
          id?: string
          menu_item_id: string
          name: string
          quantity?: number
          unit?: "g" | "kg" | "ml" | "L" | "UN" | "Porción"
          cost_cents?: number
          created_at?: string
        }
        Update: {
          id?: string
          menu_item_id?: string
          name?: string
          quantity?: number
          unit?: "g" | "kg" | "ml" | "L" | "UN" | "Porción"
          cost_cents?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_ingredients_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          id: string
          org_id: string
          name: string
          category: "Entrada" | "Plato fuerte" | "Postre" | "Bebida" | "Cóctel" | "Otro"
          description: string
          price_cents: number
          cost_cents: number
          prep_minutes: number | null
          allergens: string
          is_available: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          category?: "Entrada" | "Plato fuerte" | "Postre" | "Bebida" | "Cóctel" | "Otro"
          description?: string
          price_cents?: number
          cost_cents?: number
          prep_minutes?: number | null
          allergens?: string
          is_available?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          category?: "Entrada" | "Plato fuerte" | "Postre" | "Bebida" | "Cóctel" | "Otro"
          description?: string
          price_cents?: number
          cost_cents?: number
          prep_minutes?: number | null
          allergens?: string
          is_available?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      module_dependencies: {
        Row: {
          module_key: string
          requires_key: string
          kind: "hard" | "soft"
        }
        Insert: {
          module_key: string
          requires_key: string
          kind?: "hard" | "soft"
        }
        Update: {
          module_key?: string
          requires_key?: string
          kind?: "hard" | "soft"
        }
        Relationships: [
        ]
      }
      nonconformities: {
        Row: {
          id: string
          org_id: string
          product_id: string | null
          batch: string | null
          description: string
          severity: "baja" | "media" | "alta"
          status: "abierta" | "en_proceso" | "cerrada"
          action_taken: string | null
          opened_on: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          product_id?: string | null
          batch?: string | null
          description: string
          severity?: "baja" | "media" | "alta"
          status?: "abierta" | "en_proceso" | "cerrada"
          action_taken?: string | null
          opened_on?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          product_id?: string | null
          batch?: string | null
          description?: string
          severity?: "baja" | "media" | "alta"
          status?: "abierta" | "en_proceso" | "cerrada"
          action_taken?: string | null
          opened_on?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nonconformities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nonconformities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          id: string
          org_id: string
          rule_id: string | null
          kind: string
          recipient: string
          channel: string
          status: "enviado" | "fallido"
          sent_at: string
          error: string | null
        }
        Insert: {
          id?: string
          org_id: string
          rule_id?: string | null
          kind: string
          recipient: string
          channel: string
          status?: "enviado" | "fallido"
          sent_at?: string
          error?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          rule_id?: string | null
          kind?: string
          recipient?: string
          channel?: string
          status?: "enviado" | "fallido"
          sent_at?: string
          error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "notification_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          id: string
          org_id: string
          name: string
          kind: "cita" | "vencimiento" | "renovacion"
          days_before: number
          channel: "email" | "whatsapp"
          enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          kind: "cita" | "vencimiento" | "renovacion"
          days_before?: number
          channel?: "email" | "whatsapp"
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          kind?: "cita" | "vencimiento" | "renovacion"
          days_before?: number
          channel?: "email" | "whatsapp"
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_apu: {
        Row: {
          id: string
          org_id: string
          capitulo_id: string
          name: string
          unidad: string
          cantidad: number
          materiales: number
          mano_obra: number
          equipo: number
          transporte: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          capitulo_id: string
          name: string
          unidad?: string
          cantidad?: number
          materiales?: number
          mano_obra?: number
          equipo?: number
          transporte?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          capitulo_id?: string
          name?: string
          unidad?: string
          cantidad?: number
          materiales?: number
          mano_obra?: number
          equipo?: number
          transporte?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_apu_capitulo_id_fkey"
            columns: ["capitulo_id"]
            isOneToOne: false
            referencedRelation: "obra_capitulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_apu_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_avances: {
        Row: {
          id: string
          org_id: string
          capitulo_id: string
          fecha: string
          avance: number
          valor: number
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          capitulo_id: string
          fecha?: string
          avance: number
          valor?: number
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          capitulo_id?: string
          fecha?: string
          avance?: number
          valor?: number
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_avances_capitulo_id_fkey"
            columns: ["capitulo_id"]
            isOneToOne: false
            referencedRelation: "obra_capitulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_avances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_capitulos: {
        Row: {
          id: string
          org_id: string
          presupuesto_id: string
          name: string
          orden: number
          valor_presupuestado: number
          valor_ejecutado: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          presupuesto_id: string
          name: string
          orden?: number
          valor_presupuestado?: number
          valor_ejecutado?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          presupuesto_id?: string
          name?: string
          orden?: number
          valor_presupuestado?: number
          valor_ejecutado?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_capitulos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_capitulos_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "obra_presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_presupuestos: {
        Row: {
          id: string
          org_id: string
          name: string
          client: string | null
          estado: "borrador" | "aprobado" | "en_ejecucion" | "cerrado"
          valor_presupuestado: number
          valor_ejecutado: number
          fecha_inicio: string | null
          fecha_fin: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          client?: string | null
          estado?: "borrador" | "aprobado" | "en_ejecucion" | "cerrado"
          valor_presupuestado?: number
          valor_ejecutado?: number
          fecha_inicio?: string | null
          fecha_fin?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          client?: string | null
          estado?: "borrador" | "aprobado" | "en_ejecucion" | "cerrado"
          valor_presupuestado?: number
          valor_ejecutado?: number
          fecha_inicio?: string | null
          fecha_fin?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_presupuestos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      online_order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          description: string
          quantity: number
          unit_price_cents: number
          position: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          description: string
          quantity?: number
          unit_price_cents?: number
          position?: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          description?: string
          quantity?: number
          unit_price_cents?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "online_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "online_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      online_order_returns: {
        Row: {
          id: string
          order_id: string
          reason: string
          amount_cents: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          reason: string
          amount_cents?: number
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          reason?: string
          amount_cents?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "online_order_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "online_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      online_orders: {
        Row: {
          id: string
          org_id: string
          code: string | null
          client_id: string | null
          customer_name: string
          customer_email: string | null
          customer_phone: string
          status: "Nuevo" | "Pagado" | "En preparación" | "Enviado" | "Entregado" | "Cancelado" | "Devuelto"
          shipping_method: "Domicilio" | "Recoge en tienda" | "Mensajería" | "Otro"
          shipping_address: string
          shipping_city: string
          tracking_code: string
          subtotal_cents: number
          shipping_cents: number
          discount_cents: number
          total_cents: number
          coupon_code: string
          placed_at: string
          shipped_at: string | null
          delivered_at: string | null
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          client_id?: string | null
          customer_name?: string
          customer_email?: string | null
          customer_phone?: string
          status?: "Nuevo" | "Pagado" | "En preparación" | "Enviado" | "Entregado" | "Cancelado" | "Devuelto"
          shipping_method?: "Domicilio" | "Recoge en tienda" | "Mensajería" | "Otro"
          shipping_address?: string
          shipping_city?: string
          tracking_code?: string
          subtotal_cents?: number
          shipping_cents?: number
          discount_cents?: number
          total_cents?: number
          coupon_code?: string
          placed_at?: string
          shipped_at?: string | null
          delivered_at?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          client_id?: string | null
          customer_name?: string
          customer_email?: string | null
          customer_phone?: string
          status?: "Nuevo" | "Pagado" | "En preparación" | "Enviado" | "Entregado" | "Cancelado" | "Devuelto"
          shipping_method?: "Domicilio" | "Recoge en tienda" | "Mensajería" | "Otro"
          shipping_address?: string
          shipping_city?: string
          tracking_code?: string
          subtotal_cents?: number
          shipping_cents?: number
          discount_cents?: number
          total_cents?: number
          coupon_code?: string
          placed_at?: string
          shipped_at?: string | null
          delivered_at?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "online_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_account_mappings: {
        Row: {
          org_id: string
          concepto: "venta_credito" | "cobro" | "compra" | "pago_proveedor" | "caja_diferencia"
          account_code: string
          auto: boolean
        }
        Insert: {
          org_id: string
          concepto: "venta_credito" | "cobro" | "compra" | "pago_proveedor" | "caja_diferencia"
          account_code: string
          auto?: boolean
        }
        Update: {
          org_id?: string
          concepto?: "venta_credito" | "cobro" | "compra" | "pago_proveedor" | "caja_diferencia"
          account_code?: string
          auto?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "org_account_mappings_account_id_fkey"
            columns: ["account_code"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "org_account_mappings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          industry: string | null
          created_at: string
          updated_at: string
          company_type: string | null
          enabled_modules: string[]
          account_id: string
          subsector: string | null
          legal_name: string | null
          tax_id: string | null
          country: string
          currency: string
          timezone: string
          branding: Json
          status: "active" | "suspended"
          setup_completed_at: string | null
          receipt_prefs: Json
        }
        Insert: {
          id?: string
          name: string
          slug: string
          industry?: string | null
          created_at?: string
          updated_at?: string
          company_type?: string | null
          enabled_modules?: string[]
          account_id: string
          subsector?: string | null
          legal_name?: string | null
          tax_id?: string | null
          country?: string
          currency?: string
          timezone?: string
          branding?: Json
          status?: "active" | "suspended"
          setup_completed_at?: string | null
          receipt_prefs?: Json
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          industry?: string | null
          created_at?: string
          updated_at?: string
          company_type?: string | null
          enabled_modules?: string[]
          account_id?: string
          subsector?: string | null
          legal_name?: string | null
          tax_id?: string | null
          country?: string
          currency?: string
          timezone?: string
          branding?: Json
          status?: "active" | "suspended"
          setup_completed_at?: string | null
          receipt_prefs?: Json
        }
        Relationships: [
          {
            foreignKeyName: "organizations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_company_type_fkey"
            columns: ["company_type"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "organizations_subsector_fkey"
            columns: ["subsector"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["key"]
          },
        ]
      }
      patient_appointments: {
        Row: {
          id: string
          patient_id: string
          kind: "Consulta" | "Control" | "Vacunación" | "Examen" | "Otro"
          scheduled_for: string
          professional_id: string | null
          status: "Programada" | "Confirmada" | "En sala" | "Atendida" | "Cancelada" | "No asistió"
          reason: string
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          kind?: "Consulta" | "Control" | "Vacunación" | "Examen" | "Otro"
          scheduled_for: string
          professional_id?: string | null
          status?: "Programada" | "Confirmada" | "En sala" | "Atendida" | "Cancelada" | "No asistió"
          reason?: string
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          kind?: "Consulta" | "Control" | "Vacunación" | "Examen" | "Otro"
          scheduled_for?: string
          professional_id?: string | null
          status?: "Programada" | "Confirmada" | "En sala" | "Atendida" | "Cancelada" | "No asistió"
          reason?: string
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_images: {
        Row: {
          id: string
          org_id: string
          patient_id: string
          kind: "Radiografía" | "Ultrasonido" | "Tomografía" | "Fotografía" | "Otro"
          study: string
          taken_on: string
          storage_path: string
          mime_type: string | null
          size_bytes: number
          notes: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          patient_id: string
          kind?: "Radiografía" | "Ultrasonido" | "Tomografía" | "Fotografía" | "Otro"
          study: string
          taken_on?: string
          storage_path: string
          mime_type?: string | null
          size_bytes?: number
          notes?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          patient_id?: string
          kind?: "Radiografía" | "Ultrasonido" | "Tomografía" | "Fotografía" | "Otro"
          study?: string
          taken_on?: string
          storage_path?: string
          mime_type?: string | null
          size_bytes?: number
          notes?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_images_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_images_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_lab_results: {
        Row: {
          id: string
          patient_id: string
          test_name: string
          status: "Solicitado" | "En proceso" | "Resultado"
          result: string
          ordered_on: string
          result_on: string | null
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          test_name: string
          status?: "Solicitado" | "En proceso" | "Resultado"
          result?: string
          ordered_on?: string
          result_on?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          test_name?: string
          status?: "Solicitado" | "En proceso" | "Resultado"
          result?: string
          ordered_on?: string
          result_on?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_lab_results_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_prescriptions: {
        Row: {
          id: string
          patient_id: string
          professional_id: string | null
          medication: string
          dose: string
          frequency: string
          instructions: string
          prescribed_on: string
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          professional_id?: string | null
          medication: string
          dose?: string
          frequency?: string
          instructions?: string
          prescribed_on?: string
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          professional_id?: string | null
          medication?: string
          dose?: string
          frequency?: string
          instructions?: string
          prescribed_on?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_prescriptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_visits: {
        Row: {
          id: string
          patient_id: string
          kind: "Consulta" | "Control" | "Urgencia" | "Procedimiento" | "Teleconsulta" | "Vacunación" | "Examen" | "Otro"
          professional_id: string | null
          reason: string
          diagnosis: string
          treatment: string
          notes: string
          fee_cents: number
          visited_at: string
          follow_up_on: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          kind?: "Consulta" | "Control" | "Urgencia" | "Procedimiento" | "Teleconsulta" | "Vacunación" | "Examen" | "Otro"
          professional_id?: string | null
          reason?: string
          diagnosis?: string
          treatment?: string
          notes?: string
          fee_cents?: number
          visited_at?: string
          follow_up_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          kind?: "Consulta" | "Control" | "Urgencia" | "Procedimiento" | "Teleconsulta" | "Vacunación" | "Examen" | "Otro"
          professional_id?: string | null
          reason?: string
          diagnosis?: string
          treatment?: string
          notes?: string
          fee_cents?: number
          visited_at?: string
          follow_up_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_visits_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          id: string
          org_id: string
          code: string | null
          full_name: string
          document_id: string
          birth_date: string | null
          sex: "F" | "M" | "Otro" | null
          blood_type: "O+" | "O-" | "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | null
          status: "Activo" | "Inactivo" | "Egresado"
          email: string | null
          phone: string
          address: string
          insurer: string
          allergies: string
          conditions: string
          emergency_contact: string
          emergency_phone: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          full_name: string
          document_id?: string
          birth_date?: string | null
          sex?: "F" | "M" | "Otro" | null
          blood_type?: "O+" | "O-" | "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | null
          status?: "Activo" | "Inactivo" | "Egresado"
          email?: string | null
          phone?: string
          address?: string
          insurer?: string
          allergies?: string
          conditions?: string
          emergency_contact?: string
          emergency_phone?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          full_name?: string
          document_id?: string
          birth_date?: string | null
          sex?: "F" | "M" | "Otro" | null
          blood_type?: "O+" | "O-" | "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | null
          status?: "Activo" | "Inactivo" | "Egresado"
          email?: string | null
          phone?: string
          address?: string
          insurer?: string
          allergies?: string
          conditions?: string
          emergency_contact?: string
          emergency_phone?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_concept_lines: {
        Row: {
          id: string
          org_id: string
          payroll_period_id: string
          employee_id: string
          name: string
          kind: "Devengo" | "Deducción"
          amount_cents: number
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          payroll_period_id: string
          employee_id: string
          name: string
          kind: "Devengo" | "Deducción"
          amount_cents: number
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          payroll_period_id?: string
          employee_id?: string
          name?: string
          kind?: "Devengo" | "Deducción"
          amount_cents?: number
          position?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_concept_lines_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_concept_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_concept_lines_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_concepts: {
        Row: {
          id: string
          org_id: string
          name: string
          kind: "Devengo" | "Deducción"
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          kind: "Devengo" | "Deducción"
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          kind?: "Devengo" | "Deducción"
          position?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_concepts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_lines: {
        Row: {
          id: string
          payroll_period_id: string
          employee_id: string
          gross_cents: number
          deductions_cents: number
          created_at: string
          net_cents: number | null
        }
        Insert: {
          id?: string
          payroll_period_id: string
          employee_id: string
          gross_cents?: number
          deductions_cents?: number
          created_at?: string
        }
        Update: {
          id?: string
          payroll_period_id?: string
          employee_id?: string
          gross_cents?: number
          deductions_cents?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_lines_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          id: string
          org_id: string
          code: string | null
          period: string
          status: "Borrador" | "En revisión" | "Aprobada" | "Pagada"
          created_at: string
          updated_at: string
          locked_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          period: string
          status?: "Borrador" | "En revisión" | "Aprobada" | "Pagada"
          created_at?: string
          updated_at?: string
          locked_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          period?: string
          status?: "Borrador" | "En revisión" | "Aprobada" | "Pagada"
          created_at?: string
          updated_at?: string
          locked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_periods_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_rules: {
        Row: {
          id: string
          org_id: string
          year: number
          min_wage_cents: number
          transport_cents: number
          cesantias_pct: number
          prima_pct: number
          interes_cesantias_pct: number
          vacaciones_pct: number
          salud_employee_pct: number
          salud_employer_pct: number
          pension_employee_pct: number
          pension_employer_pct: number
          arl_pct: number
          caja_pct: number
          vacation_days: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          year: number
          min_wage_cents?: number
          transport_cents?: number
          cesantias_pct?: number
          prima_pct?: number
          interes_cesantias_pct?: number
          vacaciones_pct?: number
          salud_employee_pct?: number
          salud_employer_pct?: number
          pension_employee_pct?: number
          pension_employer_pct?: number
          arl_pct?: number
          caja_pct?: number
          vacation_days?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          year?: number
          min_wage_cents?: number
          transport_cents?: number
          cesantias_pct?: number
          prima_pct?: number
          interes_cesantias_pct?: number
          vacaciones_pct?: number
          salud_employee_pct?: number
          salud_employer_pct?: number
          pension_employee_pct?: number
          pension_employer_pct?: number
          arl_pct?: number
          caja_pct?: number
          vacation_days?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          key: string
          module: string
          action: "read" | "write" | "manage" | "use"
          label: string
        }
        Insert: {
          key: string
          module: string
          action: "read" | "write" | "manage" | "use"
          label: string
        }
        Update: {
          key?: string
          module?: string
          action?: "read" | "write" | "manage" | "use"
          label?: string
        }
        Relationships: [
        ]
      }
      ph_asambleas: {
        Row: {
          id: string
          org_id: string
          fecha: string
          tema: string
          tipo: "ordinaria" | "extraordinaria"
          estado: "convocada" | "realizada" | "acta_firmada"
          asistentes: number
          decisiones: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          fecha?: string
          tema: string
          tipo?: "ordinaria" | "extraordinaria"
          estado?: "convocada" | "realizada" | "acta_firmada"
          asistentes?: number
          decisiones?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          fecha?: string
          tema?: string
          tipo?: "ordinaria" | "extraordinaria"
          estado?: "convocada" | "realizada" | "acta_firmada"
          asistentes?: number
          decisiones?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ph_asambleas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ph_cuotas: {
        Row: {
          id: string
          org_id: string
          unidad: string
          periodo: string
          tipo: "ordinaria" | "extraordinaria"
          monto: number
          estado: "pendiente" | "pagada"
          vence: string | null
          pagada_on: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          unidad: string
          periodo: string
          tipo?: "ordinaria" | "extraordinaria"
          monto?: number
          estado?: "pendiente" | "pagada"
          vence?: string | null
          pagada_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          unidad?: string
          periodo?: string
          tipo?: "ordinaria" | "extraordinaria"
          monto?: number
          estado?: "pendiente" | "pagada"
          vence?: string | null
          pagada_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ph_cuotas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ph_zonas: {
        Row: {
          id: string
          org_id: string
          name: string
          tipo: "salon" | "piscina" | "gimnasio" | "parqueadero" | "otro"
          estado: "operativa" | "mantenimiento" | "cerrada"
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          tipo?: "salon" | "piscina" | "gimnasio" | "parqueadero" | "otro"
          estado?: "operativa" | "mantenimiento" | "cerrada"
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          tipo?: "salon" | "piscina" | "gimnasio" | "parqueadero" | "otro"
          estado?: "operativa" | "mantenimiento" | "cerrada"
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ph_zonas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          id: string
          org_id: string
          name: string
          position: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          position?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          position?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          plan: "starter" | "growth" | "enterprise"
          max_companies: number | null
          max_sites_per_company: number | null
        }
        Insert: {
          plan: "starter" | "growth" | "enterprise"
          max_companies?: number | null
          max_sites_per_company?: number | null
        }
        Update: {
          plan?: "starter" | "growth" | "enterprise"
          max_companies?: number | null
          max_sites_per_company?: number | null
        }
        Relationships: [
        ]
      }
      portal_links: {
        Row: {
          id: string
          org_id: string
          kind: "factura" | "cita" | "avance"
          target_id: string
          label: string
          token: string
          created_by: string | null
          expires_at: string
          max_views: number | null
          view_count: number
          last_viewed_at: string | null
          revoked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          kind: "factura" | "cita" | "avance"
          target_id: string
          label: string
          token: string
          created_by?: string | null
          expires_at: string
          max_views?: number | null
          view_count?: number
          last_viewed_at?: string | null
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          kind?: "factura" | "cita" | "avance"
          target_id?: string
          label?: string
          token?: string
          created_by?: string | null
          expires_at?: string
          max_views?: number | null
          view_count?: number
          last_viewed_at?: string | null
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_views: {
        Row: {
          id: string
          org_id: string
          link_id: string | null
          viewed_at: string
          ip: string | null
        }
        Insert: {
          id?: string
          org_id: string
          link_id?: string | null
          viewed_at?: string
          ip?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          link_id?: string | null
          viewed_at?: string
          ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_views_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "portal_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_views_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_payments: {
        Row: {
          id: string
          org_id: string
          sale_id: string
          provider: "wompi" | "payu" | "epayco" | "stripe" | "otro"
          status: "Pendiente" | "Confirmado" | "Rechazado"
          amount_cents: number
          reference: string
          external_id: string | null
          event_id: string | null
          confirmed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          sale_id: string
          provider?: "wompi" | "payu" | "epayco" | "stripe" | "otro"
          status?: "Pendiente" | "Confirmado" | "Rechazado"
          amount_cents: number
          reference?: string
          external_id?: string | null
          event_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          sale_id?: string
          provider?: "wompi" | "payu" | "epayco" | "stripe" | "otro"
          status?: "Pendiente" | "Confirmado" | "Rechazado"
          amount_cents?: number
          reference?: string
          external_id?: string | null
          event_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string | null
          sku: string
          name: string
          quantity: number
          unit_price_cents: number
          total_cents: number
        }
        Insert: {
          id?: string
          sale_id: string
          product_id?: string | null
          sku?: string
          name: string
          quantity: number
          unit_price_cents?: number
          total_cents?: number
        }
        Update: {
          id?: string
          sale_id?: string
          product_id?: string | null
          sku?: string
          name?: string
          quantity?: number
          unit_price_cents?: number
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sales: {
        Row: {
          id: string
          org_id: string
          code: string | null
          session_id: string | null
          client_id: string | null
          customer_name: string
          subtotal_cents: number
          discount_cents: number
          tax_cents: number
          total_cents: number
          payment_method: "Transferencia" | "Efectivo" | "Tarjeta" | "Cheque" | "QR Wompi" | "Otro"
          status: "Pagada" | "Pendiente" | "Anulada"
          sold_by: string | null
          sold_at: string
          notes: string
          created_at: string
          updated_at: string
          client_uuid: string | null
          site_id: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          session_id?: string | null
          client_id?: string | null
          customer_name?: string
          subtotal_cents?: number
          discount_cents?: number
          tax_cents?: number
          total_cents?: number
          payment_method?: "Transferencia" | "Efectivo" | "Tarjeta" | "Cheque" | "QR Wompi" | "Otro"
          status?: "Pagada" | "Pendiente" | "Anulada"
          sold_by?: string | null
          sold_at?: string
          notes?: string
          created_at?: string
          updated_at?: string
          client_uuid?: string | null
          site_id?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          session_id?: string | null
          client_id?: string | null
          customer_name?: string
          subtotal_cents?: number
          discount_cents?: number
          tax_cents?: number
          total_cents?: number
          payment_method?: "Transferencia" | "Efectivo" | "Tarjeta" | "Cheque" | "QR Wompi" | "Otro"
          status?: "Pagada" | "Pendiente" | "Anulada"
          sold_by?: string | null
          sold_at?: string
          notes?: string
          created_at?: string
          updated_at?: string
          client_uuid?: string | null
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_sold_by_fkey"
            columns: ["sold_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shifts: {
        Row: {
          id: string
          org_id: string
          post_id: string
          employee_id: string | null
          starts_at: string
          ends_at: string
          status: "programado" | "en_curso" | "completado" | "cancelado"
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          post_id: string
          employee_id?: string | null
          starts_at: string
          ends_at: string
          status?: "programado" | "en_curso" | "completado" | "cancelado"
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          post_id?: string
          employee_id?: string | null
          starts_at?: string
          ends_at?: string
          status?: "programado" | "en_curso" | "completado" | "cancelado"
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shifts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "guard_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      production_bom_items: {
        Row: {
          id: string
          bom_id: string
          component_id: string
          quantity: number
          unit: string
          position: number
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          bom_id: string
          component_id: string
          quantity: number
          unit?: string
          position?: number
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          bom_id?: string
          component_id?: string
          quantity?: number
          unit?: string
          position?: number
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_bom_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "production_boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_bom_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_boms: {
        Row: {
          id: string
          org_id: string
          product_id: string
          version: string
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          product_id: string
          version?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          product_id?: string
          version?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_boms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_boms_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          id: string
          org_id: string
          code: string | null
          product_id: string | null
          product_label: string
          status: "Planificada" | "En proceso" | "En pausa" | "Terminada" | "Cancelada"
          quantity_planned: number
          quantity_done: number
          quantity_scrap: number
          unit: string
          line: string
          supervisor_id: string | null
          starts_on: string | null
          due_on: string | null
          completed_at: string | null
          cost_cents: number
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          product_id?: string | null
          product_label?: string
          status?: "Planificada" | "En proceso" | "En pausa" | "Terminada" | "Cancelada"
          quantity_planned: number
          quantity_done?: number
          quantity_scrap?: number
          unit?: string
          line?: string
          supervisor_id?: string | null
          starts_on?: string | null
          due_on?: string | null
          completed_at?: string | null
          cost_cents?: number
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          product_id?: string | null
          product_label?: string
          status?: "Planificada" | "En proceso" | "En pausa" | "Terminada" | "Cancelada"
          quantity_planned?: number
          quantity_done?: number
          quantity_scrap?: number
          unit?: string
          line?: string
          supervisor_id?: string | null
          starts_on?: string | null
          due_on?: string | null
          completed_at?: string | null
          cost_cents?: number
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      production_stages: {
        Row: {
          id: string
          order_id: string
          name: string
          status: "Planificada" | "En proceso" | "En pausa" | "Terminada" | "Cancelada"
          quantity_done: number
          operator_id: string | null
          started_at: string | null
          finished_at: string | null
          position: number
        }
        Insert: {
          id?: string
          order_id: string
          name: string
          status?: "Planificada" | "En proceso" | "En pausa" | "Terminada" | "Cancelada"
          quantity_done?: number
          operator_id?: string | null
          started_at?: string | null
          finished_at?: string | null
          position?: number
        }
        Update: {
          id?: string
          order_id?: string
          name?: string
          status?: "Planificada" | "En proceso" | "En pausa" | "Terminada" | "Cancelada"
          quantity_done?: number
          operator_id?: string | null
          started_at?: string | null
          finished_at?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_stages_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_stages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          id: string
          org_id: string
          sku: string
          name: string
          category: string
          description: string
          emoji: string | null
          unit: "UN" | "KIT" | "RL" | "KW" | "SERV" | "M" | "HR"
          price_cents: number
          cost_cents: number
          stock: number
          supplier: string
          is_active: boolean
          in_storefront: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
          barcode: string
          supplier_id: string | null
        }
        Insert: {
          id?: string
          org_id: string
          sku: string
          name: string
          category?: string
          description?: string
          emoji?: string | null
          unit?: "UN" | "KIT" | "RL" | "KW" | "SERV" | "M" | "HR"
          price_cents?: number
          cost_cents?: number
          stock?: number
          supplier?: string
          is_active?: boolean
          in_storefront?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          barcode?: string
          supplier_id?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          sku?: string
          name?: string
          category?: string
          description?: string
          emoji?: string | null
          unit?: "UN" | "KIT" | "RL" | "KW" | "SERV" | "M" | "HR"
          price_cents?: number
          cost_cents?: number
          stock?: number
          supplier?: string
          is_active?: boolean
          in_storefront?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          barcode?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          employee_id: string
          role: string
        }
        Insert: {
          id?: string
          project_id: string
          employee_id: string
          role?: string
        }
        Update: {
          id?: string
          project_id?: string
          employee_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          id: string
          org_id: string
          code: string | null
          name: string
          client: string
          location: string
          kind: "Instalación" | "Mantenimiento" | "Ampliación" | "Diagnóstico" | "Otro"
          capacity_kwp: number | null
          status: "Planificación" | "En ejecución" | "En pausa" | "Finalizado" | "Cancelado"
          progress: number
          budget_cents: number
          starts_on: string | null
          ends_on: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          name: string
          client?: string
          location?: string
          kind?: "Instalación" | "Mantenimiento" | "Ampliación" | "Diagnóstico" | "Otro"
          capacity_kwp?: number | null
          status?: "Planificación" | "En ejecución" | "En pausa" | "Finalizado" | "Cancelado"
          progress?: number
          budget_cents?: number
          starts_on?: string | null
          ends_on?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          name?: string
          client?: string
          location?: string
          kind?: "Instalación" | "Mantenimiento" | "Ampliación" | "Diagnóstico" | "Otro"
          capacity_kwp?: number | null
          status?: "Planificación" | "En ejecución" | "En pausa" | "Finalizado" | "Cancelado"
          progress?: number
          budget_cents?: number
          starts_on?: string | null
          ends_on?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          id: string
          org_id: string
          code: string | null
          name: string
          kind: "Apartamento" | "Casa" | "Oficina" | "Local" | "Bodega" | "Lote"
          status: "Disponible" | "Arrendado" | "En mantenimiento" | "Vendido"
          address: string
          city: string
          area_m2: number | null
          bedrooms: number | null
          bathrooms: number | null
          parking_spots: number | null
          rent_cents: number
          admin_fee_cents: number
          sale_price_cents: number
          owner_name: string
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          name: string
          kind?: "Apartamento" | "Casa" | "Oficina" | "Local" | "Bodega" | "Lote"
          status?: "Disponible" | "Arrendado" | "En mantenimiento" | "Vendido"
          address?: string
          city?: string
          area_m2?: number | null
          bedrooms?: number | null
          bathrooms?: number | null
          parking_spots?: number | null
          rent_cents?: number
          admin_fee_cents?: number
          sale_price_cents?: number
          owner_name?: string
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          name?: string
          kind?: "Apartamento" | "Casa" | "Oficina" | "Local" | "Bodega" | "Lote"
          status?: "Disponible" | "Arrendado" | "En mantenimiento" | "Vendido"
          address?: string
          city?: string
          area_m2?: number | null
          bedrooms?: number | null
          bathrooms?: number | null
          parking_spots?: number | null
          rent_cents?: number
          admin_fee_cents?: number
          sale_price_cents?: number
          owner_name?: string
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          id: string
          purchase_order_id: string
          product_id: string | null
          description: string
          quantity: number
          unit_price_cents: number
          position: number
          subtotal_cents: number | null
        }
        Insert: {
          id?: string
          purchase_order_id: string
          product_id?: string | null
          description: string
          quantity: number
          unit_price_cents?: number
          position?: number
        }
        Update: {
          id?: string
          purchase_order_id?: string
          product_id?: string | null
          description?: string
          quantity?: number
          unit_price_cents?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          id: string
          org_id: string
          code: string | null
          purchase_request_id: string | null
          supplier: string
          project_id: string | null
          status: "Pendiente" | "Aprobada" | "Recibida" | "Cancelada"
          issued_on: string
          due_on: string | null
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          purchase_request_id?: string | null
          supplier: string
          project_id?: string | null
          status?: "Pendiente" | "Aprobada" | "Recibida" | "Cancelada"
          issued_on?: string
          due_on?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          purchase_request_id?: string | null
          supplier?: string
          project_id?: string | null
          status?: "Pendiente" | "Aprobada" | "Recibida" | "Cancelada"
          issued_on?: string
          due_on?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_request_events: {
        Row: {
          id: string
          purchase_request_id: string
          actor_id: string | null
          note: string
          occurred_at: string
        }
        Insert: {
          id?: string
          purchase_request_id: string
          actor_id?: string | null
          note: string
          occurred_at?: string
        }
        Update: {
          id?: string
          purchase_request_id?: string
          actor_id?: string | null
          note?: string
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_events_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_request_items: {
        Row: {
          id: string
          purchase_request_id: string
          product_id: string | null
          description: string
          quantity: number
          unit: string
          unit_cost_cents: number
          position: number
          subtotal_cents: number | null
        }
        Insert: {
          id?: string
          purchase_request_id: string
          product_id?: string | null
          description: string
          quantity: number
          unit?: string
          unit_cost_cents?: number
          position?: number
        }
        Update: {
          id?: string
          purchase_request_id?: string
          product_id?: string | null
          description?: string
          quantity?: number
          unit?: string
          unit_cost_cents?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_items_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          id: string
          org_id: string
          code: string | null
          supplier: string
          project_id: string | null
          owner_id: string | null
          category: "Materiales" | "Servicios" | "Logística" | "Otro"
          status: "Borrador" | "Pendiente" | "Aprobada" | "Rechazada" | "OC generada"
          urgency: "Alta" | "Normal" | "Baja"
          needed_on: string | null
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          supplier?: string
          project_id?: string | null
          owner_id?: string | null
          category?: "Materiales" | "Servicios" | "Logística" | "Otro"
          status?: "Borrador" | "Pendiente" | "Aprobada" | "Rechazada" | "OC generada"
          urgency?: "Alta" | "Normal" | "Baja"
          needed_on?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          supplier?: string
          project_id?: string | null
          owner_id?: string | null
          category?: "Materiales" | "Servicios" | "Logística" | "Otro"
          status?: "Borrador" | "Pendiente" | "Aprobada" | "Rechazada" | "OC generada"
          urgency?: "Alta" | "Normal" | "Baja"
          needed_on?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_checks: {
        Row: {
          id: string
          org_id: string
          product_id: string | null
          batch: string | null
          checked_on: string
          result: "aprobado" | "rechazado" | "condicional"
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          product_id?: string | null
          batch?: string | null
          checked_on?: string
          result?: "aprobado" | "rechazado" | "condicional"
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          product_id?: string | null
          batch?: string | null
          checked_on?: string
          result?: "aprobado" | "rechazado" | "condicional"
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_checks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          product_id: string | null
          description: string
          quantity: number
          unit_price_cents: number
          position: number
          subtotal_cents: number | null
        }
        Insert: {
          id?: string
          quote_id: string
          product_id?: string | null
          description: string
          quantity: number
          unit_price_cents?: number
          position?: number
        }
        Update: {
          id?: string
          quote_id?: string
          product_id?: string | null
          description?: string
          quantity?: number
          unit_price_cents?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          id: string
          org_id: string
          code: string | null
          client: string
          contact: string
          project_id: string | null
          owner_id: string | null
          kind: "Comercial" | "Rural" | "Industrial" | "Residencial"
          status: "Borrador" | "Enviada" | "Aceptada" | "Rechazada" | "Vencida"
          probability: number
          issued_on: string
          expires_on: string | null
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
          stage_id: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          client: string
          contact?: string
          project_id?: string | null
          owner_id?: string | null
          kind?: "Comercial" | "Rural" | "Industrial" | "Residencial"
          status?: "Borrador" | "Enviada" | "Aceptada" | "Rechazada" | "Vencida"
          probability?: number
          issued_on?: string
          expires_on?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          stage_id?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          client?: string
          contact?: string
          project_id?: string | null
          owner_id?: string | null
          kind?: "Comercial" | "Rural" | "Industrial" | "Residencial"
          status?: "Borrador" | "Enviada" | "Aceptada" | "Rechazada" | "Vencida"
          probability?: number
          issued_on?: string
          expires_on?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      receivable_agreements: {
        Row: {
          id: string
          org_id: string
          invoice_id: string | null
          client_id: string | null
          amount_cents: number
          due_date: string
          status: "pendiente" | "pagada" | "vencida" | "mora"
          paid_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          invoice_id?: string | null
          client_id?: string | null
          amount_cents: number
          due_date: string
          status?: "pendiente" | "pagada" | "vencida" | "mora"
          paid_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          invoice_id?: string | null
          client_id?: string | null
          amount_cents?: number
          due_date?: string
          status?: "pendiente" | "pagada" | "vencida" | "mora"
          paid_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivable_agreements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivable_agreements_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivable_agreements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          id: string
          org_id: string
          priority: "Urgente" | "Importante" | "Pronto"
          category: string
          title: string
          reason: string
          status: "Abierta" | "Aplicada" | "Descartada"
          source: "sistema" | "ia" | "manual"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          priority: "Urgente" | "Importante" | "Pronto"
          category?: string
          title: string
          reason?: string
          status?: "Abierta" | "Aplicada" | "Descartada"
          source?: "sistema" | "ia" | "manual"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          priority?: "Urgente" | "Importante" | "Pronto"
          category?: string
          title?: string
          reason?: string
          status?: "Abierta" | "Aplicada" | "Descartada"
          source?: "sistema" | "ia" | "manual"
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          id: string
          org_id: string
          code: string | null
          room_id: string
          guest_name: string
          guest_document: string
          guest_email: string | null
          guest_phone: string
          client_id: string | null
          status: "Confirmada" | "Check-in" | "Check-out" | "Cancelada" | "No show"
          guests: number
          checkin_on: string
          checkout_on: string
          nightly_rate_cents: number
          total_cents: number
          paid_cents: number
          channel: string
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          room_id: string
          guest_name: string
          guest_document?: string
          guest_email?: string | null
          guest_phone?: string
          client_id?: string | null
          status?: "Confirmada" | "Check-in" | "Check-out" | "Cancelada" | "No show"
          guests?: number
          checkin_on: string
          checkout_on: string
          nightly_rate_cents?: number
          total_cents?: number
          paid_cents?: number
          channel?: string
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          room_id?: string
          guest_name?: string
          guest_document?: string
          guest_email?: string | null
          guest_phone?: string
          client_id?: string | null
          status?: "Confirmada" | "Check-in" | "Check-out" | "Cancelada" | "No show"
          guests?: number
          checkin_on?: string
          checkout_on?: string
          nightly_rate_cents?: number
          total_cents?: number
          paid_cents?: number
          channel?: string
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hotel_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_deliveries: {
        Row: {
          id: string
          order_id: string
          courier_id: string | null
          address: string
          phone: string
          status: "Pendiente" | "En preparación" | "En camino" | "Entregado" | "Cancelado"
          fee_cents: number
          dispatched_at: string | null
          delivered_at: string | null
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          courier_id?: string | null
          address: string
          phone?: string
          status?: "Pendiente" | "En preparación" | "En camino" | "Entregado" | "Cancelado"
          fee_cents?: number
          dispatched_at?: string | null
          delivered_at?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          courier_id?: string | null
          address?: string
          phone?: string
          status?: "Pendiente" | "En preparación" | "En camino" | "Entregado" | "Cancelado"
          fee_cents?: number
          dispatched_at?: string | null
          delivered_at?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_deliveries_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "restaurant_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_order_items: {
        Row: {
          id: string
          order_id: string
          menu_item_id: string | null
          description: string
          quantity: number
          unit_price_cents: number
          notes: string
          position: number
        }
        Insert: {
          id?: string
          order_id: string
          menu_item_id?: string | null
          description: string
          quantity?: number
          unit_price_cents?: number
          notes?: string
          position?: number
        }
        Update: {
          id?: string
          order_id?: string
          menu_item_id?: string | null
          description?: string
          quantity?: number
          unit_price_cents?: number
          notes?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "restaurant_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_orders: {
        Row: {
          id: string
          org_id: string
          code: string | null
          table_id: string | null
          waiter_id: string | null
          status: "Abierta" | "En cocina" | "Servida" | "Pagada" | "Anulada"
          guests: number
          subtotal_cents: number
          tip_cents: number
          total_cents: number
          opened_at: string
          closed_at: string | null
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
          cash_session_id: string | null
          service_kind: "Salón" | "Domicilio" | "Para llevar"
          site_id: string | null
          payment_method: "Transferencia" | "Efectivo" | "Tarjeta" | "Cheque" | "Otro"
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          table_id?: string | null
          waiter_id?: string | null
          status?: "Abierta" | "En cocina" | "Servida" | "Pagada" | "Anulada"
          guests?: number
          subtotal_cents?: number
          tip_cents?: number
          total_cents?: number
          opened_at?: string
          closed_at?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          cash_session_id?: string | null
          service_kind?: "Salón" | "Domicilio" | "Para llevar"
          site_id?: string | null
          payment_method?: "Transferencia" | "Efectivo" | "Tarjeta" | "Cheque" | "Otro"
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          table_id?: string | null
          waiter_id?: string | null
          status?: "Abierta" | "En cocina" | "Servida" | "Pagada" | "Anulada"
          guests?: number
          subtotal_cents?: number
          tip_cents?: number
          total_cents?: number
          opened_at?: string
          closed_at?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          cash_session_id?: string | null
          service_kind?: "Salón" | "Domicilio" | "Para llevar"
          site_id?: string | null
          payment_method?: "Transferencia" | "Efectivo" | "Tarjeta" | "Cheque" | "Otro"
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_orders_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_orders_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_orders_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_reservations: {
        Row: {
          id: string
          org_id: string
          code: string | null
          table_id: string | null
          guest_name: string
          guest_phone: string
          party_size: number
          reserved_at: string
          status: "Confirmada" | "Sentada" | "Cumplida" | "Cancelada" | "No show"
          order_id: string | null
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          table_id?: string | null
          guest_name: string
          guest_phone?: string
          party_size?: number
          reserved_at: string
          status?: "Confirmada" | "Sentada" | "Cumplida" | "Cancelada" | "No show"
          order_id?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          table_id?: string | null
          guest_name?: string
          guest_phone?: string
          party_size?: number
          reserved_at?: string
          status?: "Confirmada" | "Sentada" | "Cumplida" | "Cancelada" | "No show"
          order_id?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "restaurant_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_reservations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_reservations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      review_cycles: {
        Row: {
          id: string
          org_id: string
          name: string
          status: "Planificado" | "Abierto" | "En calibración" | "Cerrado"
          starts_on: string
          ends_on: string | null
          description: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          status?: "Planificado" | "Abierto" | "En calibración" | "Cerrado"
          starts_on?: string
          ends_on?: string | null
          description?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          status?: "Planificado" | "Abierto" | "En calibración" | "Cerrado"
          starts_on?: string
          ends_on?: string | null
          description?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_cycles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      risks: {
        Row: {
          id: string
          org_id: string
          code: string | null
          category: "Contractual" | "Operacional" | "Cumplimiento" | "Financiero" | "Técnico" | "HSE" | "Rotación" | "Desempeño" | "Sucesión" | "Salud" | "Legal" | "Otro"
          title: string
          employee_id: string | null
          area: string
          severity: "Alta" | "Media" | "Baja"
          detail: string
          action: string
          status: "Abierto" | "Mitigado" | "Cerrado"
          due_on: string | null
          resolved_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          category: "Contractual" | "Operacional" | "Cumplimiento" | "Financiero" | "Técnico" | "HSE" | "Rotación" | "Desempeño" | "Sucesión" | "Salud" | "Legal" | "Otro"
          title?: string
          employee_id?: string | null
          area?: string
          severity: "Alta" | "Media" | "Baja"
          detail?: string
          action?: string
          status?: "Abierto" | "Mitigado" | "Cerrado"
          due_on?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          category?: "Contractual" | "Operacional" | "Cumplimiento" | "Financiero" | "Técnico" | "HSE" | "Rotación" | "Desempeño" | "Sucesión" | "Salud" | "Legal" | "Otro"
          title?: string
          employee_id?: string | null
          area?: string
          severity?: "Alta" | "Media" | "Baja"
          detail?: string
          action?: string
          status?: "Abierto" | "Mitigado" | "Cerrado"
          due_on?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          org_id: string
          role: string
          permission: string
        }
        Insert: {
          org_id: string
          role: string
          permission: string
        }
        Update: {
          org_id?: string
          role?: string
          permission?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_fkey"
            columns: ["permission"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_fkey"
            columns: ["org_id", "role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["org_id", "key"]
          },
        ]
      }
      roles: {
        Row: {
          org_id: string
          key: string
          label: string
          rank: number
          is_system: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          org_id: string
          key: string
          label: string
          rank?: number
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          org_id?: string
          key?: string
          label?: string
          rank?: number
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      room_cleaning_tasks: {
        Row: {
          id: string
          room_id: string
          assigned_id: string | null
          kind: "Limpieza" | "Cambio de ropa" | "Revisión" | "Aseo profundo"
          scheduled_on: string
          done: boolean
          done_on: string | null
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          assigned_id?: string | null
          kind?: "Limpieza" | "Cambio de ropa" | "Revisión" | "Aseo profundo"
          scheduled_on?: string
          done?: boolean
          done_on?: string | null
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          assigned_id?: string | null
          kind?: "Limpieza" | "Cambio de ropa" | "Revisión" | "Aseo profundo"
          scheduled_on?: string
          done?: boolean
          done_on?: string | null
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_cleaning_tasks_assigned_id_fkey"
            columns: ["assigned_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_cleaning_tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hotel_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          id: string
          sales_order_id: string
          product_id: string | null
          quote_item_id: string | null
          description: string
          quantity: number
          unit: string
          unit_price_cents: number
          subtotal_cents: number
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          sales_order_id: string
          product_id?: string | null
          quote_item_id?: string | null
          description: string
          quantity: number
          unit?: string
          unit_price_cents: number
          subtotal_cents: number
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          sales_order_id?: string
          product_id?: string | null
          quote_item_id?: string | null
          description?: string
          quantity?: number
          unit?: string
          unit_price_cents?: number
          subtotal_cents?: number
          position?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          id: string
          org_id: string
          code: string | null
          client_id: string | null
          quote_id: string | null
          status: "Borrador" | "Confirmado" | "En preparación" | "Despachado" | "Entregado" | "Cancelado"
          issued_on: string
          due_on: string | null
          payment_terms: string
          shipping_address: string
          notes: string
          subtotal_cents: number
          discount_cents: number
          tax_cents: number
          total_cents: number
          created_at: string
          updated_at: string
          deleted_at: string | null
          client_name: string
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          client_id?: string | null
          quote_id?: string | null
          status?: "Borrador" | "Confirmado" | "En preparación" | "Despachado" | "Entregado" | "Cancelado"
          issued_on?: string
          due_on?: string | null
          payment_terms?: string
          shipping_address?: string
          notes?: string
          subtotal_cents?: number
          discount_cents?: number
          tax_cents?: number
          total_cents?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          client_name?: string
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          client_id?: string | null
          quote_id?: string | null
          status?: "Borrador" | "Confirmado" | "En preparación" | "Despachado" | "Entregado" | "Cancelado"
          issued_on?: string
          due_on?: string | null
          payment_terms?: string
          shipping_address?: string
          notes?: string
          subtotal_cents?: number
          discount_cents?: number
          tax_cents?: number
          total_cents?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          client_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_reports: {
        Row: {
          id: string
          org_id: string
          name: string
          module_key: string
          period: "hoy" | "semana" | "mes" | "trimestre" | "todo"
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          module_key: string
          period?: "hoy" | "semana" | "mes" | "trimestre" | "todo"
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          module_key?: string
          period?: "hoy" | "semana" | "mes" | "trimestre" | "todo"
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_modules: {
        Row: {
          sector_key: string
          module_key: string
          mode: "add" | "remove"
        }
        Insert: {
          sector_key: string
          module_key: string
          mode?: "add" | "remove"
        }
        Update: {
          sector_key?: string
          module_key?: string
          mode?: "add" | "remove"
        }
        Relationships: [
          {
            foreignKeyName: "sector_modules_sector_key_fkey"
            columns: ["sector_key"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["key"]
          },
        ]
      }
      sector_roles: {
        Row: {
          sector_key: string
          role_key: string
          label: string
          rank: number
          permissions: string[]
        }
        Insert: {
          sector_key: string
          role_key: string
          label: string
          rank?: number
          permissions: string[]
        }
        Update: {
          sector_key?: string
          role_key?: string
          label?: string
          rank?: number
          permissions?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "sector_roles_sector_key_fkey"
            columns: ["sector_key"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["key"]
          },
        ]
      }
      sectors: {
        Row: {
          key: string
          label: string
          parent_key: string | null
          sort: number
          is_active: boolean
        }
        Insert: {
          key: string
          label: string
          parent_key?: string | null
          sort?: number
          is_active?: boolean
        }
        Update: {
          key?: string
          label?: string
          parent_key?: string | null
          sort?: number
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sectors_parent_key_fkey"
            columns: ["parent_key"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["key"]
          },
        ]
      }
      service_plans: {
        Row: {
          id: string
          org_id: string
          name: string
          price_cents: number
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          price_cents: number
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          price_cents?: number
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_requests: {
        Row: {
          id: string
          org_id: string
          code: string | null
          document_id: string | null
          title: string
          signer_id: string | null
          signer_email: string | null
          kind: "Contrato" | "NDA" | "Política" | "Anexo" | "Adenda" | "Acuerdo" | "Terminación" | "Otro"
          status: "Pendiente" | "Firmado" | "Vencido" | "Cancelado"
          requested_on: string
          due_on: string | null
          signed_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          document_id?: string | null
          title: string
          signer_id?: string | null
          signer_email?: string | null
          kind?: "Contrato" | "NDA" | "Política" | "Anexo" | "Adenda" | "Acuerdo" | "Terminación" | "Otro"
          status?: "Pendiente" | "Firmado" | "Vencido" | "Cancelado"
          requested_on?: string
          due_on?: string | null
          signed_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          document_id?: string | null
          title?: string
          signer_id?: string | null
          signer_email?: string | null
          kind?: "Contrato" | "NDA" | "Política" | "Anexo" | "Adenda" | "Acuerdo" | "Terminación" | "Otro"
          status?: "Pendiente" | "Firmado" | "Vencido" | "Cancelado"
          requested_on?: string
          due_on?: string | null
          signed_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          id: string
          org_id: string
          code: string | null
          name: string
          address: string | null
          city: string | null
          phone: string | null
          is_default: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          name: string
          address?: string | null
          city?: string | null
          phone?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          name?: string
          address?: string | null
          city?: string | null
          phone?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      student_attendance: {
        Row: {
          id: string
          org_id: string
          student_id: string
          schedule_id: string | null
          date: string
          present: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          student_id: string
          schedule_id?: string | null
          date: string
          present?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          student_id?: string
          schedule_id?: string | null
          date?: string
          present?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_attendance_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_attendance_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_enrollments: {
        Row: {
          id: string
          student_id: string
          subject: string
          term: string
          teacher_id: string | null
          status: "Inscrito" | "Cursando" | "Aprobado" | "Reprobado" | "Retirado"
          grade: number | null
          attendance_pct: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          subject: string
          term?: string
          teacher_id?: string | null
          status?: "Inscrito" | "Cursando" | "Aprobado" | "Reprobado" | "Retirado"
          grade?: number | null
          attendance_pct?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          subject?: string
          term?: string
          teacher_id?: string | null
          status?: "Inscrito" | "Cursando" | "Aprobado" | "Reprobado" | "Retirado"
          grade?: number | null
          attendance_pct?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      student_grades: {
        Row: {
          id: string
          org_id: string
          enrollment_id: string
          kind: "Parcial" | "Corte" | "Quiz" | "Tarea" | "Examen final" | "Otro"
          grade: number
          weight: number | null
          graded_on: string
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          enrollment_id: string
          kind?: "Parcial" | "Corte" | "Quiz" | "Tarea" | "Examen final" | "Otro"
          grade: number
          weight?: number | null
          graded_on?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          enrollment_id?: string
          kind?: "Parcial" | "Corte" | "Quiz" | "Tarea" | "Examen final" | "Otro"
          grade?: number
          weight?: number | null
          graded_on?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_grades_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_grades_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          id: string
          org_id: string
          code: string | null
          full_name: string
          document_id: string
          birth_date: string | null
          email: string | null
          phone: string
          address: string
          status: "Activo" | "Retirado" | "Graduado" | "Suspendido"
          program_id: string | null
          guardian_name: string
          guardian_phone: string
          enrolled_on: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          full_name: string
          document_id?: string
          birth_date?: string | null
          email?: string | null
          phone?: string
          address?: string
          status?: "Activo" | "Retirado" | "Graduado" | "Suspendido"
          program_id?: string | null
          guardian_name?: string
          guardian_phone?: string
          enrolled_on?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          full_name?: string
          document_id?: string
          birth_date?: string | null
          email?: string | null
          phone?: string
          address?: string
          status?: "Activo" | "Retirado" | "Graduado" | "Suspendido"
          program_id?: string | null
          guardian_name?: string
          guardian_phone?: string
          enrolled_on?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "academic_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      subscribers: {
        Row: {
          id: string
          org_id: string
          plan_id: string | null
          client_id: string | null
          name: string
          address: string | null
          phone: string | null
          status: "activo" | "suspendido" | "cancelado"
          activated_on: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          plan_id?: string | null
          client_id?: string | null
          name: string
          address?: string | null
          phone?: string | null
          status?: "activo" | "suspendido" | "cancelado"
          activated_on?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          plan_id?: string | null
          client_id?: string | null
          name?: string
          address?: string | null
          phone?: string | null
          status?: "activo" | "suspendido" | "cancelado"
          activated_on?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscribers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscribers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscribers_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          id: string
          org_id: string
          name: string
          price_cents: number
          cycle: "diario" | "semanal" | "mensual" | "trimestral" | "semestral" | "anual"
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          price_cents: number
          cycle?: "diario" | "semanal" | "mensual" | "trimestral" | "semestral" | "anual"
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          price_cents?: number
          cycle?: "diario" | "semanal" | "mensual" | "trimestral" | "semestral" | "anual"
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          id: string
          org_id: string
          plan_id: string | null
          client_id: string | null
          status: "activa" | "suspendida" | "cancelada" | "vencida"
          started_on: string
          next_charge_on: string | null
          price_cents: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          plan_id?: string | null
          client_id?: string | null
          status?: "activa" | "suspendida" | "cancelada" | "vencida"
          started_on?: string
          next_charge_on?: string | null
          price_cents?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          plan_id?: string | null
          client_id?: string | null
          status?: "activa" | "suspendida" | "cancelada" | "vencida"
          started_on?: string
          next_charge_on?: string | null
          price_cents?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoice_items: {
        Row: {
          id: string
          supplier_invoice_id: string
          description: string
          quantity: number
          unit_price_cents: number
          position: number
          subtotal_cents: number | null
        }
        Insert: {
          id?: string
          supplier_invoice_id: string
          description: string
          quantity: number
          unit_price_cents?: number
          position?: number
        }
        Update: {
          id?: string
          supplier_invoice_id?: string
          description?: string
          quantity?: number
          unit_price_cents?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoice_items_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          id: string
          org_id: string
          code: string | null
          supplier: string
          issued_on: string
          status: "Pendiente" | "En revisión" | "Pagada" | "Anulada"
          created_at: string
          updated_at: string
          deleted_at: string | null
          supplier_id: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          supplier: string
          issued_on?: string
          status?: "Pendiente" | "En revisión" | "Pagada" | "Anulada"
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          supplier_id?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          supplier?: string
          issued_on?: string
          status?: "Pendiente" | "En revisión" | "Pagada" | "Anulada"
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          id: string
          org_id: string
          supplier_invoice_id: string
          amount_cents: number
          method: string
          reference: string
          paid_on: string | null
          scheduled_on: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          supplier_invoice_id: string
          amount_cents: number
          method?: string
          reference?: string
          paid_on?: string | null
          scheduled_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          supplier_invoice_id?: string
          amount_cents?: number
          method?: string
          reference?: string
          paid_on?: string | null
          scheduled_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          id: string
          org_id: string
          name: string
          tax_id: string
          contact_name: string
          email: string
          phone: string
          city: string
          category: string
          notes: string
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          tax_id?: string
          contact_name?: string
          email?: string
          phone?: string
          city?: string
          category?: string
          notes?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          tax_id?: string
          contact_name?: string
          email?: string
          phone?: string
          city?: string
          category?: string
          notes?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          id: string
          org_id: string
          name: string
          responses: number
          score: number | null
          closed_on: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          responses?: number
          score?: number | null
          closed_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          responses?: number
          score?: number | null
          closed_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          id: string
          ticket_id: string
          author_id: string | null
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          author_id?: string | null
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_portal_tokens: {
        Row: {
          id: string
          org_id: string
          client_id: string
          token_hash: string
          expires_on: string
          revoked_at: string | null
          created_by: string | null
          created_at: string
          last_used_at: string | null
          read_bucket_min: number
          read_bucket_count: number
          write_bucket_min: number
          write_bucket_count: number
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          token_hash: string
          expires_on: string
          revoked_at?: string | null
          created_by?: string | null
          created_at?: string
          last_used_at?: string | null
          read_bucket_min?: number
          read_bucket_count?: number
          write_bucket_min?: number
          write_bucket_count?: number
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          token_hash?: string
          expires_on?: string
          revoked_at?: string | null
          created_by?: string | null
          created_at?: string
          last_used_at?: string | null
          read_bucket_min?: number
          read_bucket_count?: number
          write_bucket_min?: number
          write_bucket_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_portal_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_portal_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          id: string
          org_id: string
          code: string | null
          subject: string
          body: string
          area: "TI" | "Nómina" | "Personas" | "Finanzas" | "Legal" | "Contratos" | "Onboarding" | "Permisos" | "Capacitación" | "Administración" | "Beneficios" | "Otro"
          priority: "Alta" | "Media" | "Baja"
          status: "Abierto" | "En proceso" | "Resuelto" | "Cerrado"
          requester_id: string | null
          assignee_id: string | null
          tags: string[]
          board_position: number
          resolved_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          sla_due_at: string | null
          client_id: string | null
          origin: "Interno" | "Cliente"
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          subject: string
          body?: string
          area?: "TI" | "Nómina" | "Personas" | "Finanzas" | "Legal" | "Contratos" | "Onboarding" | "Permisos" | "Capacitación" | "Administración" | "Beneficios" | "Otro"
          priority?: "Alta" | "Media" | "Baja"
          status?: "Abierto" | "En proceso" | "Resuelto" | "Cerrado"
          requester_id?: string | null
          assignee_id?: string | null
          tags?: string[]
          board_position?: number
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          sla_due_at?: string | null
          client_id?: string | null
          origin?: "Interno" | "Cliente"
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          subject?: string
          body?: string
          area?: "TI" | "Nómina" | "Personas" | "Finanzas" | "Legal" | "Contratos" | "Onboarding" | "Permisos" | "Capacitación" | "Administración" | "Beneficios" | "Otro"
          priority?: "Alta" | "Media" | "Baja"
          status?: "Abierto" | "En proceso" | "Resuelto" | "Cerrado"
          requester_id?: string | null
          assignee_id?: string | null
          tags?: string[]
          board_position?: number
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          sla_due_at?: string | null
          client_id?: string | null
          origin?: "Interno" | "Cliente"
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          id: string
          org_id: string
          employee_id: string | null
          project_id: string | null
          work_date: string
          minutes: number
          rate_cents: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          employee_id?: string | null
          project_id?: string | null
          work_date?: string
          minutes: number
          rate_cents?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          employee_id?: string | null
          project_id?: string | null
          work_date?: string
          minutes?: number
          rate_cents?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_items: {
        Row: {
          id: string
          plan_id: string
          tooth: number | null
          surface: "Oclusal" | "Mesial" | "Distal" | "Vestibular" | "Lingual" | "Palatina" | null
          procedure: string
          product_id: string | null
          price_cents: number
          status: "Pendiente" | "En curso" | "Hecho" | "Cancelado"
          done_on: string | null
          professional_id: string | null
          notes: string
          sort: number
          created_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          tooth?: number | null
          surface?: "Oclusal" | "Mesial" | "Distal" | "Vestibular" | "Lingual" | "Palatina" | null
          procedure: string
          product_id?: string | null
          price_cents?: number
          status?: "Pendiente" | "En curso" | "Hecho" | "Cancelado"
          done_on?: string | null
          professional_id?: string | null
          notes?: string
          sort?: number
          created_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          tooth?: number | null
          surface?: "Oclusal" | "Mesial" | "Distal" | "Vestibular" | "Lingual" | "Palatina" | null
          procedure?: string
          product_id?: string | null
          price_cents?: number
          status?: "Pendiente" | "En curso" | "Hecho" | "Cancelado"
          done_on?: string | null
          professional_id?: string | null
          notes?: string
          sort?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          id: string
          org_id: string
          patient_id: string
          code: string | null
          professional_id: string | null
          status: "Propuesto" | "Aceptado" | "En curso" | "Terminado" | "Rechazado"
          proposed_on: string
          accepted_on: string | null
          total_cents: number
          quote_id: string | null
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          patient_id: string
          code?: string | null
          professional_id?: string | null
          status?: "Propuesto" | "Aceptado" | "En curso" | "Terminado" | "Rechazado"
          proposed_on?: string
          accepted_on?: string | null
          total_cents?: number
          quote_id?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          patient_id?: string
          code?: string | null
          professional_id?: string | null
          status?: "Propuesto" | "Aceptado" | "En curso" | "Terminado" | "Rechazado"
          proposed_on?: string
          accepted_on?: string | null
          total_cents?: number
          quote_id?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_balances: {
        Row: {
          id: string
          org_id: string
          employee_id: string
          year: number
          entitled_days: number
          taken_days: number
          created_at: string
          updated_at: string
          available_days: number | null
        }
        Insert: {
          id?: string
          org_id: string
          employee_id: string
          year: number
          entitled_days?: number
          taken_days?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          employee_id?: string
          year?: number
          entitled_days?: number
          taken_days?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_balances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_services: {
        Row: {
          id: string
          vehicle_id: string
          kind: "Preventivo" | "Correctivo" | "Predictivo" | "Mejora"
          description: string
          provider: string
          odometer_km: number | null
          cost_cents: number
          serviced_on: string
          next_service_on: string | null
          created_at: string
        }
        Insert: {
          id?: string
          vehicle_id: string
          kind?: "Preventivo" | "Correctivo" | "Predictivo" | "Mejora"
          description?: string
          provider?: string
          odometer_km?: number | null
          cost_cents?: number
          serviced_on?: string
          next_service_on?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          vehicle_id?: string
          kind?: "Preventivo" | "Correctivo" | "Predictivo" | "Mejora"
          description?: string
          provider?: string
          odometer_km?: number | null
          cost_cents?: number
          serviced_on?: string
          next_service_on?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_services_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          id: string
          org_id: string
          plate: string
          kind: "Automóvil" | "Camioneta" | "Camión" | "Motocicleta" | "Maquinaria" | "Otro"
          brand: string
          model: string
          model_year: number | null
          fuel: "Gasolina" | "Diésel" | "Gas" | "Eléctrico" | "Híbrido"
          status: "Disponible" | "En ruta" | "En taller" | "Fuera de servicio" | "Dado de baja"
          driver_id: string | null
          odometer_km: number
          capacity_kg: number | null
          soat_expires_on: string | null
          inspection_expires_on: string | null
          insurance_expires_on: string | null
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          plate: string
          kind?: "Automóvil" | "Camioneta" | "Camión" | "Motocicleta" | "Maquinaria" | "Otro"
          brand?: string
          model?: string
          model_year?: number | null
          fuel?: "Gasolina" | "Diésel" | "Gas" | "Eléctrico" | "Híbrido"
          status?: "Disponible" | "En ruta" | "En taller" | "Fuera de servicio" | "Dado de baja"
          driver_id?: string | null
          odometer_km?: number
          capacity_kg?: number | null
          soat_expires_on?: string | null
          inspection_expires_on?: string | null
          insurance_expires_on?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          plate?: string
          kind?: "Automóvil" | "Camioneta" | "Camión" | "Motocicleta" | "Maquinaria" | "Otro"
          brand?: string
          model?: string
          model_year?: number | null
          fuel?: "Gasolina" | "Diésel" | "Gas" | "Eléctrico" | "Híbrido"
          status?: "Disponible" | "En ruta" | "En taller" | "Fuera de servicio" | "Dado de baja"
          driver_id?: string | null
          odometer_km?: number
          capacity_kg?: number | null
          soat_expires_on?: string | null
          inspection_expires_on?: string | null
          insurance_expires_on?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_hospitalization_notes: {
        Row: {
          id: string
          hospitalization_id: string
          note: string
          noted_at: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          hospitalization_id: string
          note: string
          noted_at?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          hospitalization_id?: string
          note?: string
          noted_at?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_hospitalization_notes_hospitalization_id_fkey"
            columns: ["hospitalization_id"]
            isOneToOne: false
            referencedRelation: "vet_hospitalizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_hospitalizations: {
        Row: {
          id: string
          org_id: string
          pet_id: string
          admission_on: string
          discharge_on: string | null
          reason: string
          status: "Hospitalizado" | "Alta" | "Fallecido"
          kennel: string
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          pet_id: string
          admission_on?: string
          discharge_on?: string | null
          reason: string
          status?: "Hospitalizado" | "Alta" | "Fallecido"
          kennel?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          pet_id?: string
          admission_on?: string
          discharge_on?: string | null
          reason?: string
          status?: "Hospitalizado" | "Alta" | "Fallecido"
          kennel?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_hospitalizations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_hospitalizations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "vet_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_pets: {
        Row: {
          id: string
          org_id: string
          patient_id: string
          name: string
          species: "Perro" | "Gato" | "Ave" | "Equino" | "Bovino" | "Exótico" | "Otro"
          breed: string
          sex: "Macho" | "Hembra" | "Desconocido"
          birth_date: string | null
          weight_kg: number | null
          color: string
          microchip: string
          status: "Activo" | "Fallecido" | "Adoptado" | "Perdido"
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          patient_id: string
          name: string
          species?: "Perro" | "Gato" | "Ave" | "Equino" | "Bovino" | "Exótico" | "Otro"
          breed?: string
          sex?: "Macho" | "Hembra" | "Desconocido"
          birth_date?: string | null
          weight_kg?: number | null
          color?: string
          microchip?: string
          status?: "Activo" | "Fallecido" | "Adoptado" | "Perdido"
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          patient_id?: string
          name?: string
          species?: "Perro" | "Gato" | "Ave" | "Equino" | "Bovino" | "Exótico" | "Otro"
          breed?: string
          sex?: "Macho" | "Hembra" | "Desconocido"
          birth_date?: string | null
          weight_kg?: number | null
          color?: string
          microchip?: string
          status?: "Activo" | "Fallecido" | "Adoptado" | "Perdido"
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vet_pets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_pets_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_vaccines: {
        Row: {
          id: string
          pet_id: string
          vaccine: string
          administered_on: string
          next_due_on: string | null
          batch: string
          professional_id: string | null
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          pet_id: string
          vaccine: string
          administered_on?: string
          next_due_on?: string | null
          batch?: string
          professional_id?: string | null
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          pet_id?: string
          vaccine?: string
          administered_on?: string
          next_due_on?: string | null
          batch?: string
          professional_id?: string | null
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_vaccines_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "vet_pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_vaccines_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_tasks: {
        Row: {
          id: string
          work_order_id: string
          description: string
          done: boolean
          position: number
        }
        Insert: {
          id?: string
          work_order_id: string
          description: string
          done?: boolean
          position?: number
        }
        Update: {
          id?: string
          work_order_id?: string
          description?: string
          done?: boolean
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_order_tasks_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          id: string
          org_id: string
          code: string | null
          title: string
          kind: "Preventivo" | "Correctivo" | "Predictivo" | "Mejora"
          status: "Abierta" | "Programada" | "En ejecución" | "Completada" | "Cancelada"
          priority: "Alta" | "Media" | "Baja"
          asset_id: string | null
          asset_label: string
          project_id: string | null
          assignee_id: string | null
          location: string
          detail: string
          scheduled_on: string | null
          completed_at: string | null
          downtime_hours: number
          labor_cost_cents: number
          parts_cost_cents: number
          recurrence_days: number | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          site_id: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          title: string
          kind?: "Preventivo" | "Correctivo" | "Predictivo" | "Mejora"
          status?: "Abierta" | "Programada" | "En ejecución" | "Completada" | "Cancelada"
          priority?: "Alta" | "Media" | "Baja"
          asset_id?: string | null
          asset_label?: string
          project_id?: string | null
          assignee_id?: string | null
          location?: string
          detail?: string
          scheduled_on?: string | null
          completed_at?: string | null
          downtime_hours?: number
          labor_cost_cents?: number
          parts_cost_cents?: number
          recurrence_days?: number | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          site_id?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          title?: string
          kind?: "Preventivo" | "Correctivo" | "Predictivo" | "Mejora"
          status?: "Abierta" | "Programada" | "En ejecución" | "Completada" | "Cancelada"
          priority?: "Alta" | "Media" | "Baja"
          asset_id?: string | null
          asset_label?: string
          project_id?: string | null
          assignee_id?: string | null
          location?: string
          detail?: string
          scheduled_on?: string | null
          completed_at?: string | null
          downtime_hours?: number
          labor_cost_cents?: number
          parts_cost_cents?: number
          recurrence_days?: number | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "inventory_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: Record<never, never>
    Functions: {
      apply_subscription: {
        Args: { p_account_id: string; p_plan?: string | null; p_status?: string | null }
        Returns: undefined
      }
      match_document_chunks: {
        Args: {
          query_embedding: unknown
          p_org_id: string
          match_threshold?: number
          match_count?: number
        }
        Returns: {
          id: string
          document_id: string
          content: string
          chunk_index: number
          metadata: Json | null
          similarity: number
        }[]
      }
      reserve_ai_budget: {
        Args: { p_org_id: string; p_month_start: string; p_cost_cents: number }
        Returns: { allowed: boolean; reserved_cents: number; limit_cents: number }[]
      }
      account_companies: {
        Args: Record<PropertyKey, never>
        Returns: {
          org_id: string
          name: string
          slug: string
          company_type: string | null
          account_id: string
          joined: boolean
        }[]
      }
      complete_onboarding: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      complete_company_setup: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      can_change_sector: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      create_account: {
        Args: { p_name: string; p_company_name: string; p_sector?: string | null }
        Returns: string
      }
      create_company: {
        Args: { p_name: string; p_sector?: string | null; p_account_id?: string | null }
        Returns: string
      }
      join_company: {
        Args: { p_org_id: string; p_role: string }
        Returns: boolean
      }
      place_storefront_order: {
        Args: { p_org_id: string; p_items: Json }
        Returns: {
          order_code: string
          order_item: string
          order_quantity: number
          order_price_cents: number
        }[]
      }
      register_pos_sale: {
        Args: {
          p_org_id: string
          p_items: Json
          p_payment_method?: string
          p_customer_name?: string
          p_discount_cents?: number
          p_notes?: string
          p_pending?: boolean
        }
        Returns: { sale_id: string; sale_code: string; sale_total_cents: number }[]
      }
      void_pos_sale: {
        Args: { p_sale_id: string }
        Returns: boolean
      }
      rate_limit_hit: {
        Args: { p_bucket: string; p_limit: number; p_window_secs: number }
        Returns: { allowed: boolean; remaining: number; reset_at: string }[]
      }
      set_active_company: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      seed_suggested_roles: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      obra_register_avance: {
        Args: {
          p_capitulo_id: string
          p_fecha: string
          p_avance: number
          p_valor: number
          p_notas: string | null
        }
        Returns: string
      }
      obra_delete_avance: {
        Args: { p_id: string }
        Returns: undefined
      }
      obra_resync_presupuesto: {
        Args: { p_presupuesto_id: string }
        Returns: undefined
      }
      portal_create: {
        Args: {
          p_kind: string
          p_target_id: string
          p_label: string
          p_days?: number
          p_max_views?: number | null
        }
        Returns: string
      }
      portal_view: {
        Args: { p_token: string }
        Returns: {
          error?: string
          kind?: string
          org?: string | null
          payload?: Record<string, unknown> | null
        } | null
      }
      create_ticket_portal_token: {
        Args: { p_client_id: string; p_days?: number }
        Returns: string
      }
      revoke_ticket_portal_tokens: {
        Args: { p_client_id: string }
        Returns: number
      }
      portal_tickets: {
        Args: { p_token: string }
        Returns: {
          code?: string
          subject?: string
          status?: string
          created_at?: string
          body?: string
        }[]
      }
      portal_ticket_comments: {
        Args: { p_token: string; p_code: string }
        Returns: {
          author?: string
          body?: string
          created_at?: string
        }[]
      }
      portal_open_ticket: {
        Args: { p_token: string; p_subject: string; p_body: string }
        Returns: string
      }
      portal_reply_ticket: {
        Args: { p_token: string; p_code: string; p_body: string }
        Returns: undefined
      }
      lock_payroll_period: {
        Args: { p_period_id: string }
        Returns: undefined
      }
      export_payroll_pila: {
        Args: { p_period_id: string }
        Returns: {
          tipo_documento: string
          documento: string
          nombre: string
          tipo_cotizante: string
          salario_base_cents: number
          salud_cents: number
          pension_cents: number
          arl_cents: number
          caja_cents: number
          total_aportes_cents: number
        }[]
      }
      integraciones_set_secret: {
        Args: { p_name: string; p_value: string }
        Returns: undefined
      }
      integraciones_get_secret: {
        Args: { p_name: string }
        Returns: string
      }
      integraciones_has_secret: {
        Args: { p_org_id: string; p_kind: string; p_field: string }
        Returns: boolean
      }
      hotel_rate_for: {
        Args: { p_room_id: string; p_date: string }
        Returns: number | null
      }
      leads_convert: {
        Args: { p_lead_id: string }
        Returns: string
      }
      reset_pipeline_stages: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      register_supplier_payment: {
        Args: {
          p_invoice_id: string
          p_amount_cents: number
          p_method?: string
          p_reference?: string
          p_paid_on?: string | null
          p_scheduled_on?: string | null
        }
        Returns: string
      }
      create_order_from_quote: {
        Args: {
          p_quote_id: string
          p_issued_on?: string | null
          p_due_on?: string | null
          p_payment_terms?: string
          p_shipping_address?: string
          p_notes?: string
        }
        Returns: string
      }
      post_auto_entry: {
        Args: {
          p_org_id: string
          p_concepto: string
          p_source: string
          p_source_id: string
          p_memo: string
          p_entry_date: string
          p_amount_cents: number
        }
        Returns: string
      }
      confirm_pos_payment: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      reject_pos_payment: {
        Args: { p_event_id: string }
        Returns: boolean
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

type PublicTables = Database['public']['Tables']
export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row']
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]['Insert']
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]['Update']

export type EmployeeStatus = "Activo" | "Inactivo" | "Onboarding" | "En licencia" | "Salida"
export type TicketStatus = "Abierto" | "En proceso" | "Resuelto" | "Cerrado"
export type TicketPriority = "Alta" | "Media" | "Baja"
export type TicketArea = "TI" | "Nómina" | "Personas" | "Finanzas" | "Legal" | "Contratos" | "Onboarding" | "Permisos" | "Capacitación" | "Administración" | "Beneficios" | "Otro"
export type SignatureStatus = "Pendiente" | "Firmado" | "Vencido" | "Cancelado"
export type SignatureKind = "Contrato" | "NDA" | "Política" | "Anexo" | "Adenda" | "Acuerdo" | "Terminación" | "Otro"
export type DocumentStatus = "Vigente" | "Borrador" | "Archivado" | "Vencido"
export type DocumentKind = "Contrato" | "Política" | "Acta" | "Plan" | "Manual" | "Anexo" | "Otro"
export type InventoryStatus = "Asignado" | "Disponible" | "Mantenimiento" | "Baja"
export type InventoryCategory = "Cómputo" | "Monitor" | "Móvil" | "Tablet" | "Periférico" | "Mobiliario" | "Herramientas" | "Vehículos" | "Electrónica" | "Otro"
export type RiskSeverity = "Alta" | "Media" | "Baja"
export type RiskStatus = "Abierto" | "Mitigado" | "Cerrado"
export type RiskCategory = "Contractual" | "Operacional" | "Cumplimiento" | "Financiero" | "Técnico" | "HSE" | "Rotación" | "Desempeño" | "Sucesión" | "Salud" | "Legal" | "Otro"
export type AbsenceKind = "Vacaciones" | "Incapacidad" | "Permiso" | "Licencia" | "Cita médica" | "Otro"
export type AbsenceStatus = "Programada" | "Activa" | "Finalizada" | "Resuelta" | "Rechazada"
export type ProjectStatus = "Planificación" | "En ejecución" | "En pausa" | "Finalizado" | "Cancelado"
