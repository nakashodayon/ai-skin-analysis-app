import React from 'react';
import { AnalysisResult, EvaluationAndFindings, MainDimensions, FaceType, Symmetry, SkinAgeReport, SpotsReport, WrinklesReport } from '../types';
import SectionCard from './SectionCard';

interface AnalysisReportProps {
  result: AnalysisResult | null;
}

const renderTextWithNewLines = (text: string | undefined) => {
  if (!text) return null;
  return <p className="whitespace-pre-line">{text}</p>;
};

const AnalysisReport: React.FC<AnalysisReportProps> = ({ result }) => {
  if (!result) {
    return null;
  }

  const renderEvaluationAndFindings = (title: string, data?: EvaluationAndFindings) => {
    if (!data) return null;
    return (
      <SectionCard title={title}>
        {data.評価 && <p><strong>評価:</strong> {data.評価}</p>}
        {data.所見 && <><strong>所見:</strong> {renderTextWithNewLines(data.所見)}</>}
      </SectionCard>
    );
  };
  
  const renderSkinAge = (data?: SkinAgeReport) => {
    if (!data) return null;
    return (
      <SectionCard title="肌年齢">
        {data.推定肌年齢 && <p><strong>推定肌年齢:</strong> {data.推定肌年齢}</p>}
        {data.所見 && <><strong>所見:</strong> {renderTextWithNewLines(data.所見)}</>}
      </SectionCard>
    );
  };

  const renderSpotsOrWrinkles = (title: string, data?: SpotsReport | WrinklesReport) => {
    if (!data) return null;
    return (
      <SectionCard title={title}>
        {data.評価 && <p><strong>評価:</strong> {data.評価}</p>}
        {data.種類と所見 && <><strong>種類と所見:</strong> {renderTextWithNewLines(data.種類と所見)}</>}
      </SectionCard>
    );
  };

  const renderMainDimensions = (data?: MainDimensions) => {
    if (!data) return null;
    return (
      <>
        <h4 className="text-lg font-semibold text-gray-700 mt-4 mb-2">主要寸法 (ミリ単位での推定値)</h4>
        {Object.entries(data).map(([key, value]) => (
          <p key={key}><strong>{key.replace(/（.*?）/g, '')}:</strong> {value}</p>
        ))}
      </>
    );
  };

  const renderFaceType = (data?: FaceType) => {
    if (!data) return null;
    return (
      <>
        <h4 className="text-lg font-semibold text-gray-700 mt-4 mb-2">顔のタイプ</h4>
        {data.推定 && <p><strong>推定:</strong> {data.推定}</p>}
        {data.根拠 && <><strong>根拠:</strong> {renderTextWithNewLines(data.根拠)}</>}
      </>
    );
  };

  const renderSymmetry = (data?: Symmetry) => {
    if (!data) return null;
    return (
      <>
        <h4 className="text-lg font-semibold text-gray-700 mt-4 mb-2">左右対称性</h4>
        {data.所見 && <><strong>所見:</strong> {renderTextWithNewLines(data.所見)}</>}
      </>
    );
  };


  return (
    <div className="mt-8 w-full">
      <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">分析結果レポート</h2>
      
      <SectionCard title="重要事項" className="bg-yellow-50 border-yellow-400">
        {renderTextWithNewLines(result.重要事項)}
      </SectionCard>

      <div className="grid md:grid-cols-2 gap-4">
        {renderSkinAge(result.肌年齢)}
        {renderEvaluationAndFindings("ハリ（弾力）", result["ハリ（弾力）"])}
        {renderEvaluationAndFindings("毛穴（なめらかさ）", result["毛穴（なめらかさ）"])}
        {renderEvaluationAndFindings("キメ", result.キメ)}
        {renderSpotsOrWrinkles("シミ", result.シミ)}
        {renderSpotsOrWrinkles("シワ", result.シワ)}
        {renderEvaluationAndFindings("赤み", result.赤み)}
      </div>
      
      <SectionCard title="輪郭分析">
        {renderMainDimensions(result.輪郭分析?.主要寸法)}
        {renderFaceType(result.輪郭分析?.顔のタイプ)}
        {renderSymmetry(result.輪郭分析?.左右対称性)}
      </SectionCard>
      
      <SectionCard title="総合所見" className="bg-blue-50 border-blue-400">
        {renderTextWithNewLines(result.総合所見)}
      </SectionCard>
    </div>
  );
};

export default AnalysisReport;
