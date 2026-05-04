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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          action_type: string | null
          automation_id: string | null
          created_at: string
          error: string | null
          id: string
          payload: Json
          status: string
          trigger_type: string
          user_id: string
        }
        Insert: {
          action_type?: string | null
          automation_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json
          status?: string
          trigger_type: string
          user_id: string
        }
        Update: {
          action_type?: string | null
          automation_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json
          status?: string
          trigger_type?: string
          user_id?: string
        }
        Relationships: []
      }
      automations: {
        Row: {
          action_type: string
          config: Json | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          trigger_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_conversations: {
        Row: {
          assigned_to: string | null
          contact_name: string | null
          contact_phone: string
          created_at: string
          id: string
          instance_name: string | null
          last_message_at: string
          messages_count: number
          notes: string | null
          remote_jid: string | null
          status: string
          tags: string[] | null
          transcript: Json
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          id?: string
          instance_name?: string | null
          last_message_at?: string
          messages_count?: number
          notes?: string | null
          remote_jid?: string | null
          status?: string
          tags?: string[] | null
          transcript?: Json
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          id?: string
          instance_name?: string | null
          last_message_at?: string
          messages_count?: number
          notes?: string | null
          remote_jid?: string | null
          status?: string
          tags?: string[] | null
          transcript?: Json
          user_id?: string
        }
        Relationships: []
      }
      bot_flows: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          nodes: Json | null
          trigger_type: string | null
          trigger_value: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          nodes?: Json | null
          trigger_type?: string | null
          trigger_value?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          nodes?: Json | null
          trigger_type?: string | null
          trigger_value?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bot_settings: {
        Row: {
          ai_model: string
          ai_provider: string
          ai_temperature: number
          auto_reply_delay_seconds: number
          away_message: string
          bot_name: string
          business_hours: Json
          collect_lead_info: boolean
          created_at: string
          fallback_message: string
          greeting: string
          handoff_keywords: string[]
          id: string
          is_active: boolean
          max_messages_before_handoff: number
          system_prompt: string
          updated_at: string
          user_id: string
          webhook_secret: string | null
          whatsapp_instance: string | null
        }
        Insert: {
          ai_model?: string
          ai_provider?: string
          ai_temperature?: number
          auto_reply_delay_seconds?: number
          away_message?: string
          bot_name?: string
          business_hours?: Json
          collect_lead_info?: boolean
          created_at?: string
          fallback_message?: string
          greeting?: string
          handoff_keywords?: string[]
          id?: string
          is_active?: boolean
          max_messages_before_handoff?: number
          system_prompt?: string
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
          whatsapp_instance?: string | null
        }
        Update: {
          ai_model?: string
          ai_provider?: string
          ai_temperature?: number
          auto_reply_delay_seconds?: number
          away_message?: string
          bot_name?: string
          business_hours?: Json
          collect_lead_info?: boolean
          created_at?: string
          fallback_message?: string
          greeting?: string
          handoff_keywords?: string[]
          id?: string
          is_active?: boolean
          max_messages_before_handoff?: number
          system_prompt?: string
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
          whatsapp_instance?: string | null
        }
        Relationships: []
      }
      business_goals: {
        Row: {
          created_at: string
          current_value: number | null
          daily_goal: number | null
          end_date: string | null
          goal_name: string | null
          goal_type: string | null
          id: string
          monthly_goal: number | null
          notes: string | null
          start_date: string | null
          status: string | null
          target_value: number | null
          updated_at: string
          user_id: string
          weekly_goal: number | null
        }
        Insert: {
          created_at?: string
          current_value?: number | null
          daily_goal?: number | null
          end_date?: string | null
          goal_name?: string | null
          goal_type?: string | null
          id?: string
          monthly_goal?: number | null
          notes?: string | null
          start_date?: string | null
          status?: string | null
          target_value?: number | null
          updated_at?: string
          user_id: string
          weekly_goal?: number | null
        }
        Update: {
          created_at?: string
          current_value?: number | null
          daily_goal?: number | null
          end_date?: string | null
          goal_name?: string | null
          goal_type?: string | null
          id?: string
          monthly_goal?: number | null
          notes?: string | null
          start_date?: string | null
          status?: string | null
          target_value?: number | null
          updated_at?: string
          user_id?: string
          weekly_goal?: number | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          created_at: string
          description: string | null
          end_time: string
          id: string
          lead_id: string | null
          location: string | null
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          lead_id?: string | null
          location?: string | null
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          lead_id?: string | null
          location?: string | null
          start_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          credentials: Json | null
          id: string
          name: string
          status: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credentials?: Json | null
          id?: string
          name: string
          status?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credentials?: Json | null
          id?: string
          name?: string
          status?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chart_of_accounts: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          parent_id: string | null
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          parent_id?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          parent_id?: string | null
          type?: string | null
          updated_at?: string
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
      crm_pipeline_stages: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          order_index: number
          pipeline_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          order_index?: number
          pipeline_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          pipeline_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          created_at: string | null
          document: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          created_at?: string | null
          document?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          created_at?: string | null
          document?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          amount: number
          attachment_url: string | null
          category: string | null
          created_at: string | null
          description: string
          due_date: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          owner_id: string | null
          payment_account: string | null
          payment_date: string | null
          payment_method: string | null
          payment_methods: Json | null
          products_list: Json | null
          recurrence_period: string | null
          recurring: boolean | null
          status: string | null
          supplier_name: string | null
          tags: string[] | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          category?: string | null
          created_at?: string | null
          description: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          owner_id?: string | null
          payment_account?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_methods?: Json | null
          products_list?: Json | null
          recurrence_period?: string | null
          recurring?: boolean | null
          status?: string | null
          supplier_name?: string | null
          tags?: string[] | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          category?: string | null
          created_at?: string | null
          description?: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          owner_id?: string | null
          payment_account?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_methods?: Json | null
          products_list?: Json | null
          recurrence_period?: string | null
          recurring?: boolean | null
          status?: string | null
          supplier_name?: string | null
          tags?: string[] | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      funnel_stages: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          order_index: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          order_index?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      import_history: {
        Row: {
          created_at: string | null
          file_name: string
          file_type: string
          id: string
          items_count: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_type: string
          id?: string
          items_count?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_type?: string
          id?: string
          items_count?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          created_at: string | null
          id: string
          min_quantity: number | null
          name: string
          quantity: number | null
          sku: string | null
          unit_price: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          min_quantity?: number | null
          name: string
          quantity?: number | null
          sku?: string | null
          unit_price?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          min_quantity?: number | null
          name?: string
          quantity?: number | null
          sku?: string | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          quantity: number
          reason: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          quantity: number
          reason?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          quantity?: number
          reason?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          last_message_direction: string | null
          metadata: Json | null
          name: string
          phone: string | null
          source: string | null
          status: string | null
          updated_at: string
          user_id: string
          whatsapp_tags: string[] | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_message_direction?: string | null
          metadata?: Json | null
          name: string
          phone?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          whatsapp_tags?: string[] | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_message_direction?: string | null
          metadata?: Json | null
          name?: string
          phone?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_tags?: string[] | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          channel_id: string | null
          content: string
          created_at: string
          direction: string
          external_id: string | null
          id: string
          lead_id: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          channel_id?: string | null
          content: string
          created_at?: string
          direction: string
          external_id?: string | null
          id?: string
          lead_id?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string | null
          content?: string
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          lead_id?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_leads: {
        Row: {
          created_at: string
          deal_value: number | null
          id: string
          instance_name: string | null
          lead_id: string
          notes: string | null
          priority: string | null
          stage_id: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_value?: number | null
          id?: string
          instance_name?: string | null
          lead_id: string
          notes?: string | null
          priority?: string | null
          stage_id: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deal_value?: number | null
          id?: string
          instance_name?: string | null
          lead_id?: string
          notes?: string | null
          priority?: string | null
          stage_id?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
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
            foreignKeyName: "pipeline_leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          battery_health: string | null
          brand: string | null
          capacity: string | null
          category: string | null
          color: string | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          display: string | null
          ean: string | null
          id: string
          image_url: string | null
          imei: string | null
          imei2: string | null
          import_id: string | null
          location: string | null
          min_stock: number | null
          model: string | null
          name: string
          ncm: string | null
          observations: string | null
          owner_id: string | null
          price: number | null
          processor: string | null
          ram: string | null
          reference: string | null
          sku: string | null
          stock_quantity: number | null
          store: string | null
          supplier: string | null
          unit: string | null
          updated_at: string | null
          user_id: string
          weight: number | null
          wholesale_price: number | null
        }
        Insert: {
          battery_health?: string | null
          brand?: string | null
          capacity?: string | null
          category?: string | null
          color?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          display?: string | null
          ean?: string | null
          id?: string
          image_url?: string | null
          imei?: string | null
          imei2?: string | null
          import_id?: string | null
          location?: string | null
          min_stock?: number | null
          model?: string | null
          name: string
          ncm?: string | null
          observations?: string | null
          owner_id?: string | null
          price?: number | null
          processor?: string | null
          ram?: string | null
          reference?: string | null
          sku?: string | null
          stock_quantity?: number | null
          store?: string | null
          supplier?: string | null
          unit?: string | null
          updated_at?: string | null
          user_id: string
          weight?: number | null
          wholesale_price?: number | null
        }
        Update: {
          battery_health?: string | null
          brand?: string | null
          capacity?: string | null
          category?: string | null
          color?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          display?: string | null
          ean?: string | null
          id?: string
          image_url?: string | null
          imei?: string | null
          imei2?: string | null
          import_id?: string | null
          location?: string | null
          min_stock?: number | null
          model?: string | null
          name?: string
          ncm?: string | null
          observations?: string | null
          owner_id?: string | null
          price?: number | null
          processor?: string | null
          ram?: string | null
          reference?: string | null
          sku?: string | null
          stock_quantity?: number | null
          store?: string | null
          supplier?: string | null
          unit?: string | null
          updated_at?: string | null
          user_id?: string
          weight?: number | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "import_history"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          owner_id: string | null
          plan_type: string | null
          role: string | null
          updated_at: string
          usage_current: number | null
          usage_limit: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          owner_id?: string | null
          plan_type?: string | null
          role?: string | null
          updated_at?: string
          usage_current?: number | null
          usage_limit?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          owner_id?: string | null
          plan_type?: string | null
          role?: string | null
          updated_at?: string
          usage_current?: number | null
          usage_limit?: number | null
        }
        Relationships: []
      }
      sales_orders: {
        Row: {
          created_at: string | null
          customer_id: string | null
          discount_amount: number | null
          id: string
          items: Json | null
          notes: string | null
          owner_id: string | null
          payment_method: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          id?: string
          items?: Json | null
          notes?: string | null
          owner_id?: string | null
          payment_method?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          id?: string
          items?: Json | null
          notes?: string | null
          owner_id?: string | null
          payment_method?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          created_at: string | null
          customer_id: string
          equipment: string | null
          estimated_cost: number | null
          id: string
          problem_description: string | null
          status: string | null
          technical_notes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          equipment?: string | null
          estimated_cost?: number | null
          id?: string
          problem_description?: string | null
          status?: string | null
          technical_notes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          equipment?: string | null
          estimated_cost?: number | null
          id?: string
          problem_description?: string | null
          status?: string | null
          technical_notes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          image_url: string | null
          is_active: boolean
          keywords: string[] | null
          name: string
          price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          keywords?: string[] | null
          name: string
          price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          keywords?: string[] | null
          name?: string
          price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          priority: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: string | null
          status?: string | null
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
        ]
      }
      team_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          role: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          role?: string
          token?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          role?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      advanced_metrics: {
        Row: {
          arpu: number | null
          ltv: number | null
          total_revenue: number | null
          total_sales: number | null
          unique_customers: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      call_pipeline_qualifier: {
        Args: { _lead_id: string; _message: string; _user_id: string }
        Returns: undefined
      }
      dispatch_automation: {
        Args: { _payload: Json; _trigger_type: string; _user_id: string }
        Returns: undefined
      }
      ensure_default_funnel_stages: {
        Args: { _user_id: string }
        Returns: undefined
      }
      ensure_lead_and_pipeline_from_conversation:
        | {
            Args: { _name?: string; _phone: string; _user_id: string }
            Returns: undefined
          }
        | {
            Args: {
              _avatar_url?: string
              _instance_name?: string
              _name?: string
              _phone: string
              _user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _avatar_url?: string
              _instance_name?: string
              _name?: string
              _phone: string
              _user_id: string
              _whatsapp_tags?: string[]
            }
            Returns: undefined
          }
      handle_new_bot_conversation_direct: {
        Args: { p_name: string; p_phone: string; p_user_id: string }
        Returns: undefined
      }
      handle_new_bot_conversation_retroactive: {
        Args: { conv_id: string }
        Returns: undefined
      }
      is_account_manager: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      normalize_phone: { Args: { p_phone: string }; Returns: string }
      scan_no_reply_24h: { Args: never; Returns: undefined }
      seed_default_automations: {
        Args: { _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
