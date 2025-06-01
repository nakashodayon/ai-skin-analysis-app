import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from '@clerk/clerk-react';
import FileUpload from './components/FileUpload';
import AnalysisReport from './components/AnalysisReport';
import LoadingSpinner from './components/LoadingSpinner';
import OverallAnalysisReportComponent from './components/OverallAnalysisReport';
import UserProfileComponent from './components/UserProfile';
import { analyzeSkinWithGemini, generateOverallAnalysisReport } from './services/geminiService';
import {
  UserService,
  SessionService,
  AnalysisPointService,
  StorageService,
  ImageService,
  AnalysisResultService,
  OverallReportService,
  DataService,
} from './services/supabaseService';
import { UploadedImageFile, AnalysisResult, AnalysisFileSet, OverallReport } from './types';

const App: React.FC = () => {
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const initialSetId = `set-${Date.now()}`;
  const [currentPage, setCurrentPage] = useState<'analysis' | 'profile'>('analysis');
  const [analysisFileSets, setAnalysisFileSets] = useState<AnalysisFileSet[]>([
    { id: `set-${Date.now()}`, name: `分析ポイント #1`, files: [], label: `時期1` }
  ]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [overallAnalysisReport, setOverallAnalysisReport] = useState<OverallReport | null>(null);
  const [isLoadingIndividual, setIsLoadingIndividual] = useState<boolean>(false);
  const [isLoadingOverall, setIsLoadingOverall] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);
  const [currentLoadingText, setCurrentLoadingText] = useState<string>("準備完了");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSavingAnalysisPoints, setIsSavingAnalysisPoints] = useState(false);
  
  const fileSetCounterRef = useRef<number>(1); 
  const savingPointsRef = useRef<boolean>(false);

  // Initialize user profile and session when user loads
  useEffect(() => {
    const initializeUserData = async () => {
      if (!clerkUser || !isUserLoaded) return;

      try {
        setIsLoadingData(true);
        
        // Create or get user profile
        await UserService.getOrCreateUser(
          clerkUser.id,
          clerkUser.primaryEmailAddress?.emailAddress,
          clerkUser.firstName || undefined,
          clerkUser.lastName || undefined
        );
        
        // Create a new session for this app instance
        const userProfile = await UserService.getUserByClerkId(clerkUser.id);
        if (userProfile) {
          const session = await SessionService.createSession(
            userProfile.id,
            `分析セッション ${new Date().toLocaleDateString('ja-JP')}`
          );
          setCurrentSessionId(session.id);
        }
      } catch (error) {
        console.error('Failed to initialize user data:', error);
        setError('ユーザーデータの初期化に失敗しました。');
      } finally {
        setIsLoadingData(false);
      }
    };

    initializeUserData();
  }, [clerkUser, isUserLoaded]);

  useEffect(() => {
    if (!process.env.API_KEY) {
      setApiKeyMissing(true);
    }
  }, []);

  // Save analysis points to database when they change
  const saveAnalysisPointsToDatabase = useCallback(async (fileSets: AnalysisFileSet[]) => {
    if (!currentSessionId || !clerkUser || savingPointsRef.current) return;

    try {
      savingPointsRef.current = true;
      setIsSavingAnalysisPoints(true);
      console.log('Saving analysis points to database...');
      
      // Clear existing points for this session (simple approach)
      const existingPoints = await AnalysisPointService.getSessionAnalysisPoints(currentSessionId);
      console.log('Existing points to delete:', existingPoints.length);
      
      if (existingPoints.length > 0) {
        await Promise.all(existingPoints.map(point => AnalysisPointService.deleteAnalysisPoint(point.id)));
        console.log('Deleted existing points');
      }

      // Create new points and collect the IDs
      const pointPromises = fileSets.map((fileSet, index) => {
        console.log(`Creating analysis point: ${fileSet.name} (${fileSet.label}) - order: ${index + 1}`);
        return AnalysisPointService.createAnalysisPoint(
          currentSessionId,
          fileSet.name,
          fileSet.label,
          index + 1
        );
      });
      
      const createdPoints = await Promise.all(pointPromises);
      console.log('Analysis points created:', createdPoints.map(p => ({ id: p.id, label: p.label })));
      
      // Update local state with Supabase IDs immediately after creation
      setAnalysisFileSets(prevSets => 
        prevSets.map((set, index) => ({
          ...set,
          supabaseId: createdPoints[index]?.id
        }))
      );
      
      console.log('Local state updated with supabaseIds');
    } catch (error) {
      console.error('Failed to save analysis points:', error);
    } finally {
      savingPointsRef.current = false;
      setIsSavingAnalysisPoints(false);
    }
  }, [currentSessionId, clerkUser]);

  const handleFilesSelectedForSet = useCallback(async (setId: string, files: UploadedImageFile[]) => {
    console.log(`Files selected for set ${setId}:`, files.length);
    
    // Save to database immediately to ensure analysisPointId is available for file upload
    if (currentSessionId && clerkUser) {
      const updatedSets = analysisFileSets.map(set => (set.id === setId ? { ...set, files } : set));
      await saveAnalysisPointsToDatabase(updatedSets);
      console.log('Analysis points saved immediately for file upload');
      
      // Small delay to ensure state update propagates
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Update the local state with files
    setAnalysisFileSets(prevSets => 
      prevSets.map(set => (set.id === setId ? { ...set, files } : set))
    );
    
    setError(null); 
    setAnalysisResults([]); // Clear results if files change
    setOverallAnalysisReport(null);
  }, [analysisFileSets, currentSessionId, clerkUser, saveAnalysisPointsToDatabase]);

  const handleLabelChangeForSet = useCallback(async (setId: string, newLabel: string) => {
    setAnalysisFileSets(prevSets => 
      prevSets.map(set => (set.id === setId ? { ...set, label: newLabel } : set))
    );
    
    // Save to database after a short delay to ensure state update is complete
    setTimeout(async () => {
      if (currentSessionId && clerkUser) {
        const updatedSets = analysisFileSets.map(set => (set.id === setId ? { ...set, label: newLabel } : set));
        await saveAnalysisPointsToDatabase(updatedSets);
      }
    }, 100);
    
    setAnalysisResults([]); // Clear results if labels change
    setOverallAnalysisReport(null);
  }, [analysisFileSets, currentSessionId, clerkUser, saveAnalysisPointsToDatabase]);

  const addAnalysisSet = useCallback(async () => {
    fileSetCounterRef.current += 1;
    const newSet: AnalysisFileSet = {
      id: `set-${Date.now()}-${fileSetCounterRef.current}`,
      name: `分析ポイント #${fileSetCounterRef.current}`,
      files: [],
      label: `時期${fileSetCounterRef.current}`
    };
    
    setAnalysisFileSets(prevSets => [...prevSets, newSet]);
    
    // Save to database after a short delay to ensure state update is complete
    setTimeout(async () => {
      if (currentSessionId && clerkUser) {
        const updatedSets = [...analysisFileSets, newSet];
        await saveAnalysisPointsToDatabase(updatedSets);
      }
    }, 100);
    
    setAnalysisResults([]);
    setOverallAnalysisReport(null);
  }, [analysisFileSets, currentSessionId, clerkUser, saveAnalysisPointsToDatabase]);

  const removeAnalysisSet = useCallback(async (setIdToRemove: string) => {
    let finalUpdatedSets: AnalysisFileSet[] = [];
    
    setAnalysisFileSets(prevSets => {
      const updatedSets = prevSets.filter(set => set.id !== setIdToRemove);
      if (updatedSets.length === 0) {
        fileSetCounterRef.current = 1;
        finalUpdatedSets = [{ id: `set-${Date.now()}`, name: `分析ポイント #1`, files: [], label: `時期1` }];
        return finalUpdatedSets;
      }
      const renamedSets = updatedSets.map((set, index) => {
        const newName = `分析ポイント #${index + 1}`;
        const newLabel = set.label.startsWith("時期") && !/\d+$/.test(set.label.substring(2)) ? `時期${index + 1}` : set.label;
        fileSetCounterRef.current = updatedSets.length; 
        return { ...set, name: newName, label: newLabel };
      });
      finalUpdatedSets = renamedSets;
      return renamedSets;
    });
    
    // Save to database after a short delay to ensure state update is complete
    setTimeout(async () => {
      if (currentSessionId && clerkUser) {
        await saveAnalysisPointsToDatabase(finalUpdatedSets);
      }
    }, 100);
    
    setAnalysisResults([]);
    setOverallAnalysisReport(null);
    setError(null);
  }, [currentSessionId, clerkUser, saveAnalysisPointsToDatabase]);

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

    if (!currentSessionId || !clerkUser) {
      setError("セッションが初期化されていません。ページを再読み込みしてください。");
      return;
    }

    setIsLoadingIndividual(true);
    setError(null);
    setAnalysisResults([]); 
    setOverallAnalysisReport(null);

    let previousResultText: string | undefined = undefined;
    const newResults: AnalysisResult[] = [];

    try {
      // Ensure analysis points are saved before starting analysis
      setCurrentLoadingText("分析ポイントをデータベースに保存中...");
      await saveAnalysisPointsToDatabase(analysisFileSets);
      
      // Small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get analysis points from database
      const analysisPoints = await AnalysisPointService.getSessionAnalysisPoints(currentSessionId);
      console.log('Retrieved analysis points for analysis:', analysisPoints.map(p => ({ id: p.id, label: p.label })));
      
      for (let i = 0; i < analysisFileSets.length; i++) {
        const currentSet = analysisFileSets[i];
        setCurrentLoadingText(`${currentSet.name} (${currentSet.label}) を分析中 (${i + 1}/${analysisFileSets.length})...`);
        
        const result = await analyzeSkinWithGemini(currentSet.files, previousResultText);
        newResults.push(result);
        
        // Save analysis result to database
        const correspondingPoint = analysisPoints.find(point => point.label === currentSet.label);
        if (correspondingPoint) {
          try {
            await AnalysisResultService.saveAnalysisResult(correspondingPoint.id, result);
            console.log(`Analysis result saved for point: ${correspondingPoint.id}`);
          } catch (saveError) {
            console.error(`Failed to save analysis result for point ${correspondingPoint.id}:`, saveError);
            // Continue with analysis even if saving fails
          }
        } else {
          console.warn(`No matching analysis point found for label: ${currentSet.label}`);
          console.log('Available points:', analysisPoints.map(p => ({ id: p.id, label: p.label })));
        }
        
        if (i < analysisFileSets.length - 1) {
          previousResultText = JSON.stringify(result); 
        }
      }
      
      setAnalysisResults(newResults);
      setCurrentLoadingText("個別分析完了");
    } catch (err: any) {
      setError(`エラー: ${err.message || "分析中にエラーが発生しました。"}`);
      setCurrentLoadingText("エラーが発生しました");
    } finally {
      setIsLoadingIndividual(false);
    }
  }, [analysisFileSets, apiKeyMissing, currentSessionId, clerkUser, saveAnalysisPointsToDatabase]);
  

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

    if (!currentSessionId || !clerkUser) {
      setError("セッションが初期化されていません。ページを再読み込みしてください。");
      return;
    }

    setIsLoadingOverall(true);
    setError(null);
    setOverallAnalysisReport(null); 
    setCurrentLoadingText("分析ポイントをデータベースに保存中...");

    const newIndividualResults: AnalysisResult[] = [];
    let previousResultTextForChaining: string | undefined = undefined;

    try {
      // Ensure analysis points are saved before starting analysis
      await saveAnalysisPointsToDatabase(analysisFileSets);
      
      // Small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get analysis points from database
      const analysisPoints = await AnalysisPointService.getSessionAnalysisPoints(currentSessionId);
      console.log('Retrieved analysis points for overall analysis:', analysisPoints.map(p => ({ id: p.id, label: p.label })));

      setCurrentLoadingText("個別分析を開始しています...");

      for (let i = 0; i < analysisFileSets.length; i++) {
        const currentSet = analysisFileSets[i];
        setCurrentLoadingText(`${currentSet.name} (${currentSet.label}) の個別分析を実行中 (${i + 1}/${analysisFileSets.length})...`);
        
        const result = await analyzeSkinWithGemini(currentSet.files, previousResultTextForChaining);
        newIndividualResults.push(result);
        
        // Save analysis result to database
        const correspondingPoint = analysisPoints.find(point => point.label === currentSet.label);
        if (correspondingPoint) {
          try {
            await AnalysisResultService.saveAnalysisResult(correspondingPoint.id, result);
            console.log(`Analysis result saved for point: ${correspondingPoint.id}`);
          } catch (saveError) {
            console.error(`Failed to save analysis result for point ${correspondingPoint.id}:`, saveError);
            // Continue with analysis even if saving fails
          }
        } else {
          console.warn(`No matching analysis point found for label: ${currentSet.label}`);
          console.log('Available points:', analysisPoints.map(p => ({ id: p.id, label: p.label })));
        }
        
        if (i < analysisFileSets.length - 1) {
          previousResultTextForChaining = JSON.stringify(result);
        }
      }
      
      setAnalysisResults(newIndividualResults); 

      setCurrentLoadingText("総合経過分析レポートを作成中...");
      const resultsWithLabels = newIndividualResults.map((result, index) => ({
        result,
        label: analysisFileSets[index]?.label || `時期 ${index + 1}`
      }));

      const report = await generateOverallAnalysisReport(resultsWithLabels);
      
      // Save overall report to database
      try {
        await OverallReportService.saveOverallReport(currentSessionId, report);
        console.log(`Overall report saved for session: ${currentSessionId}`);
      } catch (saveError) {
        console.error(`Failed to save overall report for session ${currentSessionId}:`, saveError);
        // Continue even if saving fails - user can still see the report
      }
      
      setOverallAnalysisReport(report);
      setCurrentLoadingText("総合レポート作成完了");
    } catch (err: any) {
      setError(`総合経過分析レポート生成エラー: ${err.message || "総合レポート生成中にエラーが発生しました。"}`);
      setCurrentLoadingText("エラーが発生しました");
    } finally {
      setIsLoadingOverall(false);
    }
  }, [analysisFileSets, apiKeyMissing, currentSessionId, clerkUser, saveAnalysisPointsToDatabase]);

  // User profile data management functions
  const handleDataExport = useCallback(async () => {
    if (!clerkUser) {
      setError("ユーザーがログインしていません。");
      return;
    }

    try {
      console.log('Data export initiated');
      const exportData = await DataService.exportUserData(clerkUser.id);
      
      // Create and download JSON file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `skin-analysis-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('Data export completed');
    } catch (error) {
      console.error('Data export failed:', error);
      setError('データのエクスポートに失敗しました。');
    }
  }, [clerkUser]);

  const handleDataDelete = useCallback(async () => {
    if (!clerkUser) {
      setError("ユーザーがログインしていません。");
      return;
    }

    if (!window.confirm('すべての分析データを削除しますか？この操作は元に戻せません。')) {
      return;
    }

    try {
      await DataService.deleteAllUserData(clerkUser.id);
      
      // Reset local state
      setAnalysisResults([]);
      setOverallAnalysisReport(null);
      setAnalysisFileSets([{ id: `set-${Date.now()}`, name: `分析ポイント #1`, files: [], label: `時期1` }]);
      fileSetCounterRef.current = 1;
      setCurrentSessionId(null);
      setError(null);
      
      console.log('All analysis data deleted');
      
      // Reinitialize user session
      const userProfile = await UserService.getOrCreateUser(
        clerkUser.id,
        clerkUser.primaryEmailAddress?.emailAddress,
        clerkUser.firstName || undefined,
        clerkUser.lastName || undefined
      );
      
      if (userProfile) {
        const session = await SessionService.createSession(
          userProfile.id,
          `分析セッション ${new Date().toLocaleDateString('ja-JP')}`
        );
        setCurrentSessionId(session.id);
      }
    } catch (error) {
      console.error('Data deletion failed:', error);
      setError('データの削除に失敗しました。');
    }
  }, [clerkUser]);

  const globalIsLoading = isLoadingIndividual || isLoadingOverall || isSavingAnalysisPoints;
  const canAnalyzeIndividual = analysisFileSets.length > 0 && analysisFileSets.every(set => set.files.length > 0 && set.label.trim().length > 0) && !apiKeyMissing && !isSavingAnalysisPoints;
  const canGenerateOverall = analysisFileSets.length >= 2 && analysisFileSets.every(set => set.files.length > 0 && set.label.trim().length > 0) && !apiKeyMissing && !isSavingAnalysisPoints;

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

  // Custom Clerk appearance configuration
  const clerkAppearance = {
    layout: {
      socialButtonsVariant: 'iconButton' as const,
      socialButtonsPlacement: 'bottom' as const,
    },
    elements: {
      formButtonPrimary: 
        'bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-sm normal-case font-medium',
      card: 'bg-white/95 backdrop-blur-sm shadow-2xl border border-gray-200/50',
      headerTitle: 'text-2xl font-bold text-gray-800',
      headerSubtitle: 'text-gray-600',
      socialButtonsBlockButton: 
        'border-gray-300 hover:bg-gray-50 text-gray-700 shadow-sm',
      formFieldInput: 
        'border-gray-300 focus:border-blue-500 focus:ring-blue-500/20',
      footerActionLink: 'text-blue-600 hover:text-blue-700 font-medium',
      identityPreviewEditButton: 'text-blue-600 hover:text-blue-700',
      formFieldLabel: 'text-gray-700 font-medium',
      dividerLine: 'bg-gray-300',
      dividerText: 'text-gray-500',
    },
    variables: {
      colorPrimary: '#2563eb',
      colorBackground: '#ffffff',
      colorInputText: '#374151',
      colorInputBackground: '#ffffff',
      borderRadius: '0.75rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }
  };

  // Show user profile page if selected
  if (currentPage === 'profile') {
    return (
      <div>
        <SignedIn>
          <UserProfileComponent
            analysisHistory={analysisResults}
            analysisFileSets={analysisFileSets}
            onDataExport={handleDataExport}
            onDataDelete={handleDataDelete}
          />
          {/* Back to Analysis Button */}
          <div className="fixed bottom-6 right-6 z-50">
            <button
              onClick={() => setCurrentPage('analysis')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full shadow-lg transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              分析画面に戻る
            </button>
          </div>
        </SignedIn>
        <SignedOut>
          <div className="min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-800 mb-4">ログインが必要です</h1>
              <p className="text-gray-600 mb-6">プロフィール設定にアクセスするにはログインしてください。</p>
              <SignInButton mode="modal" appearance={clerkAppearance}>
                <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  ログイン
                </button>
              </SignInButton>
            </div>
          </div>
        </SignedOut>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 py-8 px-4 flex flex-col items-center">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-10">
          <div className="flex justify-end mb-4">
            <SignedOut>
              <div className="flex gap-3">
                <SignInButton 
                  mode="modal"
                  appearance={clerkAppearance}
                >
                  <button className="group relative px-6 py-2.5 bg-white border-2 border-blue-600 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all duration-200 font-medium shadow-sm hover:shadow-md">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      ログイン
                    </span>
                  </button>
                </SignInButton>
                <SignUpButton 
                  mode="modal"
                  appearance={clerkAppearance}
                >
                  <button className="group relative px-6 py-2.5 bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-xl hover:from-blue-700 hover:to-teal-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      新規登録
                    </span>
                  </button>
                </SignUpButton>
              </div>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCurrentPage('profile')}
                  className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm text-blue-600 rounded-lg hover:bg-white hover:shadow-md transition-all duration-200 border border-blue-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  プロフィール
                </button>
                <div className="hidden sm:flex items-center text-sm text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  ログイン中
                </div>
                <UserButton 
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: 'w-10 h-10 border-2 border-white shadow-lg',
                      userButtonPopoverCard: 'bg-white/95 backdrop-blur-sm shadow-2xl border border-gray-200/50',
                      userButtonPopoverActionButton: 'hover:bg-gray-50 text-gray-700',
                      userButtonPopoverActionButtonText: 'text-gray-700',
                      userButtonPopoverFooter: 'hidden', // Hide Clerk branding in production
                    },
                    variables: {
                      borderRadius: '0.75rem',
                    }
                  }}
                />
              </div>
            </SignedIn>
          </div>
          
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-400 mb-2">
            AI 肌経過分析アプリ
          </h1>
          <p className="text-lg text-gray-600">
            複数の時点での顔画像をアップロードし、時期/ラベルを付けてAIによる肌質・輪郭分析。その後、総合的な経過レポートで変化を把握。
          </p>
          
          <SignedOut>
            <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-200 rounded-xl shadow-sm">
              <div className="flex items-center justify-center mb-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-yellow-900">!</span>
                  </div>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">セキュアな分析をお楽しみください</h3>
              <p className="text-gray-700 mb-4">
                🔒 肌分析機能をご利用いただくには、ログインまたは新規登録が必要です。<br/>
                ✨ あなたの肌データは安全に保護され、個人的な分析結果を保存できます。
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <SignInButton 
                  mode="modal"
                  appearance={clerkAppearance}
                >
                  <button className="px-6 py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all duration-200 font-medium shadow-sm">
                    既存アカウントでログイン
                  </button>
                </SignInButton>
                <SignUpButton 
                  mode="modal"
                  appearance={clerkAppearance}
                >
                  <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-lg hover:from-blue-700 hover:to-teal-600 transition-all duration-200 font-medium shadow-md">
                    無料でアカウント作成
                  </button>
                </SignUpButton>
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">
                登録は無料です。メール認証後すぐにご利用いただけます。
              </p>
            </div>
          </SignedOut>
        </header>

        {apiKeyMissing && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md text-center">
            <strong>警告:</strong> APIキーが設定されていません。アプリケーションを正しく実行するには、環境変数 <code>API_KEY</code> を設定してください。
          </div>
        )}

        <main className="space-y-8">
          <SignedIn>
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
                  analysisPointId={fileSet.supabaseId}
                />
                {/* Debug info */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-2 text-xs text-gray-500">
                    Debug: supabaseId = {fileSet.supabaseId || 'undefined'}
                  </div>
                )}
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

            {isSavingAnalysisPoints && (
              <div className="mt-6 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded-md text-center">
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span>分析ポイントをデータベースに保存中...</span>
                </div>
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
          </SignedIn>

          <SignedOut>
            <div className="text-center py-12">
              <div className="max-w-lg mx-auto bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-gray-200/50">
                <div className="relative mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-teal-400 rounded-2xl mx-auto flex items-center justify-center shadow-lg transform rotate-3">
                    <svg className="w-10 h-10 text-white transform -rotate-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
                    <span className="text-sm font-bold text-yellow-900">✨</span>
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold text-gray-800 mb-3">AI肌分析を始めましょう</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  あなたの肌の変化を科学的に分析し、<br/>
                  パーソナライズされたレポートを作成します。
                </p>
                
                <div className="grid grid-cols-3 gap-3 mb-8 text-sm">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-blue-600 font-semibold mb-1">🔒 安全</div>
                    <div className="text-gray-600">データ保護</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-green-600 font-semibold mb-1">🎯 精密</div>
                    <div className="text-gray-600">AI分析</div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="text-purple-600 font-semibold mb-1">📊 詳細</div>
                    <div className="text-gray-600">レポート</div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-4">
                  <SignUpButton 
                    mode="modal"
                    appearance={clerkAppearance}
                  >
                    <button className="w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-teal-500 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-teal-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        無料で今すぐ始める
                      </span>
                    </button>
                  </SignUpButton>
                  
                  <div className="flex items-center justify-center gap-4">
                    <div className="h-px bg-gray-300 flex-1"></div>
                    <span className="text-sm text-gray-500 font-medium">または</span>
                    <div className="h-px bg-gray-300 flex-1"></div>
                  </div>
                  
                  <SignInButton 
                    mode="modal"
                    appearance={clerkAppearance}
                  >
                    <button className="w-full px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200">
                      既存アカウントでログイン
                    </button>
                  </SignInButton>
                </div>
                
                <p className="text-xs text-gray-500 mt-6 leading-relaxed">
                  登録は完全無料です • メール認証後すぐにご利用可能<br/>
                  あなたのプライバシーを最優先に保護します
                </p>
              </div>
            </div>
          </SignedOut>
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
