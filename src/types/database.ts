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
      artists: {
        Row: {
          created_at: string
          display_order: number
          enabled: boolean
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          display_order: number
          enabled?: boolean
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          display_order?: number
          enabled?: boolean
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          id: number
          metadata: Json
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          id?: never
          metadata?: Json
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          id?: never
          metadata?: Json
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      download_events: {
        Row: {
          created_at: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "download_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "photo_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "download_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_jobs: {
        Row: {
          attempt: number
          created_at: string
          duration_ms: number | null
          error_code: string | null
          fallback_used: boolean
          finished_at: string | null
          id: string
          lease_until: string | null
          lock_token: string | null
          provider: string | null
          session_id: string
          stage: string
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempt: number
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          fallback_used?: boolean
          finished_at?: string | null
          id?: string
          lease_until?: string | null
          lock_token?: string | null
          provider?: string | null
          session_id: string
          stage?: string
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          fallback_used?: boolean
          finished_at?: string | null
          id?: string
          lease_until?: string | null
          lock_token?: string | null
          provider?: string | null
          session_id?: string
          stage?: string
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "photo_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_sessions: {
        Row: {
          artist_id: string | null
          artist_selected_at: string | null
          attempts: number
          consent_version: string | null
          consent_at: string | null
          created_at: string
          downloaded_at: string | null
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          fallback_used: boolean
          id: string
          processing_started_at: string | null
          provider: string | null
          purged_at: string | null
          ready_at: string | null
          result_path: string | null
          selfie_path: string | null
          status: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          artist_id?: string | null
          artist_selected_at?: string | null
          attempts?: number
          consent_version?: string | null
          consent_at?: string | null
          created_at?: string
          downloaded_at?: string | null
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          fallback_used?: boolean
          id?: string
          processing_started_at?: string | null
          provider?: string | null
          purged_at?: string | null
          ready_at?: string | null
          result_path?: string | null
          selfie_path?: string | null
          status?: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          artist_id?: string | null
          artist_selected_at?: string | null
          attempts?: number
          consent_version?: string | null
          consent_at?: string | null
          created_at?: string
          downloaded_at?: string | null
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          fallback_used?: boolean
          id?: string
          processing_started_at?: string | null
          provider?: string | null
          purged_at?: string | null
          ready_at?: string | null
          result_path?: string | null
          selfie_path?: string | null
          status?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_sessions_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          active: boolean
          artist_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          label: string
          placement: Json
          storage_path: string
          thumbnail_path: string | null
        }
        Insert: {
          active?: boolean
          artist_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          label?: string
          placement?: Json
          storage_path: string
          thumbnail_path?: string | null
        }
        Update: {
          active?: boolean
          artist_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          label?: string
          placement?: Json
          storage_path?: string
          thumbnail_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      user_access: {
        Row: {
          approved_at: string | null
          blocked_at: string | null
          consumed_at: string | null
          reactivation_count: number
          rejected_at: string | null
          requested_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          blocked_at?: string | null
          consumed_at?: string | null
          reactivation_count?: number
          rejected_at?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          blocked_at?: string | null
          consumed_at?: string | null
          reactivation_count?: number
          rejected_at?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      bts_admin_allowed: { Args: { p_user: string }; Returns: boolean }
      bts_admin_transition: {
        Args: { p_action: string; p_actor: string; p_user: string }
        Returns: Json
      }
      bts_attach_selfie: {
        Args: { p_path: string; p_session: string; p_user: string }
        Returns: Json
      }
      bts_choose_artist: {
        Args: { p_artist: string; p_user: string }
        Returns: Json
      }
      bts_claim_generation: {
        Args: { p_session: string; p_user: string }
        Returns: Json
      }
      bts_claim_job: { Args: { p_job: string }; Returns: Json }
      bts_complete_generation: {
        Args: { p_path: string; p_session: string }
        Returns: boolean
      }
      bts_enqueue_generation: {
        Args: { p_max_attempts?: number; p_session: string; p_user: string }
        Returns: Json
      }
      bts_expire_sessions: { Args: { p_cutoff: string }; Returns: number }
      bts_expired_media: {
        Args: { p_cutoff: string }
        Returns: unknown[]
        SetofOptions: {
          from: "*"
          to: "media_objects"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      bts_finish_job: {
        Args: {
          p_duration: number
          p_error?: string | null
          p_fallback: boolean
          p_job: string
          p_lock: string
          p_path: string | null
          p_provider: string
        }
        Returns: boolean
      }
      bts_forget_media: { Args: { p_path: string }; Returns: undefined }
      bts_rate_limit: {
        Args: { p_key: string; p_limit: number; p_seconds: number }
        Returns: boolean
      }
      bts_redeem_download: {
        Args: { p_session: string; p_user: string }
        Returns: Json
      }
      bts_register_admin: { Args: { p_user: string }; Returns: undefined }
      bts_request_access: {
        Args: { p_name: string; p_rate_key: string; p_user: string }
        Returns: Json
      }
      bts_track_media: {
        Args: { p_bucket: string; p_path: string; p_session: string }
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
