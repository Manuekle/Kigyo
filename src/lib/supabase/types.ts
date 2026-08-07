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
          stage: "Aplicación" | "Revisión" | "Entrevista" | "Oferta" | "Contratado" | "Descartado"
          score: number | null
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_opening_id: string
          full_name: string
          email?: string | null
          stage?: "Aplicación" | "Revisión" | "Entrevista" | "Oferta" | "Contratado" | "Descartado"
          score?: number | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_opening_id?: string
          full_name?: string
          email?: string | null
          stage?: "Aplicación" | "Revisión" | "Entrevista" | "Oferta" | "Contratado" | "Descartado"
          score?: number | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
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
      course_enrollments: {
        Row: {
          id: string
          course_id: string
          employee_id: string
          status: "Inscrito" | "En curso" | "Completado" | "Abandonado"
          completed_on: string | null
        }
        Insert: {
          id?: string
          course_id: string
          employee_id: string
          status?: "Inscrito" | "En curso" | "Completado" | "Abandonado"
          completed_on?: string | null
        }
        Update: {
          id?: string
          course_id?: string
          employee_id?: string
          status?: "Inscrito" | "En curso" | "Completado" | "Abandonado"
          completed_on?: string | null
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
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          category?: string
          duration_hours?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          category?: string
          duration_hours?: number | null
          created_at?: string
          updated_at?: string
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
          status: "Pendiente" | "En revisión" | "Completada"
          evaluated_on: string | null
          created_at: string
          updated_at: string
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
          status?: "Pendiente" | "En revisión" | "Completada"
          evaluated_on?: string | null
          created_at?: string
          updated_at?: string
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
          status?: "Pendiente" | "En revisión" | "Completada"
          evaluated_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
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
      job_openings: {
        Row: {
          id: string
          org_id: string
          code: string | null
          title: string
          department: string
          employment_type: "Tiempo completo" | "Medio tiempo" | "Contrato" | "Prácticas"
          status: "Activo" | "Pausado" | "Cerrado"
          opened_on: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          code?: string | null
          title: string
          department?: string
          employment_type?: "Tiempo completo" | "Medio tiempo" | "Contrato" | "Prácticas"
          status?: "Activo" | "Pausado" | "Cerrado"
          opened_on?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          code?: string | null
          title?: string
          department?: string
          employment_type?: "Tiempo completo" | "Medio tiempo" | "Contrato" | "Prácticas"
          status?: "Activo" | "Pausado" | "Cerrado"
          opened_on?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_openings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          industry: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          industry?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          industry?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
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
