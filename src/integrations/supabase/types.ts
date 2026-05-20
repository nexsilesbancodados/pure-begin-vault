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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts_payable: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          import_job_id: string | null
          notes: string | null
          organization_id: string
          paid_amount: number | null
          paid_at: string | null
          status: string
          supplier_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          created_at?: string
          description: string
          due_date: string
          id?: string
          import_job_id?: string | null
          notes?: string | null
          organization_id: string
          paid_amount?: number | null
          paid_at?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          import_job_id?: string | null
          notes?: string | null
          organization_id?: string
          paid_amount?: number | null
          paid_at?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      accounts_receivable: {
        Row: {
          amount: number
          created_at: string
          customer_id: string | null
          description: string
          due_date: string
          id: string
          import_job_id: string | null
          notes: string | null
          organization_id: string
          paid_amount: number | null
          paid_at: string | null
          sale_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id?: string | null
          description: string
          due_date: string
          id?: string
          import_job_id?: string | null
          notes?: string | null
          organization_id: string
          paid_amount?: number | null
          paid_at?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          description?: string
          due_date?: string
          id?: string
          import_job_id?: string | null
          notes?: string | null
          organization_id?: string
          paid_amount?: number | null
          paid_at?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      affiliate_codes: {
        Row: {
          code: string
          commission_percent: number | null
          created_at: string | null
          id: string
          organization_id: string | null
          total_paid_cents: number | null
          total_referrals: number | null
          user_id: string
        }
        Insert: {
          code: string
          commission_percent?: number | null
          created_at?: string | null
          id?: string
          organization_id?: string | null
          total_paid_cents?: number | null
          total_referrals?: number | null
          user_id: string
        }
        Update: {
          code?: string
          commission_percent?: number | null
          created_at?: string | null
          id?: string
          organization_id?: string | null
          total_paid_cents?: number | null
          total_referrals?: number | null
          user_id?: string
        }
        Relationships: []
      }
      affiliate_referrals: {
        Row: {
          affiliate_code_id: string | null
          affiliate_user_id: string
          created_at: string | null
          first_payment_at: string | null
          id: string
          referred_user_id: string
          status: string | null
          total_paid_cents: number | null
        }
        Insert: {
          affiliate_code_id?: string | null
          affiliate_user_id: string
          created_at?: string | null
          first_payment_at?: string | null
          id?: string
          referred_user_id: string
          status?: string | null
          total_paid_cents?: number | null
        }
        Update: {
          affiliate_code_id?: string | null
          affiliate_user_id?: string
          created_at?: string | null
          first_payment_at?: string | null
          id?: string
          referred_user_id?: string
          status?: string | null
          total_paid_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_code_id_fkey"
            columns: ["affiliate_code_id"]
            isOneToOne: false
            referencedRelation: "affiliate_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          revoked_at: string | null
          scopes: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          revoked_at?: string | null
          scopes?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          revoked_at?: string | null
          scopes?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          organization_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      automation_installs: {
        Row: {
          body: string
          channel: string
          conditions: Json | null
          created_at: string | null
          delay_minutes: number | null
          id: string
          is_active: boolean | null
          last_run_at: string | null
          organization_id: string
          subject: string | null
          template_id: string | null
          total_failures: number | null
          total_runs: number | null
          trigger_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          channel: string
          conditions?: Json | null
          created_at?: string | null
          delay_minutes?: number | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          organization_id: string
          subject?: string | null
          template_id?: string | null
          total_failures?: number | null
          total_runs?: number | null
          trigger_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          channel?: string
          conditions?: Json | null
          created_at?: string | null
          delay_minutes?: number | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          organization_id?: string
          subject?: string | null
          template_id?: string | null
          total_failures?: number | null
          total_runs?: number | null
          trigger_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_installs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "automation_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          channel: string
          error: string | null
          id: string
          install_id: string | null
          organization_id: string
          ran_at: string | null
          rendered_body: string | null
          status: string
          target_email: string | null
          target_phone: string | null
          trigger_type: string
        }
        Insert: {
          channel: string
          error?: string | null
          id?: string
          install_id?: string | null
          organization_id: string
          ran_at?: string | null
          rendered_body?: string | null
          status?: string
          target_email?: string | null
          target_phone?: string | null
          trigger_type: string
        }
        Update: {
          channel?: string
          error?: string | null
          id?: string
          install_id?: string | null
          organization_id?: string
          ran_at?: string | null
          rendered_body?: string | null
          status?: string
          target_email?: string | null
          target_phone?: string | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_install_id_fkey"
            columns: ["install_id"]
            isOneToOne: false
            referencedRelation: "automation_installs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          action_type: string
          automation_id: string
          created_at: string
          error: string | null
          id: string
          payload: Json | null
          status: string
          trigger_type: string
          user_id: string
        }
        Insert: {
          action_type: string
          automation_id: string
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json | null
          status: string
          trigger_type: string
          user_id: string
        }
        Update: {
          action_type?: string
          automation_id?: string
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json | null
          status?: string
          trigger_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_templates: {
        Row: {
          active_by_default: boolean | null
          category: string
          channel: string
          created_at: string | null
          default_body: string
          default_delay_minutes: number | null
          default_subject: string | null
          description: string | null
          id: string
          name: string
          recommended: boolean | null
          trigger_type: string
          variables: string[] | null
        }
        Insert: {
          active_by_default?: boolean | null
          category: string
          channel: string
          created_at?: string | null
          default_body: string
          default_delay_minutes?: number | null
          default_subject?: string | null
          description?: string | null
          id?: string
          name: string
          recommended?: boolean | null
          trigger_type: string
          variables?: string[] | null
        }
        Update: {
          active_by_default?: boolean | null
          category?: string
          channel?: string
          created_at?: string | null
          default_body?: string
          default_delay_minutes?: number | null
          default_subject?: string | null
          description?: string | null
          id?: string
          name?: string
          recommended?: boolean | null
          trigger_type?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      automations: {
        Row: {
          action_type: string
          config: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          trigger_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_conversations: {
        Row: {
          contact_name: string | null
          contact_phone: string
          created_at: string
          id: string
          last_message_at: string | null
          messages_count: number | null
          organization_id: string
          status: string | null
          transcript: Json | null
          user_id: string
        }
        Insert: {
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          messages_count?: number | null
          organization_id: string
          status?: string | null
          transcript?: Json | null
          user_id: string
        }
        Update: {
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          messages_count?: number | null
          organization_id?: string
          status?: string | null
          transcript?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          organization_id: string
          updated_at: string
          user_id: string
          whatsapp_instance: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id: string
          updated_at?: string
          user_id: string
          whatsapp_instance?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string
          updated_at?: string
          user_id?: string
          whatsapp_instance?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          audience: Json | null
          body: string
          completed_at: string | null
          created_at: string | null
          failed_count: number | null
          id: string
          name: string
          organization_id: string
          scheduled_at: string | null
          sent_count: number | null
          started_at: string | null
          status: string
          total_targets: number | null
          user_id: string
        }
        Insert: {
          audience?: Json | null
          body: string
          completed_at?: string | null
          created_at?: string | null
          failed_count?: number | null
          id?: string
          name: string
          organization_id: string
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          total_targets?: number | null
          user_id: string
        }
        Update: {
          audience?: Json | null
          body?: string
          completed_at?: string | null
          created_at?: string | null
          failed_count?: number | null
          id?: string
          name?: string
          organization_id?: string
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          total_targets?: number | null
          user_id?: string
        }
        Relationships: []
      }
      business_goals: {
        Row: {
          created_at: string
          current_value: number | null
          deadline: string | null
          id: string
          organization_id: string
          target_value: number
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          id?: string
          organization_id: string
          target_value: number
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          id?: string
          organization_id?: string
          target_value?: number
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          attendees: string[] | null
          color: string | null
          created_at: string | null
          description: string | null
          end_time: string | null
          id: string
          location: string | null
          organization_id: string | null
          reminder_minutes: number | null
          start_time: string
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          attendees?: string[] | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          organization_id?: string | null
          reminder_minutes?: number | null
          start_time: string
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          attendees?: string[] | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          organization_id?: string | null
          reminder_minutes?: number | null
          start_time?: string
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register_movements: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          organization_id: string
          reference_id: string | null
          reference_type: string | null
          session_id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          organization_id: string
          reference_id?: string | null
          reference_type?: string | null
          session_id: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string
          reference_id?: string | null
          reference_type?: string | null
          session_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_register_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register_sessions: {
        Row: {
          closed_at: string | null
          closing_amount: number | null
          difference: number | null
          expected_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          opening_amount: number
          organization_id: string
          status: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          closing_amount?: number | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_amount?: number
          organization_id: string
          status?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          closing_amount?: number | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_amount?: number
          organization_id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      chart_of_accounts: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string | null
          parent_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          parent_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          parent_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_task_completions: {
        Row: {
          completed_at: string
          date: string
          id: string
          organization_id: string
          template_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          date: string
          id?: string
          organization_id: string
          template_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          date?: string
          id?: string
          organization_id?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_task_completions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "daily_task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_task_templates: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          organization_id: string
          position: number
          priority: string
          time_label: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          organization_id: string
          position?: number
          priority?: string
          time_label?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          position?: number
          priority?: string
          time_label?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          address: string
          created_at: string | null
          customer_name: string
          customer_phone: string | null
          delivered_at: string | null
          driver_name: string | null
          driver_phone: string | null
          fee: number | null
          id: string
          notes: string | null
          organization_id: string
          sale_order_id: string | null
          scheduled_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address: string
          created_at?: string | null
          customer_name: string
          customer_phone?: string | null
          delivered_at?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          fee?: number | null
          id?: string
          notes?: string | null
          organization_id: string
          sale_order_id?: string | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string
          created_at?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivered_at?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          fee?: number | null
          id?: string
          notes?: string | null
          organization_id?: string
          sale_order_id?: string | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          organization_id: string
          position: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          organization_id: string
          position?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          organization_id?: string
          position?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string
          description: string | null
          id: string
          import_job_id: string | null
          organization_id: string | null
          payment_method: string | null
          reference_id: string | null
          reference_type: string | null
          transaction_date: string
          type: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          import_job_id?: string | null
          organization_id?: string | null
          payment_method?: string | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
          type: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          import_job_id?: string | null
          organization_id?: string | null
          payment_method?: string | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stages: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          order: number | null
          organization_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          order?: number | null
          organization_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          order?: number | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_review_requests: {
        Row: {
          clicked_at: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          link_sent: string | null
          organization_id: string
          reviewed: boolean | null
          sale_order_id: string | null
          sent_at: string | null
        }
        Insert: {
          clicked_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          link_sent?: string | null
          organization_id: string
          reviewed?: boolean | null
          sale_order_id?: string | null
          sent_at?: string | null
        }
        Update: {
          clicked_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          link_sent?: string | null
          organization_id?: string
          reviewed?: boolean | null
          sale_order_id?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_review_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_reviews_config: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          message_template: string | null
          organization_id: string
          place_id: string | null
          send_after_hours: number | null
          short_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          message_template?: string | null
          organization_id: string
          place_id?: string | null
          send_after_hours?: number | null
          short_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          message_template?: string | null
          organization_id?: string
          place_id?: string | null
          send_after_hours?: number | null
          short_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_reviews_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      import_history: {
        Row: {
          created_at: string
          errors: Json
          filename: string
          id: string
          imported_rows: number
          organization_id: string
          status: string
          total_rows: number
          user_id: string
        }
        Insert: {
          created_at?: string
          errors?: Json
          filename: string
          id?: string
          imported_rows?: number
          organization_id: string
          status?: string
          total_rows?: number
          user_id: string
        }
        Update: {
          created_at?: string
          errors?: Json
          filename?: string
          id?: string
          imported_rows?: number
          organization_id?: string
          status?: string
          total_rows?: number
          user_id?: string
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          created_at: string
          error: string | null
          file_name: string
          finished_at: string | null
          id: string
          organization_id: string
          payload: Json
          processed: number
          result: Json | null
          started_at: string | null
          status: string
          step: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          file_name: string
          finished_at?: string | null
          id?: string
          organization_id: string
          payload?: Json
          processed?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          step?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          file_name?: string
          finished_at?: string | null
          id?: string
          organization_id?: string
          payload?: Json
          processed?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          step?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_accounts: {
        Row: {
          access_token: string | null
          account_id: string | null
          auto_reply_keywords: boolean | null
          auto_reply_stories: boolean | null
          comments_24h: number | null
          connected: boolean | null
          created_at: string | null
          id: string
          notes: string | null
          organization_id: string
          pending_messages: number | null
          updated_at: string | null
          user_id: string | null
          username: string
        }
        Insert: {
          access_token?: string | null
          account_id?: string | null
          auto_reply_keywords?: boolean | null
          auto_reply_stories?: boolean | null
          comments_24h?: number | null
          connected?: boolean | null
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          pending_messages?: number | null
          updated_at?: string | null
          user_id?: string | null
          username: string
        }
        Update: {
          access_token?: string | null
          account_id?: string | null
          auto_reply_keywords?: boolean | null
          auto_reply_stories?: boolean | null
          comments_24h?: number | null
          connected?: boolean | null
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          pending_messages?: number | null
          updated_at?: string | null
          user_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_config: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          avatar_url: string | null
          created_at: string
          deal_value: number | null
          email: string | null
          id: string
          name: string
          organization_id: string
          phone: string | null
          source: string | null
          stage_id: string | null
          status: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deal_value?: number | null
          email?: string | null
          id?: string
          name: string
          organization_id: string
          phone?: string | null
          source?: string | null
          stage_id?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deal_value?: number | null
          email?: string | null
          id?: string
          name?: string
          organization_id?: string
          phone?: string | null
          source?: string | null
          stage_id?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          name: string
          organization_id: string | null
          updated_at: string
          user_id: string
          variables: Json
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          name: string
          organization_id?: string | null
          updated_at?: string
          user_id: string
          variables?: Json
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          name?: string
          organization_id?: string | null
          updated_at?: string
          user_id?: string
          variables?: Json
        }
        Relationships: []
      }
      messages: {
        Row: {
          channel: string | null
          content: string | null
          created_at: string
          direction: string
          id: string
          is_read: boolean | null
          lead_id: string | null
          organization_id: string | null
          phone: string | null
          sender_name: string | null
          user_id: string
        }
        Insert: {
          channel?: string | null
          content?: string | null
          created_at?: string
          direction: string
          id?: string
          is_read?: boolean | null
          lead_id?: string | null
          organization_id?: string | null
          phone?: string | null
          sender_name?: string | null
          user_id: string
        }
        Update: {
          channel?: string | null
          content?: string | null
          created_at?: string
          direction?: string
          id?: string
          is_read?: boolean | null
          lead_id?: string | null
          organization_id?: string | null
          phone?: string | null
          sender_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          organization_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          organization_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          organization_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      nps_responses: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          organization_id: string | null
          score: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          score: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          email: string | null
          expires_at: string | null
          id: string
          invited_by: string
          organization_id: string
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by: string
          organization_id: string
          role?: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: []
      }
      organization_settings: {
        Row: {
          brand_logo_url: string | null
          brand_name: string | null
          brand_primary_color: string | null
          commission_percent: number | null
          fiscal_provider: string | null
          fiscal_token: string | null
          organization_id: string
          pix_key: string | null
          pix_merchant_city: string | null
          pix_merchant_name: string | null
          support_email: string | null
          support_whatsapp: string | null
          updated_at: string | null
          whatsapp_track_base_url: string | null
        }
        Insert: {
          brand_logo_url?: string | null
          brand_name?: string | null
          brand_primary_color?: string | null
          commission_percent?: number | null
          fiscal_provider?: string | null
          fiscal_token?: string | null
          organization_id: string
          pix_key?: string | null
          pix_merchant_city?: string | null
          pix_merchant_name?: string | null
          support_email?: string | null
          support_whatsapp?: string | null
          updated_at?: string | null
          whatsapp_track_base_url?: string | null
        }
        Update: {
          brand_logo_url?: string | null
          brand_name?: string | null
          brand_primary_color?: string | null
          commission_percent?: number | null
          fiscal_provider?: string | null
          fiscal_token?: string | null
          organization_id?: string
          pix_key?: string | null
          pix_merchant_city?: string | null
          pix_merchant_name?: string | null
          support_email?: string | null
          support_whatsapp?: string | null
          updated_at?: string | null
          whatsapp_track_base_url?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_terminals: {
        Row: {
          acquirer: string | null
          active: boolean | null
          brand: string
          created_at: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          rates: Json | null
          serial_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          acquirer?: string | null
          active?: boolean | null
          brand: string
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          rates?: Json | null
          serial_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          acquirer?: string | null
          active?: boolean | null
          brand?: string
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          rates?: Json | null
          serial_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_terminals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          mp_payment_id: string | null
          mp_preapproval_id: string | null
          mp_preference_id: string | null
          organization_id: string | null
          payer_email: string | null
          payment_method: string | null
          plan_id: string | null
          provider: string
          raw: Json
          status: string
          status_detail: string | null
          subscription_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          mp_payment_id?: string | null
          mp_preapproval_id?: string | null
          mp_preference_id?: string | null
          organization_id?: string | null
          payer_email?: string | null
          payment_method?: string | null
          plan_id?: string | null
          provider?: string
          raw?: Json
          status: string
          status_detail?: string | null
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          mp_payment_id?: string | null
          mp_preapproval_id?: string | null
          mp_preference_id?: string | null
          organization_id?: string | null
          payer_email?: string | null
          payment_method?: string | null
          plan_id?: string | null
          provider?: string
          raw?: Json
          status?: string
          status_detail?: string | null
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          payment_id: string | null
          phone: string | null
          plan_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          payment_id?: string | null
          phone?: string | null
          plan_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          payment_id?: string | null
          phone?: string | null
          plan_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_signups_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_signups_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_leads: {
        Row: {
          created_at: string | null
          deal_value: number | null
          expected_close_date: string | null
          id: string
          instance_name: string | null
          lead_id: string | null
          notes: string | null
          organization_id: string | null
          stage_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          instance_name?: string | null
          lead_id?: string | null
          notes?: string | null
          organization_id?: string | null
          stage_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          instance_name?: string | null
          lead_id?: string | null
          notes?: string | null
          organization_id?: string | null
          stage_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          interval: string
          is_active: boolean
          name: string
          price_cents: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          interval?: string
          is_active?: boolean
          name: string
          price_cents: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          interval?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_imei: {
        Row: {
          cost_price: number | null
          created_at: string
          id: string
          imei: string
          notes: string | null
          organization_id: string
          product_id: string
          sale_id: string | null
          serial: string | null
          sold_at: string | null
          status: string
        }
        Insert: {
          cost_price?: number | null
          created_at?: string
          id?: string
          imei: string
          notes?: string | null
          organization_id: string
          product_id: string
          sale_id?: string | null
          serial?: string | null
          sold_at?: string | null
          status?: string
        }
        Update: {
          cost_price?: number | null
          created_at?: string
          id?: string
          imei?: string
          notes?: string | null
          organization_id?: string
          product_id?: string
          sale_id?: string | null
          serial?: string | null
          sold_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_imei_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          brand: string | null
          category: string
          cost_price: number | null
          created_at: string
          description: string | null
          ean: string | null
          has_imei: boolean
          id: string
          image_url: string | null
          import_id: string | null
          location: string | null
          metadata: Json
          min_stock: number | null
          model: string | null
          name: string
          ncm: string | null
          organization_id: string
          price: number
          reference: string | null
          sku: string | null
          stock_quantity: number
          supplier: string | null
          supplier_id: string | null
          unit: string
          updated_at: string
          user_id: string
          weight: number | null
          wholesale_price: number | null
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category?: string
          cost_price?: number | null
          created_at?: string
          description?: string | null
          ean?: string | null
          has_imei?: boolean
          id?: string
          image_url?: string | null
          import_id?: string | null
          location?: string | null
          metadata?: Json
          min_stock?: number | null
          model?: string | null
          name: string
          ncm?: string | null
          organization_id: string
          price?: number
          reference?: string | null
          sku?: string | null
          stock_quantity?: number
          supplier?: string | null
          supplier_id?: string | null
          unit?: string
          updated_at?: string
          user_id: string
          weight?: number | null
          wholesale_price?: number | null
        }
        Update: {
          active?: boolean
          brand?: string | null
          category?: string
          cost_price?: number | null
          created_at?: string
          description?: string | null
          ean?: string | null
          has_imei?: boolean
          id?: string
          image_url?: string | null
          import_id?: string | null
          location?: string | null
          metadata?: Json
          min_stock?: number | null
          model?: string | null
          name?: string
          ncm?: string | null
          organization_id?: string
          price?: number
          reference?: string | null
          sku?: string | null
          stock_quantity?: number
          supplier?: string | null
          supplier_id?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
          weight?: number | null
          wholesale_price?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          biografia: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          nome: string | null
          organization_id: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          biografia?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          nome?: string | null
          organization_id?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          biografia?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          nome?: string | null
          organization_id?: string | null
          role?: string | null
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
      purchase_notes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_name: string | null
          data_compra: string
          fornecedor: string
          id: string
          items: Json
          kind: string
          note_number: number
          organization_id: string
          paga: boolean
          prazo_pagamento: string | null
          sale_ids: string[]
          total: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          data_compra?: string
          fornecedor?: string
          id?: string
          items?: Json
          kind?: string
          note_number: number
          organization_id: string
          paga?: boolean
          prazo_pagamento?: string | null
          sale_ids?: string[]
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          data_compra?: string
          fornecedor?: string
          id?: string
          items?: Json
          kind?: string
          note_number?: number
          organization_id?: string
          paga?: boolean
          prazo_pagamento?: string | null
          sale_ids?: string[]
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          converted_sale_id: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          discount: number | null
          expires_at: string | null
          id: string
          items: Json | null
          notes: string | null
          organization_id: string
          status: string | null
          subtotal: number | null
          total: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          converted_sale_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          discount?: number | null
          expires_at?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          organization_id: string
          status?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          converted_sale_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount?: number | null
          expires_at?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          organization_id?: string
          status?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          discount: number | null
          id: string
          imei: string | null
          import_job_id: string | null
          metadata: Json
          organization_id: string
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          sku: string | null
          total: number
          unit_cost: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount?: number | null
          id?: string
          imei?: string | null
          import_job_id?: string | null
          metadata?: Json
          organization_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          sale_id: string
          sku?: string | null
          total?: number
          unit_cost?: number | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          discount?: number | null
          id?: string
          imei?: string | null
          import_job_id?: string | null
          metadata?: Json
          organization_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          sku?: string | null
          total?: number
          unit_cost?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          created_at: string
          fee_amount: number | null
          id: string
          installments: number | null
          method: string
          organization_id: string
          paid_at: string
          reference: string | null
          sale_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          fee_amount?: number | null
          id?: string
          installments?: number | null
          method: string
          organization_id: string
          paid_at?: string
          reference?: string | null
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fee_amount?: number | null
          id?: string
          installments?: number | null
          method?: string
          organization_id?: string
          paid_at?: string
          reference?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          addition: number | null
          channel: string | null
          created_at: string
          customer_id: string | null
          discount: number | null
          id: string
          import_job_id: string | null
          notes: string | null
          organization_id: string
          payment_method: string | null
          sale_number: number | null
          seller_id: string | null
          status: string | null
          subtotal: number | null
          total_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          addition?: number | null
          channel?: string | null
          created_at?: string
          customer_id?: string | null
          discount?: number | null
          id?: string
          import_job_id?: string | null
          notes?: string | null
          organization_id: string
          payment_method?: string | null
          sale_number?: number | null
          seller_id?: string | null
          status?: string | null
          subtotal?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          addition?: number | null
          channel?: string | null
          created_at?: string
          customer_id?: string | null
          discount?: number | null
          id?: string
          import_job_id?: string | null
          notes?: string | null
          organization_id?: string
          payment_method?: string | null
          sale_number?: number | null
          seller_id?: string | null
          status?: string | null
          subtotal?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          body: string
          created_at: string | null
          error: string | null
          id: string
          instance_name: string | null
          metadata: Json | null
          organization_id: string
          scheduled_at: string
          sent_at: string | null
          status: string
          to_phone: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          error?: string | null
          id?: string
          instance_name?: string | null
          metadata?: Json | null
          organization_id: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          to_phone: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          error?: string | null
          id?: string
          instance_name?: string | null
          metadata?: Json | null
          organization_id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          to_phone?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      service_checklists: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          items: Json | null
          name: string
          organization_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          items?: Json | null
          name: string
          organization_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          items?: Json | null
          name?: string
          organization_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_checklists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_attachments: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          kind: string
          organization_id: string
          public_url: string | null
          service_order_id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          kind?: string
          organization_id: string
          public_url?: string | null
          service_order_id: string
          storage_path: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          kind?: string
          organization_id?: string
          public_url?: string | null
          service_order_id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      service_order_history: {
        Row: {
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          organization_id: string
          service_order_id: string
          to_status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          organization_id: string
          service_order_id: string
          to_status: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          organization_id?: string
          service_order_id?: string
          to_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_history_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_items: {
        Row: {
          created_at: string
          description: string
          id: string
          item_type: string
          organization_id: string
          product_id: string | null
          quantity: number
          service_order_id: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          item_type?: string
          organization_id: string
          product_id?: string | null
          quantity?: number
          service_order_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          item_type?: string
          organization_id?: string
          product_id?: string | null
          quantity?: number
          service_order_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_order_items_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          accessories: string | null
          brand: string | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          diagnosis: string | null
          due_date: string | null
          equipment: string
          estimated_cost: number | null
          id: string
          imei: string | null
          labor_cost: number | null
          model: string | null
          notes: string | null
          organization_id: string
          os_number: number | null
          parts_cost: number | null
          password_pattern: string | null
          priority: string | null
          problem_description: string | null
          serial: string | null
          solution: string | null
          status: string
          technician_id: string | null
          total_cost: number | null
          updated_at: string
          user_id: string
          warranty_days: number | null
        }
        Insert: {
          accessories?: string | null
          brand?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          diagnosis?: string | null
          due_date?: string | null
          equipment: string
          estimated_cost?: number | null
          id?: string
          imei?: string | null
          labor_cost?: number | null
          model?: string | null
          notes?: string | null
          organization_id: string
          os_number?: number | null
          parts_cost?: number | null
          password_pattern?: string | null
          priority?: string | null
          problem_description?: string | null
          serial?: string | null
          solution?: string | null
          status?: string
          technician_id?: string | null
          total_cost?: number | null
          updated_at?: string
          user_id: string
          warranty_days?: number | null
        }
        Update: {
          accessories?: string | null
          brand?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          diagnosis?: string | null
          due_date?: string | null
          equipment?: string
          estimated_cost?: number | null
          id?: string
          imei?: string | null
          labor_cost?: number | null
          model?: string | null
          notes?: string | null
          organization_id?: string
          os_number?: number | null
          parts_cost?: number | null
          password_pattern?: string | null
          priority?: string | null
          problem_description?: string | null
          serial?: string | null
          solution?: string | null
          status?: string
          technician_id?: string | null
          total_cost?: number | null
          updated_at?: string
          user_id?: string
          warranty_days?: number | null
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          movement_type: string
          notes: string | null
          organization_id: string
          product_id: string
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          unit_cost: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movement_type: string
          notes?: string | null
          organization_id: string
          product_id: string
          quantity: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          unit_cost?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          movement_type?: string
          notes?: string | null
          organization_id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          unit_cost?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          failed_attempts: number | null
          id: string
          last_failed_at: string | null
          metadata: Json
          mp_payer_email: string | null
          mp_preapproval_id: string | null
          next_retry_at: string | null
          organization_id: string | null
          plan_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          failed_attempts?: number | null
          id?: string
          last_failed_at?: string | null
          metadata?: Json
          mp_payer_email?: string | null
          mp_preapproval_id?: string | null
          next_retry_at?: string | null
          organization_id?: string | null
          plan_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          failed_attempts?: number | null
          id?: string
          last_failed_at?: string | null
          metadata?: Json
          mp_payer_email?: string | null
          mp_preapproval_id?: string | null
          next_retry_at?: string | null
          organization_id?: string | null
          plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          active: boolean | null
          address: string | null
          city: string | null
          cnpj: string | null
          contact_name: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          city?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          address?: string | null
          city?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          board_order: number
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          organization_id: string | null
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          board_order?: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          board_order?: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_organizations: {
        Row: {
          created_at: string | null
          is_default: boolean | null
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          is_default?: boolean | null
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          is_default?: boolean | null
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warranty_terms: {
        Row: {
          active: boolean | null
          category: string
          content: string
          created_at: string | null
          days: number | null
          id: string
          name: string
          organization_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          category: string
          content: string
          created_at?: string | null
          days?: number | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string
          content?: string
          created_at?: string | null
          days?: number | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranty_terms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          created_at: string | null
          id: string
          instance_name: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_name: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_name?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_metrics: {
        Row: {
          active_subs: number | null
          cancelled_subs: number | null
          mrr_cents: number | null
          os_24h: number | null
          sales_24h: number | null
          total_orgs: number | null
          total_users: number | null
          trial_subs: number | null
        }
        Relationships: []
      }
      customer_rfm: {
        Row: {
          customer_id: string | null
          email: string | null
          f_score: number | null
          freq: number | null
          last_purchase: string | null
          m_score: number | null
          monetary: number | null
          name: string | null
          organization_id: string | null
          phone: string | null
          r_score: number | null
          segment: string | null
          total_score: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_organization_invite: { Args: { _token: string }; Returns: string }
      checkout_sale: { Args: { _payload: Json }; Returns: string }
      clear_demo_data: { Args: never; Returns: Json }
      create_affiliate_code: { Args: never; Returns: string }
      create_api_key: {
        Args: { _name: string; _scopes?: string[] }
        Returns: Json
      }
      create_organization_for_user: { Args: { _name: string }; Returns: string }
      delete_my_account: { Args: never; Returns: undefined }
      dispatch_no_reply_24h: { Args: never; Returns: undefined }
      ensure_default_funnel_stages: {
        Args: { _user_id: string }
        Returns: undefined
      }
      expire_old_trials: { Args: never; Returns: Json }
      gen_invite_token: { Args: never; Returns: string }
      has_role: {
        Args: {
          _org: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoke_edge_function: { Args: { fn_name: string }; Returns: number }
      is_org_member: {
        Args: { _org: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      leave_organization: { Args: { _org_id: string }; Returns: undefined }
      list_organization_members: {
        Args: { _org_id: string }
        Returns: {
          email: string
          name: string
          role: string
          user_id: string
        }[]
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      remove_organization_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: undefined
      }
      seed_demo_data: { Args: never; Returns: Json }
      suspend_overdue_subscriptions: { Args: never; Returns: Json }
      switch_organization: { Args: { _org_id: string }; Returns: undefined }
      update_organization_name: {
        Args: { _name: string; _org_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "vendedor" | "financeiro" | "suporte"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "vendedor", "financeiro", "suporte"],
    },
  },
} as const
