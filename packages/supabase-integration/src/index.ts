export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key_hash: string
          last_used_at: string | null
          scopes: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          last_used_at?: string | null
          scopes?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          last_used_at?: string | null
          scopes?: string[]
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content_image_url: string | null
          content_text: string | null
          created_at: string
          id: string
          metadata: Json | null
          sender: string
          session_id: string
          tool_call_id: string | null
          tool_calls_json: Json | null
          tool_name: string | null
          tool_status: string | null
          trace_id: string
          turn_number: number
          user_id: string
        }
        Insert: {
          content_image_url?: string | null
          content_text?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          sender: string
          session_id?: string
          tool_call_id?: string | null
          tool_calls_json?: Json | null
          tool_name?: string | null
          tool_status?: string | null
          trace_id: string
          turn_number?: number
          user_id: string
        }
        Update: {
          content_image_url?: string | null
          content_text?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          sender?: string
          session_id?: string
          tool_call_id?: string | null
          tool_calls_json?: Json | null
          tool_name?: string | null
          tool_status?: string | null
          trace_id?: string
          turn_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_trace_id_fkey"
            columns: ["trace_id"]
            isOneToOne: false
            referencedRelation: "traces"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_folder_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_folder_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_folder_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          allow_public_sharing: boolean
          chat_messages_per_session: number | null
          chat_sessions_limit: number | null
          chat_sessions_period: string | null
          created_at: string
          display_name: string
          id: string
          monthly_upload_limit: number | null
          name: string
          price_monthly: number
          retention_days: number | null
          total_trace_limit: number | null
          updated_at: string
        }
        Insert: {
          allow_public_sharing?: boolean
          chat_messages_per_session?: number | null
          chat_sessions_limit?: number | null
          chat_sessions_period?: string | null
          created_at?: string
          display_name: string
          id?: string
          monthly_upload_limit?: number | null
          name: string
          price_monthly?: number
          retention_days?: number | null
          total_trace_limit?: number | null
          updated_at?: string
        }
        Update: {
          allow_public_sharing?: boolean
          chat_messages_per_session?: number | null
          chat_sessions_limit?: number | null
          chat_sessions_period?: string | null
          created_at?: string
          display_name?: string
          id?: string
          monthly_upload_limit?: number | null
          name?: string
          price_monthly?: number
          retention_days?: number | null
          total_trace_limit?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      trace_comments: {
        Row: {
          comment_identifier: string | null
          comment_type: string
          content: string
          created_at: string
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          last_edited_at: string | null
          parent_comment_id: string | null
          trace_id: string
          trace_timestamp_ms: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          comment_identifier?: string | null
          comment_type: string
          content: string
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          last_edited_at?: string | null
          parent_comment_id?: string | null
          trace_id: string
          trace_timestamp_ms?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          comment_identifier?: string | null
          comment_type?: string
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          last_edited_at?: string | null
          parent_comment_id?: string | null
          trace_id?: string
          trace_timestamp_ms?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trace_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "trace_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trace_comments_trace_id_fkey"
            columns: ["trace_id"]
            isOneToOne: false
            referencedRelation: "traces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trace_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trace_permissions: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["trace_role"]
          trace_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["trace_role"]
          trace_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["trace_role"]
          trace_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trace_permissions_trace_id_fkey"
            columns: ["trace_id"]
            isOneToOne: false
            referencedRelation: "traces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trace_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      traces: {
        Row: {
          blob_path: string
          branch: string | null
          commit_sha: string | null
          duration_ms: number | null
          expires_at: string | null
          file_size_bytes: number | null
          folder_id: string | null
          id: string
          metadata: Json | null
          notes: string | null
          profile_type: string | null
          scenario: string | null
          updated_at: string | null
          upload_source: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          blob_path: string
          branch?: string | null
          commit_sha?: string | null
          duration_ms?: number | null
          expires_at?: string | null
          file_size_bytes?: number | null
          folder_id?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          profile_type?: string | null
          scenario?: string | null
          updated_at?: string | null
          upload_source?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          blob_path?: string
          branch?: string | null
          commit_sha?: string | null
          duration_ms?: number | null
          expires_at?: string | null
          file_size_bytes?: number | null
          folder_id?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          profile_type?: string | null
          scenario?: string | null
          updated_at?: string | null
          upload_source?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "traces_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traces_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          first_name: string | null
          id: string
          last_name: string | null
          lifetime_chat_analyses_count: number
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          lifetime_chat_analyses_count?: number
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lifetime_chat_analyses_count?: number
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          monthly_chat_sessions_count: number
          monthly_uploads_used: number
          payment_provider: string | null
          payment_provider_subscription_id: string | null
          plan_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end: string
          current_period_start: string
          id?: string
          monthly_chat_sessions_count?: number
          monthly_uploads_used?: number
          payment_provider?: string | null
          payment_provider_subscription_id?: string | null
          plan_id: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          monthly_chat_sessions_count?: number
          monthly_uploads_used?: number
          payment_provider?: string | null
          payment_provider_subscription_id?: string | null
          plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_trace_permission: {
        Args: {
          p_trace_id: string
          p_user_id: string
          min_role: Database["public"]["Enums"]["trace_role"]
        }
        Returns: boolean
      }
      create_api_key: {
        Args: { p_description: string; p_scopes: string[] }
        Returns: {
          api_key_id: string
          api_key_plaintext: string
        }[]
      }
      create_trace: {
        Args: {
          p_user_id: string
          p_blob_path: string
          p_upload_source: string
          p_make_public: boolean
          p_commit_sha?: string
          p_branch?: string
          p_scenario?: string
          p_duration_ms?: number
          p_file_size_bytes?: number
          p_profile_type?: string
          p_notes?: string
          p_folder_id?: string
        }
        Returns: {
          blob_path: string
          branch: string | null
          commit_sha: string | null
          duration_ms: number | null
          expires_at: string | null
          file_size_bytes: number | null
          folder_id: string | null
          id: string
          metadata: Json | null
          notes: string | null
          profile_type: string | null
          scenario: string | null
          updated_at: string | null
          upload_source: string
          uploaded_at: string
          user_id: string
        }
      }
      delete_folder_contents_by_ids: {
        Args: {
          p_folder_ids_to_delete: string[]
          p_trace_ids_to_delete: string[]
          p_original_folder_id: string
        }
        Returns: undefined
      }
      delete_old_ai_continuations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_chat_sessions_for_trace: {
        Args:
          | { in_trace_id: string }
          | { in_user_id: string; in_trace_id: string }
        Returns: {
          sessionId: string
          startedAt: string
          messageCount: number
        }[]
      }
      get_folder_view_data: {
        Args: {
          p_user_id: string
          p_folder_id?: string
          p_page?: number
          p_limit?: number
          p_search_query?: string
        }
        Returns: Json
      }
      get_public_trace_details: {
        Args: { trace_uuid: string }
        Returns: {
          id: string
          blob_path: string
        }[]
      }
      get_recursive_folder_contents: {
        Args: { folder_id_to_check: string }
        Returns: Json
      }
      get_user_accessible_traces: {
        Args:
          | { p_user_id: string; p_offset: number; p_limit: number }
          | {
              p_user_id: string
              p_offset: number
              p_limit: number
              p_search_query: string
              p_folder_id?: string
            }
        Returns: {
          id: string
          user_id: string
          uploaded_at: string
          commit_sha: string
          branch: string
          scenario: string
          device_model: string
          duration_ms: number
          blob_path: string
          file_size_bytes: number
          notes: string
          profile_type: string
          owner: Json
          folder_id: string
        }[]
      }
      get_user_accessible_traces_count: {
        Args:
          | { p_user_id: string }
          | { p_user_id: string; p_search_query: string; p_folder_id?: string }
        Returns: number
      }
      get_user_subscription_usage: {
        Args: { p_user_id: string }
        Returns: {
          monthly_uploads_used: number
          monthly_upload_limit: number
          current_period_end: string
          plan_name: string
          total_trace_limit: number
          current_total_traces: number
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      increment_lifetime_chat_analyses: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      increment_monthly_chat_sessions: {
        Args: { p_user_subscription_id: string }
        Returns: undefined
      }
      reset_expired_monthly_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      revoke_api_key: {
        Args: { p_key_id: string }
        Returns: undefined
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      verify_api_key: {
        Args: { p_plaintext_key: string }
        Returns: {
          o_user_id: string
          o_is_valid: boolean
          o_scopes: string[]
        }[]
      }
    }
    Enums: {
      trace_role: "viewer" | "editor" | "owner"
    }
    CompositeTypes: {
      trace_with_owner: {
        id: string | null
        user_id: string | null
        uploaded_at: string | null
        commit_sha: string | null
        branch: string | null
        scenario: string | null
        device_model: string | null
        duration_ms: number | null
        blob_path: string | null
        file_size_bytes: number | null
        notes: string | null
        profile_type: string | null
        owner: Json | null
        folder_id: string | null
      }
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      trace_role: ["viewer", "editor", "owner"],
    },
  },
} as const
