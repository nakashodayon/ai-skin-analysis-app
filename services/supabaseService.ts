import { supabase, supabaseAdmin } from '../lib/supabase'
import { Database } from '../lib/supabase'
import { AnalysisResult, AnalysisFileSet, OverallReport, UploadedImageFile } from '../types'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']
type AnalysisSession = Database['public']['Tables']['analysis_sessions']['Row']
type AnalysisPoint = Database['public']['Tables']['analysis_points']['Row']
type UploadedImage = Database['public']['Tables']['uploaded_images']['Row']
type AnalysisResultRow = Database['public']['Tables']['analysis_results']['Row']
type OverallReportRow = Database['public']['Tables']['overall_reports']['Row']

// User Management
export class UserService {
  static async getOrCreateUser(clerkUserId: string, email?: string, firstName?: string, lastName?: string): Promise<UserProfile> {
    // Check if user already exists
    const existingUser = await this.getUserByClerkId(clerkUserId)
    if (existingUser) {
      return existingUser
    }

    // Create new user using admin client to bypass RLS
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        clerk_user_id: clerkUserId,
        email: email || null,
        first_name: firstName || null,
        last_name: lastName || null,
      })
      .select()
      .single()

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`)
    }

    return newUser
  }

  static async updateUser(clerkUserId: string, updates: Partial<Pick<UserProfile, 'email' | 'first_name' | 'last_name' | 'profile_image_url'>>): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', clerkUserId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`)
    }

    return data
  }

  static async getUserByClerkId(clerkUserId: string): Promise<UserProfile | null> {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch user: ${error.message}`)
    }

    return data
  }
}

// Session Management
export class SessionService {
  static async createSession(userId: string, sessionName: string): Promise<AnalysisSession> {
    const { data, error } = await supabaseAdmin
      .from('analysis_sessions')
      .insert({
        user_id: userId,
        session_name: sessionName,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`)
    }

    return data
  }

  static async getUserSessions(userId: string): Promise<AnalysisSession[]> {
    const { data, error } = await supabase
      .from('analysis_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch sessions: ${error.message}`)
    }

    return data
  }

  static async updateSession(sessionId: string, updates: Partial<Pick<AnalysisSession, 'session_name'>>): Promise<AnalysisSession> {
    const { data, error } = await supabase
      .from('analysis_sessions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update session: ${error.message}`)
    }

    return data
  }

  static async deleteSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('analysis_sessions')
      .delete()
      .eq('id', sessionId)

    if (error) {
      throw new Error(`Failed to delete session: ${error.message}`)
    }
  }
}

// Analysis Points Management
export class AnalysisPointService {
  static async createAnalysisPoint(sessionId: string, name: string, label: string, pointOrder: number): Promise<AnalysisPoint> {
    const { data, error } = await supabaseAdmin
      .from('analysis_points')
      .insert({
        session_id: sessionId,
        name,
        label,
        point_order: pointOrder,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create analysis point: ${error.message}`)
    }

    return data
  }

  static async getSessionAnalysisPoints(sessionId: string): Promise<AnalysisPoint[]> {
    const { data, error } = await supabase
      .from('analysis_points')
      .select('*')
      .eq('session_id', sessionId)
      .order('point_order', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch analysis points: ${error.message}`)
    }

    return data
  }

  static async updateAnalysisPoint(pointId: string, updates: Partial<Pick<AnalysisPoint, 'name' | 'label' | 'point_order'>>): Promise<AnalysisPoint> {
    const { data, error } = await supabase
      .from('analysis_points')
      .update(updates)
      .eq('id', pointId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update analysis point: ${error.message}`)
    }

    return data
  }

  static async deleteAnalysisPoint(pointId: string): Promise<void> {
    const { error } = await supabase
      .from('analysis_points')
      .delete()
      .eq('id', pointId)

    if (error) {
      throw new Error(`Failed to delete analysis point: ${error.message}`)
    }
  }
}

// File Storage Management
export class StorageService {
  static async uploadImage(file: File, userId: string, pointId: string): Promise<{ storagePath: string; publicUrl: string }> {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`
    const storagePath = `${userId}/${pointId}/${fileName}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('skin-analysis-images')
      .upload(storagePath, file)

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`)
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('skin-analysis-images')
      .getPublicUrl(storagePath)

    return {
      storagePath,
      publicUrl: urlData.publicUrl,
    }
  }

