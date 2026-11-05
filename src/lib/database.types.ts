
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_cache": {
                  Row: {
                    "created_at": string,"key": string,"output": NonNullable<Json>,"purpose": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"key": string,"output": NonNullable<Json>,"purpose": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"key"?: string,"output"?: NonNullable<Json>,"purpose"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_calls": {
                  Row: {
                    "completion_tokens": number,"cost_usd": number,"created_at": string,"error_code": string | null,"id": number,"latency_ms": number | null,"model": string,"ok": boolean,"prompt_tokens": number,"provider": string,"purpose": string,"reasoning_tokens": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completion_tokens"?: number,"cost_usd"?: number,"created_at"?: string,"error_code"?: string | null,"id"?: never,"latency_ms"?: number | null,"model": string,"ok": boolean,"prompt_tokens"?: number,"provider": string,"purpose": string,"reasoning_tokens"?: number,"user_id": string
                  }
                  Update: {
                    "completion_tokens"?: number,"cost_usd"?: number,"created_at"?: string,"error_code"?: string | null,"id"?: never,"latency_ms"?: number | null,"model"?: string,"ok"?: boolean,"prompt_tokens"?: number,"provider"?: string,"purpose"?: string,"reasoning_tokens"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"card_states": {
                  Row: {
                    "card_id": string,"difficulty": number,"due": string,"elapsed_days": number,"lapses": number,"last_review": string | null,"learning_steps": number,"reps": number,"scheduled_days": number,"stability": number,"state": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card_id": string,"difficulty"?: number,"due"?: string,"elapsed_days"?: number,"lapses"?: number,"last_review"?: string | null,"learning_steps"?: number,"reps"?: number,"scheduled_days"?: number,"stability"?: number,"state"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "card_id"?: string,"difficulty"?: number,"due"?: string,"elapsed_days"?: number,"lapses"?: number,"last_review"?: string | null,"learning_steps"?: number,"reps"?: number,"scheduled_days"?: number,"stability"?: number,"state"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_states_card_id_user_id_fkey"
      columns: ["card_id","user_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"cards": {
                  Row: {
                    "content": NonNullable<Json>,"created_at": string,"document_id": string,"edited": boolean,"flag_reason": string | null,"gen_hash": string | null,"id": string,"notion_id": string,"position": number,"source_pages": (number)[],"source_quote": string | null,"status": string,"subject_id": string,"type": string,"updated_at": string,"user_id": string,"verified": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "content": NonNullable<Json>,"created_at"?: string,"document_id": string,"edited"?: boolean,"flag_reason"?: string | null,"gen_hash"?: string | null,"id"?: string,"notion_id": string,"position"?: number,"source_pages"?: (number)[],"source_quote"?: string | null,"status"?: string,"subject_id": string,"type": string,"updated_at"?: string,"user_id"?: string,"verified"?: boolean
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"created_at"?: string,"document_id"?: string,"edited"?: boolean,"flag_reason"?: string | null,"gen_hash"?: string | null,"id"?: string,"notion_id"?: string,"position"?: number,"source_pages"?: (number)[],"source_quote"?: string | null,"status"?: string,"subject_id"?: string,"type"?: string,"updated_at"?: string,"user_id"?: string,"verified"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "cards_document_id_user_id_fkey"
      columns: ["document_id","user_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "cards_notion_id_user_id_fkey"
      columns: ["notion_id","user_id"]
isOneToOne: false
      referencedRelation: "notions"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "cards_subject_id_user_id_fkey"
      columns: ["subject_id","user_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"document_pages": {
                  Row: {
                    "document_id": string,"id": number,"language": string,"page_number": number,"text": string,"tsv": unknown,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "document_id": string,"id"?: never,"language"?: string,"page_number": number,"text": string,"tsv"?: never,"user_id"?: string
                  }
                  Update: {
                    "document_id"?: string,"id"?: never,"language"?: string,"page_number"?: number,"text"?: string,"tsv"?: never,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_pages_document_id_user_id_fkey"
      columns: ["document_id","user_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "created_at": string,"error_message": string | null,"filename": string,"id": string,"kind": string,"language": string,"mime": string,"origin": string,"page_count": number | null,"sha256": string,"size_bytes": number,"status": string,"storage_path": string | null,"subject_id": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error_message"?: string | null,"filename": string,"id"?: string,"kind"?: string,"language"?: string,"mime": string,"origin"?: string,"page_count"?: number | null,"sha256": string,"size_bytes": number,"status"?: string,"storage_path"?: string | null,"subject_id": string,"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"error_message"?: string | null,"filename"?: string,"id"?: string,"kind"?: string,"language"?: string,"mime"?: string,"origin"?: string,"page_count"?: number | null,"sha256"?: string,"size_bytes"?: number,"status"?: string,"storage_path"?: string | null,"subject_id"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_subject_id_user_id_fkey"
      columns: ["subject_id","user_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "attempts": number,"created_at": string,"dedupe_key": string | null,"id": string,"last_error": string | null,"locked_until": string | null,"max_attempts": number,"payload": NonNullable<Json>,"progress": number,"run_after": string,"status": string,"step": string,"total": number,"type": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"dedupe_key"?: string | null,"id"?: string,"last_error"?: string | null,"locked_until"?: string | null,"max_attempts"?: number,"payload"?: NonNullable<Json>,"progress"?: number,"run_after"?: string,"status"?: string,"step"?: string,"total"?: number,"type": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"dedupe_key"?: string | null,"id"?: string,"last_error"?: string | null,"locked_until"?: string | null,"max_attempts"?: number,"payload"?: NonNullable<Json>,"progress"?: number,"run_after"?: string,"status"?: string,"step"?: string,"total"?: number,"type"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notions": {
                  Row: {
                    "content_hash": string,"created_at": string,"document_id": string,"error_message": string | null,"id": string,"language": string,"pages": (number)[],"position": number,"source_text": string,"status": string,"subject_id": string,"title": string,"tsv": unknown,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content_hash": string,"created_at"?: string,"document_id": string,"error_message"?: string | null,"id"?: string,"language"?: string,"pages": (number)[],"position": number,"source_text": string,"status"?: string,"subject_id": string,"title": string,"tsv"?: never,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "content_hash"?: string,"created_at"?: string,"document_id"?: string,"error_message"?: string | null,"id"?: string,"language"?: string,"pages"?: (number)[],"position"?: number,"source_text"?: string,"status"?: string,"subject_id"?: string,"title"?: string,"tsv"?: never,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notions_document_id_user_id_fkey"
      columns: ["document_id","user_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "notions_subject_id_user_id_fkey"
      columns: ["subject_id","user_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"parking": {
                  Row: {
                    "created_at": string,"done": boolean,"id": string,"session_id": string | null,"text": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"done"?: boolean,"id"?: string,"session_id"?: string | null,"text": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"done"?: boolean,"id"?: string,"session_id"?: string | null,"text"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"last_reminder_on": string | null,"settings": NonNullable<Json>,"streak": NonNullable<Json>,"timezone": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"last_reminder_on"?: string | null,"settings"?: NonNullable<Json>,"streak"?: NonNullable<Json>,"timezone"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"last_reminder_on"?: string | null,"settings"?: NonNullable<Json>,"streak"?: NonNullable<Json>,"timezone"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reviews": {
                  Row: {
                    "answer": Json | null,"card_id": string,"correct": boolean | null,"created_at": string,"id": string,"outcome": string,"rating": number | null,"reviewed_at": string,"session_id": string | null,"state_after": Json | null,"state_before": Json | null,"undone": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer"?: Json | null,"card_id": string,"correct"?: boolean | null,"created_at"?: string,"id": string,"outcome": string,"rating"?: number | null,"reviewed_at": string,"session_id"?: string | null,"state_after"?: Json | null,"state_before"?: Json | null,"undone"?: boolean,"user_id"?: string
                  }
                  Update: {
                    "answer"?: Json | null,"card_id"?: string,"correct"?: boolean | null,"created_at"?: string,"id"?: string,"outcome"?: string,"rating"?: number | null,"reviewed_at"?: string,"session_id"?: string | null,"state_after"?: Json | null,"state_before"?: Json | null,"undone"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_card_id_user_id_fkey"
      columns: ["card_id","user_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "reviews_session_id_user_id_fkey"
      columns: ["session_id","user_id"]
isOneToOne: false
      referencedRelation: "study_sessions"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"session_events": {
                  Row: {
                    "at": string,"card_id": string | null,"id": string,"session_id": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at": string,"card_id"?: string | null,"id": string,"session_id": string,"type": string,"user_id"?: string
                  }
                  Update: {
                    "at"?: string,"card_id"?: string | null,"id"?: string,"session_id"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_events_session_id_user_id_fkey"
      columns: ["session_id","user_id"]
isOneToOne: false
      referencedRelation: "study_sessions"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"study_sessions": {
                  Row: {
                    "ended_at": string | null,"id": string,"items": NonNullable<Json>,"mode": string,"planned_minutes": number,"position": number,"started_at": string,"stats": NonNullable<Json>,"status": string,"subject_id": string | null,"timer": Json | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ended_at"?: string | null,"id": string,"items"?: NonNullable<Json>,"mode": string,"planned_minutes"?: number,"position"?: number,"started_at"?: string,"stats"?: NonNullable<Json>,"status"?: string,"subject_id"?: string | null,"timer"?: Json | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "ended_at"?: string | null,"id"?: string,"items"?: NonNullable<Json>,"mode"?: string,"planned_minutes"?: number,"position"?: number,"started_at"?: string,"stats"?: NonNullable<Json>,"status"?: string,"subject_id"?: string | null,"timer"?: Json | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "study_sessions_subject_id_user_id_fkey"
      columns: ["subject_id","user_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"subjects": {
                  Row: {
                    "created_at": string,"id": string,"is_demo": boolean,"kind": string,"language": string,"name": string,"position": number,"slug": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_demo"?: boolean,"kind"?: string,"language"?: string,"name": string,"position"?: number,"slug": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_demo"?: boolean,"kind"?: string,"language"?: string,"name"?: string,"position"?: number,"slug"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_allow_email":
{ Args: { "p_email": string }; Returns: undefined
                           },
"admin_set_allowed_emails":
{ Args: { "p_emails": (string)[] }; Returns: number
                           },
"claim_jobs":
{ Args: { "p_lease_seconds": number,"p_limit": number,"p_user"?: string }; Returns: {
              "attempts": number,
"created_at": string,
"dedupe_key": string | null,
"id": string,
"last_error": string | null,
"locked_until": string | null,
"max_attempts": number,
"payload": NonNullable<Json>,
"progress": number,
"run_after": string,
"status": string,
"step": string,
"total": number,
"type": string,
"updated_at": string,
"user_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"hook_before_user_created":
{ Args: { "event": Json }; Returns: Json
                           },
"rate_limit_hit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
