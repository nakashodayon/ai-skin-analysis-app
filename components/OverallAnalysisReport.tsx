
import React from 'react';
import { OverallReport, OverallReportContent } from '../types';
import SectionCard from './SectionCard';

interface OverallAnalysisReportProps {
  report: OverallReport | null;
}

const renderTextWithNewLines = (text: string | undefined) => {
  if (!text) return <p className="text-gray-500 italic">情報なし</p>;
  return <p className="whitespace-pre-line text-gray-700 leading-relaxed">{text}</p>;
};

const OverallAnalysisReportComponent: React.FC<OverallAnalysisReportProps> = ({ report }) => {
  if (!report || !report.総合経過分析レポート) {
    return (
        <div className="my-6 p-4 bg-yellow-50 border border-yellow-300 text-yellow-700 rounded-md text-center">
            総合経過分析レポートのデータがありません。
        </div>
    );
  }

  const { 概要, 改善点, 要注意点または悪化点, 観察された主な傾向, 推奨事項 } = report.総合経過分析レポート;

  return (
    <div className="mt-8 w-full space-y-6">
      <SectionCard title="概要" className="bg-indigo-50 border-indigo-300">
        {renderTextWithNewLines(概要)}
      </SectionCard>

      <SectionCard title="改善点" className="bg-green-50 border-green-300">
        {renderTextWithNewLines(改善点)}
      </SectionCard>

      <SectionCard title="要注意点または悪化点" className="bg-red-50 border-red-300">
        {renderTextWithNewLines(要注意点または悪化点)}
      </SectionCard>

      <SectionCard title="観察された主な傾向" className="bg-blue-50 border-blue-300">
        {renderTextWithNewLines(観察された主な傾向)}
      </SectionCard>
      
      <SectionCard title="推奨事項" className="bg-teal-50 border-teal-300">
        {renderTextWithNewLines(推奨事項)}
      </SectionCard>
    </div>
  );
};

export default OverallAnalysisReportComponent;
