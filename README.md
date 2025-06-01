# AI 肌経過分析アプリ

AIを活用した肌の経過分析アプリケーションです。複数の時点での顔画像をアップロードし、時期/ラベルを付けてAIによる肌質・輪郭分析を行い、総合的な経過レポートで変化を把握できます。

## 機能

- 🔐 **Clerk認証** - セキュアなユーザー管理
- 🤖 **Gemini AI分析** - 高度な肌質・輪郭分析
- 💾 **Supabaseデータ永続化** - 分析結果の保存とクラウド統合
- 📊 **総合経過分析** - 時系列での肌状態変化の追跡
- 📁 **データエクスポート/削除** - 個人データの管理

## 技術スタック

- **フロントエンド**: React + TypeScript + Vite + Tailwind CSS
- **認証**: Clerk
- **AI分析**: Google Gemini API
- **バックエンド**: Supabase (PostgreSQL + Storage)
- **デプロイ**: Vercel

## セットアップ

### 1. 環境変数の設定

プロジェクトルートに `.env.local` ファイルを作成し、以下の環境変数を設定してください：

```env
# Gemini AI API
GEMINI_API_KEY=your_gemini_api_key

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Supabase
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. Supabaseの設定

#### データベーステーブル作成

Supabaseダッシュボードで以下のSQLを実行してテーブルを作成してください：

```sql
-- ユーザープロフィールテーブル
CREATE TABLE user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  profile_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 分析セッションテーブル
CREATE TABLE analysis_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_name TEXT NOT NULL DEFAULT 'Analysis Session',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 分析ポイントテーブル
CREATE TABLE analysis_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  point_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- アップロード画像テーブル
CREATE TABLE uploaded_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_point_id UUID REFERENCES analysis_points(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 分析結果テーブル
CREATE TABLE analysis_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_point_id UUID REFERENCES analysis_points(id) ON DELETE CASCADE,
  result_data JSONB NOT NULL,
  skin_type TEXT,
  skin_condition TEXT,
  texture_analysis JSONB,
  color_analysis JSONB,
  aging_analysis JSONB,
  recommendations JSONB,
  confidence_score NUMERIC,
  analysis_version TEXT DEFAULT '1.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 総合レポートテーブル
CREATE TABLE overall_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  report_data JSONB NOT NULL,
  progression_summary TEXT,
  key_changes JSONB,
  recommendations JSONB,
  report_version TEXT DEFAULT '1.0',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLSの有効化
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE overall_reports ENABLE ROW LEVEL SECURITY;
```

#### ストレージバケットの作成

```sql
-- 画像ストレージバケットの作成
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'skin-analysis-images', 
  'skin-analysis-images', 
  false,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);
```

#### RLSポリシーの設定

Supabaseダッシュボードのストレージ設定で、以下のポリシーを手動で追加してください：

1. **INSERT Policy**: ユーザーが自分のフォルダにファイルをアップロード可能
2. **SELECT Policy**: ユーザーが自分のファイルのみ閲覧可能
3. **DELETE Policy**: ユーザーが自分のファイルのみ削除可能

### 4. 開発サーバーの起動

```bash
npm run dev
```

## プロジェクト構造

```
src/
├── components/          # Reactコンポーネント
│   ├── FileUpload.tsx   # ファイルアップロード（Supabase統合）
│   ├── AnalysisReport.tsx
│   └── UserProfile.tsx
├── services/            # サービス層
│   ├── geminiService.ts # AI分析サービス
│   └── supabaseService.ts # データベース操作
├── lib/
│   └── supabase.ts      # Supabaseクライアント設定
├── types.ts             # TypeScript型定義
└── App.tsx              # メインアプリケーション
```

## データベース設計

### 主要テーブル
- `user_profiles`: ユーザー情報（Clerkと連携）
- `analysis_sessions`: 分析セッション
- `analysis_points`: 分析ポイント（時期/ラベル）
- `uploaded_images`: 画像メタデータ
- `analysis_results`: AI分析結果
- `overall_reports`: 総合経過レポート

### データフロー
1. ユーザー登録/ログイン（Clerk）
2. Supabaseにユーザープロフィール作成
3. 分析セッション開始
4. 画像アップロード（Supabaseストレージ）
5. AI分析実行（Gemini API）
6. 結果をSupabaseに保存
7. 総合レポート生成・保存

## セキュリティ

- Row Level Security (RLS) による適切なデータアクセス制御
- Clerkによる認証・認可
- 画像ファイルは非公開バケットに保存
- 環境変数による機密情報管理

## ライセンス

このプロジェクトはプライベートプロジェクトです。
