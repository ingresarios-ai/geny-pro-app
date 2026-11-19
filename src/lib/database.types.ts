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
      ai_usage_logs: {
        Row: {
          created_at: string
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_tokens?: number
          model: string
          output_tokens?: number
          usage_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          usage_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          ai_model: string
          default_ai_daily_limit: number
          ghl_enabled: boolean
          ghl_send_membership_events: boolean
          ghl_send_milestones: boolean
          ghl_webhook_url: string
          grace_days: number
          hotmart_enabled: boolean
          hotmart_hottok: string
          id: number
          privacy_url: string
          renewal_url_hotmart: string
          renewal_url_whop: string
          support_whatsapp_url: string
          updated_at: string
          whop_enabled: boolean
          whop_webhook_secret: string
        }
        Insert: {
          ai_model?: string
          default_ai_daily_limit?: number
          ghl_enabled?: boolean
          ghl_send_membership_events?: boolean
          ghl_send_milestones?: boolean
          ghl_webhook_url?: string
          grace_days?: number
          hotmart_enabled?: boolean
          hotmart_hottok?: string
          id?: number
          privacy_url?: string
          renewal_url_hotmart?: string
          renewal_url_whop?: string
          support_whatsapp_url?: string
          updated_at?: string
          whop_enabled?: boolean
          whop_webhook_secret?: string
        }
        Update: {
          ai_model?: string
          default_ai_daily_limit?: number
          ghl_enabled?: boolean
          ghl_send_membership_events?: boolean
          ghl_send_milestones?: boolean
          ghl_webhook_url?: string
          grace_days?: number
          hotmart_enabled?: boolean
          hotmart_hottok?: string
          id?: number
          privacy_url?: string
          renewal_url_hotmart?: string
          renewal_url_whop?: string
          support_whatsapp_url?: string
          updated_at?: string
          whop_enabled?: boolean
          whop_webhook_secret?: string
        }
        Relationships: []
      }
      market_cache: {
        Row: {
          cache_key: string
          expires_at: string
          payload: Json
          updated_at: string
        }
        Insert: {
          cache_key: string
          expires_at: string
          payload: Json
          updated_at?: string
        }
        Update: {
          cache_key?: string
          expires_at?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          buyer_email: string | null
          canceled_at: string | null
          created_at: string
          expires_at: string | null
          external_customer_id: string | null
          external_order_id: string | null
          external_subscription_id: string | null
          grace_until: string | null
          id: string
          notes: string
          plan_name: string
          source: string
          starts_at: string
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          buyer_email?: string | null
          canceled_at?: string | null
          created_at?: string
          expires_at?: string | null
          external_customer_id?: string | null
          external_order_id?: string | null
          external_subscription_id?: string | null
          grace_until?: string | null
          id?: string
          notes?: string
          plan_name?: string
          source?: string
          starts_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          buyer_email?: string | null
          canceled_at?: string | null
          created_at?: string
          expires_at?: string | null
          external_customer_id?: string | null
          external_order_id?: string | null
          external_subscription_id?: string | null
          grace_until?: string | null
          id?: string
          notes?: string
          plan_name?: string
          source?: string
          starts_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_notes: {
        Row: {
          author_id: string | null
          author_name: string
          created_at: string
          id: string
          note: string
          student_id: string
          tag: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string
          created_at?: string
          id?: string
          note: string
          student_id: string
          tag?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          created_at?: string
          id?: string
          note?: string
          student_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_memberships: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          country: string
          created_at: string
          email: string
          expires_at: string | null
          external_customer_id: string | null
          external_order_id: string | null
          external_subscription_id: string | null
          full_name: string
          grace_until: string | null
          id: string
          notes: string
          phone: string
          plan_name: string
          role: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          country?: string
          created_at?: string
          email: string
          expires_at?: string | null
          external_customer_id?: string | null
          external_order_id?: string | null
          external_subscription_id?: string | null
          full_name?: string
          grace_until?: string | null
          id?: string
          notes?: string
          phone?: string
          plan_name?: string
          role?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          country?: string
          created_at?: string
          email?: string
          expires_at?: string | null
          external_customer_id?: string | null
          external_order_id?: string | null
          external_subscription_id?: string | null
          full_name?: string
          grace_until?: string | null
          id?: string
          notes?: string
          phone?: string
          plan_name?: string
          role?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_memberships_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_links: {
        Row: {
          id: number
          privacy_url: string
          renewal_url_hotmart: string
          renewal_url_whop: string
          support_whatsapp_url: string
          updated_at: string
        }
        Insert: {
          id?: number
          privacy_url?: string
          renewal_url_hotmart?: string
          renewal_url_whop?: string
          support_whatsapp_url?: string
          updated_at?: string
        }
        Update: {
          id?: number
          privacy_url?: string
          renewal_url_hotmart?: string
          renewal_url_whop?: string
          support_whatsapp_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_days_count: number
          consent_at: string | null
          country: string
          created_at: string
          daily_ai_limit_override: number | null
          email: string
          full_name: string
          id: string
          last_active_at: string | null
          last_active_date: string | null
          last_module: string
          phone: string
          ranking_alias: string
          ranking_opt_in: boolean
          role: string
          stage: string
          updated_at: string
        }
        Insert: {
          active_days_count?: number
          consent_at?: string | null
          country?: string
          created_at?: string
          daily_ai_limit_override?: number | null
          email: string
          full_name?: string
          id: string
          last_active_at?: string | null
          last_active_date?: string | null
          last_module?: string
          phone?: string
          ranking_alias?: string
          ranking_opt_in?: boolean
          role?: string
          stage?: string
          updated_at?: string
        }
        Update: {
          active_days_count?: number
          consent_at?: string | null
          country?: string
          created_at?: string
          daily_ai_limit_override?: number | null
          email?: string
          full_name?: string
          id?: string
          last_active_at?: string | null
          last_active_date?: string | null
          last_module?: string
          phone?: string
          ranking_alias?: string
          ranking_opt_in?: boolean
          role?: string
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      ranking_entries: {
        Row: {
          alias: string
          dias: number
          dis: number | null
          n: number
          pnl: number
          r_total: number
          updated_at: string
          user_id: string
          wr: number
        }
        Insert: {
          alias?: string
          dias?: number
          dis?: number | null
          n?: number
          pnl?: number
          r_total?: number
          updated_at?: string
          user_id: string
          wr?: number
        }
        Update: {
          alias?: string
          dias?: number
          dis?: number | null
          n?: number
          pnl?: number
          r_total?: number
          updated_at?: string
          user_id?: string
          wr?: number
        }
        Relationships: [
          {
            foreignKeyName: "ranking_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_app_state: {
        Row: {
          checkins_count: number
          diag_completed: boolean
          general_score: number
          geny_messages_count: number
          goals_count: number
          ideas_built_count: number
          is_demo: boolean
          mindset_sessions_count: number
          movements_count: number
          plan_adherence: number
          radar_scans_count: number
          reto21_closed_days: number
          saved_strategies_count: number
          savings_rate: number
          state: Json
          total_pnl: number
          trades_count: number
          updated_at: string
          user_id: string
          win_rate: number
        }
        Insert: {
          checkins_count?: number
          diag_completed?: boolean
          general_score?: number
          geny_messages_count?: number
          goals_count?: number
          ideas_built_count?: number
          is_demo?: boolean
          mindset_sessions_count?: number
          movements_count?: number
          plan_adherence?: number
          radar_scans_count?: number
          reto21_closed_days?: number
          saved_strategies_count?: number
          savings_rate?: number
          state?: Json
          total_pnl?: number
          trades_count?: number
          updated_at?: string
          user_id: string
          win_rate?: number
        }
        Update: {
          checkins_count?: number
          diag_completed?: boolean
          general_score?: number
          geny_messages_count?: number
          goals_count?: number
          ideas_built_count?: number
          is_demo?: boolean
          mindset_sessions_count?: number
          movements_count?: number
          plan_adherence?: number
          radar_scans_count?: number
          reto21_closed_days?: number
          saved_strategies_count?: number
          savings_rate?: number
          state?: Json
          total_pnl?: number
          trades_count?: number
          updated_at?: string
          user_id?: string
          win_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_app_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_events: {
        Row: {
          created_at: string
          email: string
          event_date: string
          event_name: string
          ghl_error: string | null
          ghl_sent: boolean
          ghl_status: number | null
          id: string
          module: string | null
          payload: Json
          stage: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          event_date?: string
          event_name: string
          ghl_error?: string | null
          ghl_sent?: boolean
          ghl_status?: number | null
          id?: string
          module?: string | null
          payload?: Json
          stage?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          event_date?: string
          event_name?: string
          ghl_error?: string | null
          ghl_sent?: boolean
          ghl_status?: number | null
          id?: string
          module?: string | null
          payload?: Json
          stage?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string
          direction: string
          email: string | null
          error_message: string | null
          event_type: string
          external_event_id: string | null
          http_status: number | null
          id: string
          payload: Json
          provider: string
          response_body: string | null
          retry_count: number
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          direction: string
          email?: string | null
          error_message?: string | null
          event_type: string
          external_event_id?: string | null
          http_status?: number | null
          id?: string
          payload?: Json
          provider: string
          response_body?: string | null
          retry_count?: number
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          email?: string | null
          error_message?: string | null
          event_type?: string
          external_event_id?: string | null
          http_status?: number | null
          id?: string
          payload?: Json
          provider?: string
          response_body?: string | null
          retry_count?: number
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type MembershipRow = Database["public"]["Tables"]["memberships"]["Row"];
export type PendingMembershipRow = Database["public"]["Tables"]["pending_memberships"]["Row"];
export type UserAppStateRow = Database["public"]["Tables"]["user_app_state"]["Row"];
export type AppSettingsRow = Database["public"]["Tables"]["app_settings"]["Row"];
export type UserEventRow = Database["public"]["Tables"]["user_events"]["Row"];
export type WebhookLogRow = Database["public"]["Tables"]["webhook_logs"]["Row"];
export type MentorNoteRow = Database["public"]["Tables"]["mentor_notes"]["Row"];
export type PortalLinksRow = Database["public"]["Tables"]["portal_links"]["Row"];