  static async deleteImage(storagePath: string): Promise<void> {
    const { error } = await supabaseAdmin.storage
      .from('skin-analysis-images')
      .remove([storagePath])

    if (error) {
      throw new Error(`Failed to delete image: ${error.message}`)
    }
  }

  static getImageUrl(storagePath: string): string {
    const { data } = supabaseAdmin.storage
      .from('skin-analysis-images')
      .getPublicUrl(storagePath)

    return data.publicUrl
  }
}

// Image Metadata Management
export class ImageService {
  static async saveImageMetadata(pointId: string, fileName: string, fileSize: number, mimeType: string, storagePath: string): Promise<UploadedImage> {
    const { data, error } = await supabaseAdmin
      .from('uploaded_images')
      .insert({
        analysis_point_id: pointId,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        storage_path: storagePath,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to save image metadata: ${error.message}`)
    }

    return data
  }

  static async getPointImages(pointId: string): Promise<UploadedImage[]> {
    const { data, error } = await supabase
      .from('uploaded_images')
      .select('*')
      .eq('analysis_point_id', pointId)
      .order('uploaded_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch images: ${error.message}`)
    }

    return data
  }

  static async deleteImageMetadata(imageId: string): Promise<void> {
    const { error } = await supabase
      .from('uploaded_images')
      .delete()
      .eq('id', imageId)

    if (error) {
      throw new Error(`Failed to delete image metadata: ${error.message}`)
    }
  }
}

// Analysis Results Management
export class AnalysisResultService {
  static async saveAnalysisResult(pointId: string, analysisResult: AnalysisResult): Promise<AnalysisResultRow> {
    const { data, error } = await supabaseAdmin
      .from('analysis_results')
      .insert({
        analysis_point_id: pointId,
        result_data: analysisResult,
        skin_type: analysisResult.肌年齢?.推定肌年齢 || null,
        skin_condition: analysisResult.重要事項 || null,
        texture_analysis: {
          ハリ: analysisResult["ハリ（弾力）"],
          毛穴: analysisResult["毛穴（なめらかさ）"],
          キメ: analysisResult.キメ,
        },
        color_analysis: {
          シミ: analysisResult.シミ,
          赤み: analysisResult.赤み,
        },
        aging_analysis: {
          肌年齢: analysisResult.肌年齢,
          シワ: analysisResult.シワ,
        },
        recommendations: analysisResult.総合所見 || null,
        confidence_score: null, // Not available in current structure
        analysis_version: '1.0',
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to save analysis result: ${error.message}`)
    }

    return data
  }

  static async getPointAnalysisResults(pointId: string): Promise<AnalysisResultRow[]> {
    const { data, error } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('analysis_point_id', pointId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch analysis results: ${error.message}`)
    }

    return data
  }

  static async getSessionAnalysisResults(sessionId: string): Promise<AnalysisResultRow[]> {
    const { data, error } = await supabase
      .from('analysis_results')
      .select(`
        *,
        analysis_points!inner(
          session_id,
          name,
          label,
          point_order
        )
      `)
      .eq('analysis_points.session_id', sessionId)
      .order('analysis_points.point_order', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch session analysis results: ${error.message}`)
    }

    return data
  }
}

// Overall Reports Management
export class OverallReportService {
  static async saveOverallReport(sessionId: string, report: OverallReport): Promise<OverallReportRow> {
    const { data, error } = await supabaseAdmin
      .from('overall_reports')
      .insert({
        session_id: sessionId,
        report_data: report,
        progression_summary: report.総合経過分析レポート?.概要 || null,
        key_changes: {
          改善点: report.総合経過分析レポート?.改善点,
          要注意点または悪化点: report.総合経過分析レポート?.要注意点または悪化点,
          主な傾向: report.総合経過分析レポート?.観察された主な傾向,
        },
        recommendations: report.総合経過分析レポート?.推奨事項 || null,
        report_version: '1.0',
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to save overall report: ${error.message}`)
    }

