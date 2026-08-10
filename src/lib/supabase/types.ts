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
        }
        Relationships: [
          {
            foreignKeyName: "dining_tables_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          access_role: string
          manager_id: string | null
          hired_on: string | null
          ended_on: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
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
          access_role?: string
          manager_id?: string | null
          hired_on?: string | null
          ended_on?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
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
          access_role?: string
          manager_id?: string | null
          hired_on?: string | null
          ended_on?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_access_role_fkey"
            columns: ["access_role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
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
        }
        Relationships: [
          {
            foreignKeyName: "hotel_rooms_org_id_fkey"
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
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
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
      memberships: {
        Row: {
          id: string
          org_id: string
          user_id: string
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          role: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          role?: string
          created_at?: string
          updated_at?: string
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
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
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
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          industry: string | null
          created_at: string
          updated_at: string
          company_type: "construccion" | "energia" | "manufactura" | "comercio" | "ecommerce" | "servicios" | "tecnologia" | "salud" | "educacion" | "logistica" | "alimentos" | "agro" | "inmobiliario" | "hoteleria" | "financiero" | "mineria" | "telecomunicaciones" | "seguridad" | "medios" | "ong" | "gobierno" | "otro" | null
          enabled_modules: string[]
          plan: "starter" | "growth" | "enterprise"
        }
        Insert: {
          id?: string
          name: string
          slug: string
          industry?: string | null
          created_at?: string
          updated_at?: string
          company_type?: "construccion" | "energia" | "manufactura" | "comercio" | "ecommerce" | "servicios" | "tecnologia" | "salud" | "educacion" | "logistica" | "alimentos" | "agro" | "inmobiliario" | "hoteleria" | "financiero" | "mineria" | "telecomunicaciones" | "seguridad" | "medios" | "ong" | "gobierno" | "otro" | null
          enabled_modules?: string[]
          plan?: "starter" | "growth" | "enterprise"
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          industry?: string | null
          created_at?: string
          updated_at?: string
          company_type?: "construccion" | "energia" | "manufactura" | "comercio" | "ecommerce" | "servicios" | "tecnologia" | "salud" | "educacion" | "logistica" | "alimentos" | "agro" | "inmobiliario" | "hoteleria" | "financiero" | "mineria" | "telecomunicaciones" | "seguridad" | "medios" | "ong" | "gobierno" | "otro" | null
          enabled_modules?: string[]
          plan?: "starter" | "growth" | "enterprise"
        }
        Relationships: [
        ]
      }
      patient_visits: {
        Row: {
          id: string
          patient_id: string
          kind: "Consulta" | "Control" | "Urgencia" | "Procedimiento" | "Teleconsulta"
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
          kind?: "Consulta" | "Control" | "Urgencia" | "Procedimiento" | "Teleconsulta"
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
          kind?: "Consulta" | "Control" | "Urgencia" | "Procedimiento" | "Teleconsulta"
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
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          period: string
          status?: "Borrador" | "En revisión" | "Aprobada" | "Pagada"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          period?: string
          status?: "Borrador" | "En revisión" | "Aprobada" | "Pagada"
          created_at?: string
          updated_at?: string
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
        }
        Relationships: [
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
      roles: {
        Row: {
          key: string
          label: string
          rank: number
        }
        Insert: {
          key: string
          label: string
          rank: number
        }
        Update: {
          key?: string
          label?: string
          rank?: number
        }
        Relationships: [
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
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_org_id_fkey"
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
        ]
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
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
