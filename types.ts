
export interface SkinAgeReport {
  推定肌年齢: string;
  所見: string;
}

export interface EvaluationAndFindings {
  評価: string;
  所見: string;
}

export interface SpotsReport {
  評価: string;
  種類と所見: string;
}

export interface WrinklesReport {
  評価: string;
  種類と所見: string;
}

export interface MainDimensions {
  "顔全体の縦の長さ（髪の生え際～顎先）": string;
  "顔全体の横の最大幅": string;
  "額の幅（こめかみ間）": string;
  "頬骨の幅": string;
  "エラの幅": string;
  "顎先の幅": string;
}

export interface FaceType {
  推定: string;
  根拠: string;
}

export interface Symmetry {
  所見: string;
}

export interface ContourAnalysisReport {
  主要寸法: MainDimensions;
  顔のタイプ: FaceType;
  左右対称性: Symmetry;
}

export interface AnalysisResult {
  重要事項: string;
  肌年齢: SkinAgeReport;
  "ハリ（弾力）": EvaluationAndFindings;
  "毛穴（なめらかさ）": EvaluationAndFindings;
  キメ: EvaluationAndFindings;
  シミ: SpotsReport;
  シワ: WrinklesReport;
  赤み: EvaluationAndFindings;
  輪郭分析: ContourAnalysisReport;
  総合所見: string;
}

export interface UploadedImageFile {
  id: string; // Added unique ID for each file instance
  name: string;
  type: string; 
  base64: string; 
  previewUrl: string;
}

export interface Part {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface AnalysisFileSet {
  id: string;
  name: string; // e.g., "分析ポイント #1"
  label: string; // User-defined label, e.g., "2024年1月", "前回"
  files: UploadedImageFile[];
}

// For the overall chronological analysis report
export interface OverallReportContent {
  概要: string;
  改善点: string;
  要注意点または悪化点: string;
  観察された主な傾向: string;
  推奨事項: string;
}
export interface OverallReport {
  総合経過分析レポート: OverallReportContent;
}