    return data
  }

  static async getSessionOverallReports(sessionId: string): Promise<OverallReportRow[]> {
    const { data, error } = await supabase
      .from('overall_reports')
      .select('*')
      .eq('session_id', sessionId)
      .order('generated_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch overall reports: ${error.message}`)
    }

    return data
  }

  static async getLatestOverallReport(sessionId: string): Promise<OverallReportRow | null> {
    const { data, error } = await supabase
      .from('overall_reports')
      .select('*')
      .eq('session_id', sessionId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch latest overall report: ${error.message}`)
    }

    return data
  }
}

// Comprehensive Data Service
export class DataService {
  static async exportUserData(clerkUserId: string): Promise<any> {
    try {
      const user = await UserService.getUserByClerkId(clerkUserId)
      if (!user) {
        throw new Error('User not found')
      }

      const sessions = await SessionService.getUserSessions(user.id)
      const fullData = await Promise.all(
        sessions.map(async (session) => {
          const analysisPoints = await AnalysisPointService.getSessionAnalysisPoints(session.id)
          const analysisResults = await AnalysisResultService.getSessionAnalysisResults(session.id)
          const overallReports = await OverallReportService.getSessionOverallReports(session.id)
          
          const pointsWithImages = await Promise.all(
            analysisPoints.map(async (point) => {
              const images = await ImageService.getPointImages(point.id)
              return { ...point, images }
            })
          )

          return {
            session,
            analysisPoints: pointsWithImages,
            analysisResults,
            overallReports,
          }
        })
      )

      return {
        user,
        sessions: fullData,
        exportedAt: new Date().toISOString(),
      }
    } catch (error) {
      throw new Error(`Failed to export user data: ${error}`)
    }
  }

  static async deleteAllUserData(clerkUserId: string): Promise<void> {
    try {
      const user = await UserService.getUserByClerkId(clerkUserId)
      if (!user) {
        return
      }

      const sessions = await SessionService.getUserSessions(user.id)
      
      // Delete all data for each session
      for (const session of sessions) {
        const analysisPoints = await AnalysisPointService.getSessionAnalysisPoints(session.id)
        
        // Delete images from storage and metadata
        for (const point of analysisPoints) {
          const images = await ImageService.getPointImages(point.id)
          for (const image of images) {
            await StorageService.deleteImage(image.storage_path)
            await ImageService.deleteImageMetadata(image.id)
          }
          await AnalysisPointService.deleteAnalysisPoint(point.id)
        }
        
        await SessionService.deleteSession(session.id)
      }

      // Delete user profile
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .delete()
        .eq('clerk_user_id', clerkUserId)

      if (error) {
        throw new Error(`Failed to delete user profile: ${error.message}`)
      }
    } catch (error) {
      throw new Error(`Failed to delete user data: ${error}`)
    }
  }
}

// Health Check Service
export class HealthCheckService {
  static async checkSupabaseConnection(): Promise<{ status: 'healthy' | 'error', message: string, details?: any }> {
    try {
      // Test basic connection
      const { data, error } = await supabase
        .from('user_profiles')
        .select('count')
        .limit(1)

      if (error) {
        return {
          status: 'error',
          message: 'Database connection failed',
          details: error
        }
      }

      // Test all required tables exist
      const tables = [
        'user_profiles',
        'analysis_sessions', 
        'analysis_points',
        'uploaded_images',
        'analysis_results',
        'overall_reports'
      ]

      const tableChecks = await Promise.all(
        tables.map(async (table) => {
          try {
            const { error } = await supabase
              .from(table)
              .select('count')
              .limit(1)
            return { table, exists: !error }
          } catch (err) {
            return { table, exists: false, error: err }
          }
        })
      )

      const missingTables = tableChecks.filter(check => !check.exists)
      
      if (missingTables.length > 0) {
        return {
          status: 'error',
          message: 'Some database tables are missing',
          details: missingTables
        }
      }

      // Test storage bucket exists
      try {
        const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets()
        const skinAnalysisBucket = buckets?.find(bucket => bucket.id === 'skin-analysis-images')
        
        if (!skinAnalysisBucket) {
          return {
            status: 'error',
            message: 'Storage bucket "skin-analysis-images" not found',
            details: { availableBuckets: buckets?.map(b => b.id) }
          }
        }
      } catch (storageError) {
        return {
          status: 'error',
          message: 'Storage service check failed',
          details: storageError
        }
      }

      return {
        status: 'healthy',
        message: 'All Supabase services are functioning correctly'
      }

    } catch (error) {
      return {
        status: 'error',
        message: 'Unexpected error during health check',
        details: error
      }
    }
  }

  static async getSystemInfo(): Promise<any> {
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets()
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('count')
        .single()

      return {
        timestamp: new Date().toISOString(),
        buckets: buckets?.length || 0,
        totalUsers: userData?.count || 0,
        supabaseUrl: process.env.VITE_SUPABASE_URL?.replace(/\/.*/, '//***') // Hide full URL for security
      }
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        error: 'Failed to get system info',
        details: error
      }
    }
  }
} 