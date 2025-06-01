import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// 通常のクライアント（認証が必要な操作用）
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 管理者クライアント（RLSをバイパスする操作用）
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : supabase

// Database type definitions based on existing schema
export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          clerk_user_id: string
          email: string | null
          first_name: string | null
          last_name: string | null
          profile_image_url: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          clerk_user_id: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          profile_image_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          clerk_user_id?: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          profile_image_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      analysis_sessions: {
        Row: {
          id: string
          user_id: string | null
          session_name: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          session_name: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          session_name?: string
          created_at?: string | null
          updated_at?: string | null
        }
      }
      analysis_points: {
        Row: {
          id: string
          session_id: string | null
          name: string
          label: string
          point_order: number
          created_at: string | null
        }
        Insert: {
          id?: string
          session_id?: string | null
          name: string
          label: string
          point_order: number
          created_at?: string | null
        }
        Update: {
          id?: string
          session_id?: string | null
          name?: string
          label?: string
          point_order?: number
          created_at?: string | null
        }
      }
      uploaded_images: {
        Row: {
          id: string
          analysis_point_id: string | null
          file_name: string
          file_size: number
          mime_type: string
          storage_path: string
          uploaded_at: string | null
        }
        Insert: {
          id?: string
          analysis_point_id?: string | null
          file_name: string
          file_size: number
          mime_type: string
          storage_path: string
          uploaded_at?: string | null
        }
        Update: {
          id?: string
          analysis_point_id?: string | null
          file_name?: string
          file_size?: number
          mime_type?: string
          storage_path?: string
          uploaded_at?: string | null
        }
      }
      analysis_results: {
        Row: {
          id: string
          analysis_point_id: string | null
          result_data: any
          skin_type: string | null
          skin_condition: string | null
          texture_analysis: any | null
          color_analysis: any | null
          aging_analysis: any | null
          recommendations: any | null
          confidence_score: number | null
          analysis_version: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          analysis_point_id?: string | null
          result_data: any
          skin_type?: string | null
          skin_condition?: string | null
          texture_analysis?: any | null
          color_analysis?: any | null
          aging_analysis?: any | null
          recommendations?: any | null
          confidence_score?: number | null
          analysis_version?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          analysis_point_id?: string | null
          result_data?: any
          skin_type?: string | null
          skin_condition?: string | null
          texture_analysis?: any | null
          color_analysis?: any | null
          aging_analysis?: any | null
          recommendations?: any | null
          confidence_score?: number | null
          analysis_version?: string | null
          created_at?: string | null
        }
      }
      overall_reports: {
        Row: {
          id: string
          session_id: string | null
          report_data: any
          progression_summary: string | null
          key_changes: any | null
          recommendations: any | null
          report_version: string | null
          generated_at: string | null
        }
        Insert: {
          id?: string
          session_id?: string | null
          report_data: any
          progression_summary?: string | null
          key_changes?: any | null
          recommendations?: any | null
          report_version?: string | null
          generated_at?: string | null
        }
        Update: {
          id?: string
          session_id?: string | null
          report_data?: any
          progression_summary?: string | null
          key_changes?: any | null
          recommendations?: any | null
          report_version?: string | null
          generated_at?: string | null
        }
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