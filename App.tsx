
import React, { useState, useCallback, useEffect, useRef } from 'react';
import FileUpload from './components/FileUpload';
import AnalysisReport from './components/AnalysisReport';
import LoadingSpinner from './components/LoadingSpinner';
import OverallAnalysisReportComponent from './components/OverallAnalysisReport';
import { analyzeSkinWithGemini, generateOverallAnalysisReport } from './services/geminiService';
import { UploadedImageFile, AnalysisResult, AnalysisFileSet, OverallReport } from './types';

const App: React.FC = () => {
  const initialSetId = `set-${Date.now()}`;
  const [analysisFileSets, setAnalysisFileSets] = useState<AnalysisFileSet[]>([
    { id: initialSetId, name: `分析ポイント #1`, files: [], label: `時期1` }
  ]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [overallAnalysisReport, setOverallAnalysisReport] = useState<OverallReport | null>(null);
  const [isLoadingIndividual, setIsLoadingIndividual] = useState<boolean>(false);
  const [isLoadingOverall, setIsLoadingOverall] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);
  const [currentLoadingText, setCurrentLoadingText] = useState<string>("準備完了");
  
  const fileSetCounterRef = useRef<number>(1); 

  useEffect(() => {
    if (!process.env.API_KEY) {
      setApiKeyMissing(true);
    }
  }, []);

  const handleFilesSelectedForSet = useCallback((setId: string, files: UploadedImageFile[]) => {
    setAnalysisFileSets(prevSets =>
      prevSets.map(set => (set.id === setId ? { ...set, files } : set))
    );
    setError(null); 
    setAnalysisResults([]); // Clear results if files change
    setOverallAnalysisReport(null);
  }, []);

  const handleLabelChangeForSet = useCallback((setId: string, newLabel: string) => {
    setAnalysisFileSets(prevSets =>
      prevSets.map(set => (set.id === setId ? { ...set, label: newLabel } : set))
    );
    setAnalysisResults([]); // Clear results if labels change
    setOverallAnalysisReport(null);
  }, []);

  const addAnalysisSet = () => {
    fileSetCounterRef.current += 1;
    const newSet: AnalysisFileSet = {
      id: `set-${Date.now()}-${fileSetCounterRef.current}`,
      name: `分析ポイント #${fileSetCounterRef.current}`,
      files: [],
      label: `時期${fileSetCounterRef.current}`
    };
    setAnalysisFileSets(prevSets => [...prevSets, newSet]);
    setAnalysisResults([]);
    setOverallAnalysisReport(null);
  };

  const removeAnalysisSet = (setIdToRemove: string) => {
    setAnalysisFileSets(prevSets => {
      const updatedSets = prevSets.filter(set => set.id !== setIdToRemove);
      if (updatedSets.length === 0) {
        fileSetCounterRef.current = 1;
        return [{ id: `set-${Date.now()}`, name: `分析ポイント #1`, files: [], label: `時期1` }];
      }
       return updatedSets.map((set, index) => {
        const newName = `分析ポイント #${index + 1}`;
        const newLabel = set.label.startsWith("時期") && !/\d+$/.test(set.label.substring(2)) ? `時期${index + 1}` : set.label;
        fileSetCounterRef.current = updatedSets.length; 
        return { ...set, name: newName, label: newLabel };
      });
    });
    setAnalysisResults([]);
    setOverallAnalysisReport(null);
    setError(null);
  };

  const handleAnalyzeIndividualClick = useCallback(async () => {
    if (analysisFileSets.some(set => set.files.length === 0)) {
      setError("すべての分析ポイントにファイルを選択してください。");
      return;
    }
     if (analysisFileSets.some(set => !set.label.trim())) {
      setError("すべての分析ポイントに時期/ラベルを入力してください。");
      return;
    }
    if (apiKeyMissing) {
      setError("APIキーが設定されていません。アプリケーションを正しく実行できません。");
      return;
    }

    setIsLoadingIndividual(true);
    setError(null);
    setAnalysisResults([]); 
    setOverallAnalysisReport(null);

    let previousResultText: string | undefined = undefined;
    const newResults: AnalysisResult[] = [];

    for (let i = 0; i < analysisFileSets.length; i++) {
      const currentSet = analysisFileSets[i];
      setCurrentLoadingText(`${currentSet.name} (${currentSet.label}) を分析中 (${i + 1}/${analysisFileSets.length})...`);
      try {
        const result = await analyzeSkinWithGemini(currentSet.files, previousResultText);
        newResults.push(result);
        if (i < analysisFileSets.length -1) {
             previousResultText = JSON.stringify(result); 
        }
      } catch (err: any) {
        setError(`エラー (${currentSet.name} - ${currentSet.label}): ${err.message || "分析中にエラーが発生しました。"}`);
        setIsLoadingIndividual(false);
        setCurrentLoadingText("エラーが発生しました");
        return; 
      }
    }
    setAnalysisResults(newResults);
    setCurrentLoadingText("個別分析完了");
    setIsLoadingIndividual(false);
  }, [analysisFileSets, apiKeyMissing]);
  

  const handleGenerateOverallReportClick = useCallback(async () => {
    if (apiKeyMissing) {
      setError("APIキーが設定されていません。アプリケーションを正しく実行できません。");
      return;
    }
    if (analysisFileSets.length < 2) {
      setError("総合経過分析レポートを作成するには、少なくとも2つの分析ポイントが必要です。");
      return;
    }
    if (analysisFileSets.some(set => set.files.length === 0 || !set.label.trim())) {
      setError("すべての分析ポイントにファイルとラベルを入力してください。");
      return;
    }

    setIsLoadingOverall(true);
    setError(null);
    setOverallAnalysisReport(null); 
    setCurrentLoadingText("個別分析を開始しています...");

    const newIndividualResults: AnalysisResult[] = [];
    let previousResultTextForChaining: string | undefined = undefined;

    for (let i = 0; i < analysisFileSets.length; i++) {
      const currentSet = analysisFileSets[i];
      setCurrentLoadingText(`${currentSet.name} (${currentSet.label}) の個別分析を実行中 (${i + 1}/${analysisFileSets.length})...`);
      try {
        // Use chaining for consistency with individual analysis flow
        const result = await analyzeSkinWithGemini(currentSet.files, previousResultTextForChaining);
        newIndividualResults.push(result);
        if (i < analysisFileSets.length - 1) {
          previousResultTextForChaining = JSON.stringify(result);
        }
      } catch (err: any) {
        setError(`エラー (${currentSet.name} - ${currentSet.label}): ${err.message || "個別分析中にエラーが発生しました。"}`);
        setAnalysisResults([]); 
        setIsLoadingOverall(false);
        setCurrentLoadingText("エラーが発生しました");
        return;
      }
    }
    setAnalysisResults(newIndividualResults); 

    setCurrentLoadingText("総合経過分析レポートを作成中...");
    const resultsWithLabels = newIndividualResults.map((result, index) => ({
      result,
      label: analysisFileSets[index]?.label || `時期 ${index + 1}`
    }));

    try {
      const report = await generateOverallAnalysisReport(resultsWithLabels);
      setOverallAnalysisReport(report);
      setCurrentLoadingText("総合レポート作成完了");
    } catch (err: any) {
      setError(`総合経過分析レポート生成エラー: ${err.message || "総合レポート生成中にエラーが発生しました。"}`);
      setCurrentLoadingText("エラーが発生しました");
    } finally {
      setIsLoadingOverall(false);
    }
  }, [analysisFileSets, apiKeyMissing]);

  const globalIsLoading = isLoadingIndividual || isLoadingOverall;
  const canAnalyzeIndividual = analysisFileSets.length > 0 && analysisFileSets.every(set => set.files.length > 0 && set.label.trim().length > 0) && !apiKeyMissing;
  const canGenerateOverall = analysisFileSets.length >= 2 && analysisFileSets.every(set => set.files.length > 0 && set.label.trim().length > 0) && !apiKeyMissing;

  let overallDisabledTitle = "";
  if (!canGenerateOverall) {
    if (apiKeyMissing) {
        overallDisabledTitle = "APIキーが設定されていません。"
    } else if (analysisFileSets.length < 2) {
        overallDisabledTitle = "総合分析には最低2つの分析ポイントが必要です";
    } else {
        overallDisabledTitle = "すべての分析ポイントにファイルとラベルを入力してください";
    }
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 py-8 px-4 flex flex-col items-center">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-400 mb-2">
            AI 肌経過分析アプリ
          </h1>
          <p className="text-lg text-gray-600">
            複数の時点での顔画像をアップロードし、時期/ラベルを付けてAIによる肌質・輪郭分析。その後、総合的な経過レポートで変化を把握。
          </p>
        </header>

        {apiKeyMissing && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md text-center">
            <strong>警告:</strong> APIキーが設定されていません。アプリケーションを正しく実行するには、環境変数 <code>API_KEY</code> を設定してください。
          </div>
        )}

        <main className="space-y-8">
          {analysisFileSets.map((fileSet, index) => (
            <div key={fileSet.id} className="p-6 border border-gray-300 rounded-lg shadow-lg bg-white">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
                <h3 className="text-2xl font-semibold text-gray-800 mb-2 sm:mb-0">{fileSet.name}</h3>
                {analysisFileSets.length > 1 && (
                  <button
                    onClick={() => removeAnalysisSet(fileSet.id)}
                    disabled={globalIsLoading}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition duration-150 disabled:opacity-60 self-start sm:self-center"
                    aria-label={`${fileSet.name} を削除`}
                  >
                    このポイントを削除
                  </button>
                )}
              </div>
              <div className="mb-4">
                <label htmlFor={`label-input-${fileSet.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                  時期/ラベル (例: 2024年1月, 前回施術後)
                </label>
                <input
                  type="text"
                  id={`label-input-${fileSet.id}`}
                  value={fileSet.label}
                  onChange={(e) => handleLabelChangeForSet(fileSet.id, e.target.value)}
                  placeholder="例: 2024年1月開始時"
                  disabled={globalIsLoading}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
                />
              </div>
              <FileUpload
                onFilesSelected={(files) => handleFilesSelectedForSet(fileSet.id, files)}
                isLoading={globalIsLoading}
              />
            </div>
          ))}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center my-8">
            <button
              onClick={addAnalysisSet}
              disabled={globalIsLoading}
              className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition duration-150 ease-in-out disabled:opacity-60"
            >
              分析ポイントを追加
            </button>
            <button
              onClick={handleAnalyzeIndividualClick}
              disabled={globalIsLoading || !canAnalyzeIndividual}
              className="w-full px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              aria-live="polite"
              title={!canAnalyzeIndividual ? (apiKeyMissing ? "APIキーが設定されていません。" : "各分析ポイントにファイルとラベルが必要です") : ""}
            >
              {isLoadingIndividual ? currentLoadingText : '各ポイントを個別に分析'}
            </button>
             <button
              onClick={handleGenerateOverallReportClick}
              disabled={globalIsLoading || !canGenerateOverall}
              className="w-full px-8 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
              aria-live="polite"
              title={overallDisabledTitle}
            >
              {isLoadingOverall ? currentLoadingText : '総合経過分析レポートを作成'}
            </button>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md text-center animate-shake" role="alert">
              <p><strong>エラー:</strong> {error}</p>
            </div>
          )}

          {globalIsLoading && <LoadingSpinner text={currentLoadingText} />}
          
          {analysisResults.length > 0 && !globalIsLoading && (
            <div className="space-y-12 mt-10">
              {analysisResults.map((result, index) => (
                <div key={index} className={`pt-8 pb-4 bg-slate-50 shadow-xl rounded-lg ${index > 0 ? 'border-t-4 border-blue-300 mt-12' : ''}`}>
                  <h2 className="text-3xl font-bold text-center text-gray-800 mb-6 pb-3 border-b-2 border-gray-300 mx-6">
                    分析結果 #{index + 1}: {analysisFileSets[index]?.label || `ポイント ${index + 1}`}
                  </h2>
                  <div className="px-6">
                    <AnalysisReport result={result} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {overallAnalysisReport && !globalIsLoading && (
            <div className="mt-12 pt-8 pb-4 bg-sky-50 shadow-2xl rounded-lg border-t-4 border-purple-400">
                <h2 className="text-3xl font-bold text-center text-purple-700 mb-8 pb-3 border-b-2 border-purple-300 mx-6">
                    総合経過分析レポート
                </h2>
                <div className="px-6">
                    <OverallAnalysisReportComponent report={overallAnalysisReport} />
                </div>
            </div>
           )}
        </main>

        <footer className="text-center mt-16 py-8 border-t border-gray-300">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} AI 肌経過分析アプリ. All rights reserved.
            <br />
            この分析は美容的観点からの評価であり、医学的診断ではありません。常に専門家にご相談ください。
          </p>
        </footer>
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default App;
