
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { UploadedImageFile, AnalysisResult, Part, OverallReport, AnalysisFileSet } from '../types';
import { GEMINI_MODEL_NAME, SYSTEM_INSTRUCTION_TEXT_PART, GENERATION_CONFIG, SYSTEM_INSTRUCTION_OVERALL_ANALYSIS_PART, OVERALL_GENERATION_CONFIG } from '../constants';

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
}

const getAiInstance = (): GoogleGenAI => {
    if (!ai) {
        if (!process.env.API_KEY) {
            throw new Error("APIキーが設定されていません。環境変数 API_KEY を設定してください。");
        }
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return ai;
}

const parseJsonResponse = <T>(responseText: string | undefined): T => {
    if (!responseText) {
        throw new Error("APIからのレスポンスが空です。");
    }
    let jsonStr = responseText.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
        jsonStr = match[2].trim();
    }
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("JSONパースエラー:", e, "元の文字列:", jsonStr);
        throw new Error(`APIからのJSONレスポンスの解析に失敗しました。内容: ${jsonStr.substring(0,1000)}`);
    }
}


export const analyzeSkinWithGemini = async (
  files: UploadedImageFile[],
  previousAnalysisResultText?: string // Optional: JSON string of the previous analysis result
): Promise<AnalysisResult> => {
  const currentAi = getAiInstance();
  if (!files || files.length === 0) {
    throw new Error("分析するファイルが選択されていません。");
  }

  const imageParts: Part[] = files.map(file => ({
    inlineData: {
      mimeType: file.type,
      data: file.base64,
    },
  }));

  const allParts: Part[] = [];

  if (previousAnalysisResultText) {
    allParts.push({
      text: `# 前回の分析結果と今回の変化点についての指示
前回の分析結果(JSON形式)は以下の通りです:
\`\`\`json
${previousAnalysisResultText}
\`\`\`
今回の画像セットを分析する際には、上記の前回の結果と比較し、特に肌の状態（肌年齢、ハリ、毛穴、キメ、シミ、シワ、赤み）および輪郭について、どのような変化が見られるか、または維持されているかを具体的に指摘してください。改善点、悪化した点、変わらない点を明確に記述し、総合所見では経過を踏まえたアドバイスを含めてください。
現在の画像セットの分析に集中しつつ、過去の結果を参考情報として活用してください。
---
次に、通常の分析指示を開始します。
`
    });
  }

  allParts.push(SYSTEM_INSTRUCTION_TEXT_PART);
  allParts.push(...imageParts);

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: [{ parts: allParts }],
      config: GENERATION_CONFIG,
    });
    
    return parseJsonResponse<AnalysisResult>(response.text);

  } catch (error) {
    console.error("Gemini API呼び出しエラー (analyzeSkinWithGemini):", error);
    if (error instanceof Error) {
        throw new Error(`Gemini APIエラー: ${error.message}`);
    }
    throw new Error("Gemini APIとの通信中に不明なエラーが発生しました。");
  }
};


export const generateOverallAnalysisReport = async (
  analysisResultsWithLabels: { result: AnalysisResult; label: string }[]
): Promise<OverallReport> => {
  const currentAi = getAiInstance();
  if (!analysisResultsWithLabels || analysisResultsWithLabels.length < 2) {
    throw new Error("経過分析のためには、少なくとも2つの分析結果が必要です。");
  }

  const previousResultsTextParts: Part[] = analysisResultsWithLabels.map(item => ({
    text: `## 分析時期/ラベル: ${item.label}\n\`\`\`json\n${JSON.stringify(item.result, null, 2)}\n\`\`\`\n`
  }));
  
  const introductionTextPart: Part = {
      text: `# 複数の肌分析結果に基づく総合経過分析の指示\n提供された以下の複数の肌分析結果（それぞれに時期/ラベルが付与されています）を時系列で比較検討し、総合的な経過分析レポートを作成してください。\n`
  };

  const allParts: Part[] = [
    SYSTEM_INSTRUCTION_OVERALL_ANALYSIS_PART,
    introductionTextPart,
    ...previousResultsTextParts
  ];
  
  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: [{ parts: allParts }],
      config: OVERALL_GENERATION_CONFIG, 
    });

    return parseJsonResponse<OverallReport>(response.text);

  } catch (error) {
    console.error("Gemini API呼び出しエラー (generateOverallAnalysisReport):", error);
     if (error instanceof Error) {
        throw new Error(`Gemini APIエラー (総合経過分析): ${error.message}`);
    }
    throw new Error("Gemini APIとの通信中に不明なエラーが発生しました (総合経過分析)。");
  }
};
