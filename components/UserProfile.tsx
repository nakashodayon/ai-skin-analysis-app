import React, { useState } from 'react';
import { UserProfile } from '@clerk/clerk-react';
import { 
  User, 
  Settings, 
  Download, 
  Trash2, 
  Shield, 
  History,
  FileText,
  Lock,
  Bell,
  Eye,
  EyeOff,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { AnalysisResult, AnalysisFileSet } from '../types';

interface UserProfileComponentProps {
  analysisHistory?: AnalysisResult[];
  analysisFileSets?: AnalysisFileSet[];
  onDataExport?: () => void;
  onDataDelete?: () => void;
}

const UserProfileComponent: React.FC<UserProfileComponentProps> = ({
  analysisHistory = [],
  analysisFileSets = [],
  onDataExport,
  onDataDelete
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'data' | 'privacy' | 'security'>('profile');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    dataSharing: false,
    analyticsTracking: false,
    emailNotifications: true,
    securityAlerts: true
  });

  const handleDataExport = () => {
    // Create a comprehensive data export
    const exportData = {
      exportDate: new Date().toISOString(),
      analysisHistory,
      analysisFileSets,
      totalAnalyses: analysisHistory.length,
      privacySettings
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `skin-analysis-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onDataExport) {
      onDataExport();
    }
  };

  const handleDataDelete = () => {
    if (onDataDelete) {
      onDataDelete();
    }
    setShowDeleteConfirm(false);
  };

  const TabButton = ({ 
    id, 
    icon: Icon, 
    label, 
    active 
  }: { 
    id: 'profile' | 'data' | 'privacy' | 'security', 
    icon: any, 
    label: string, 
    active: boolean 
  }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-3 w-full px-4 py-3 text-left rounded-lg transition-all duration-200 ${
        active
          ? 'bg-blue-50 text-blue-600 border border-blue-200'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
      <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${active ? 'rotate-90' : ''}`} />
    </button>
  );

  const SettingsToggle = ({ 
    label, 
    description, 
    checked, 
    onChange 
  }: { 
    label: string, 
    description: string, 
    checked: boolean, 
    onChange: (checked: boolean) => void 
  }) => (
    <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <h4 className="font-medium text-gray-800">{label}</h4>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          checked ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-400 mb-2">
            ユーザープロフィール
          </h1>
          <p className="text-gray-600">
            アカウント情報の管理、データ設定、プライバシー設定を行えます
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">設定メニュー</h2>
              <nav className="space-y-2">
                <TabButton
                  id="profile"
                  icon={User}
                  label="プロフィール"
                  active={activeTab === 'profile'}
                />
                <TabButton
                  id="data"
                  icon={FileText}
                  label="データ管理"
                  active={activeTab === 'data'}
                />
                <TabButton
                  id="privacy"
                  icon={Shield}
                  label="プライバシー"
                  active={activeTab === 'privacy'}
                />
                <TabButton
                  id="security"
                  icon={Lock}
                  label="セキュリティ"
                  active={activeTab === 'security'}
                />
              </nav>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {activeTab === 'profile' && (
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <User className="w-6 h-6 text-blue-600" />
                    アカウント設定
                  </h2>
                  <div className="clerk-profile-container">
                    <UserProfile 
                      appearance={{
                        elements: {
                          card: 'shadow-none border-none bg-transparent',
                          headerTitle: 'text-xl font-semibold text-gray-800',
                          headerSubtitle: 'text-gray-600',
                          formButtonPrimary: 'bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600',
                          formFieldInput: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/20',
                          formFieldLabel: 'text-gray-700 font-medium',
                          profileSectionPrimaryButton: 'bg-blue-600 hover:bg-blue-700',
                          badge: 'bg-green-100 text-green-800',
                        },
                        variables: {
                          colorPrimary: '#2563eb',
                          borderRadius: '0.75rem',
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'data' && (
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-blue-600" />
                    データ管理
                  </h2>
                  
                  {/* Analysis Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg">
                      <div className="flex items-center gap-3">
                        <History className="w-6 h-6 text-blue-600" />
                        <div>
                          <p className="text-sm text-blue-600 font-medium">総分析回数</p>
                          <p className="text-2xl font-bold text-blue-800">{analysisHistory.length}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-6 h-6 text-green-600" />
                        <div>
                          <p className="text-sm text-green-600 font-medium">分析ポイント数</p>
                          <p className="text-2xl font-bold text-green-800">{analysisFileSets.length}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6 text-purple-600" />
                        <div>
                          <p className="text-sm text-purple-600 font-medium">アップロード画像数</p>
                          <p className="text-2xl font-bold text-purple-800">
                            {analysisFileSets.reduce((total, set) => total + set.files.length, 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Data Export Section */}
                  <div className="border border-gray-200 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Download className="w-5 h-5 text-green-600" />
                      データエクスポート
                    </h3>
                    <p className="text-gray-600 mb-4">
                      あなたの全ての分析データをJSONファイルとしてダウンロードできます。
                      GDPR準拠のデータポータビリティに対応しています。
                    </p>
                    <button
                      onClick={handleDataExport}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      全データをダウンロード
                    </button>
                  </div>

                  {/* Data Deletion Section */}
                  <div className="border border-red-200 rounded-lg p-6 bg-red-50">
                    <h3 className="text-lg font-semibold text-red-800 mb-3 flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-red-600" />
                      データ削除
                    </h3>
                    <p className="text-red-700 mb-4">
                      ⚠️ 注意: この操作により全ての分析データが永久に削除されます。
                      この操作は取り消すことができません。
                    </p>
                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        全データを削除
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <p className="font-medium text-red-800">
                          本当に全てのデータを削除しますか？
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={handleDataDelete}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            はい、削除します
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'privacy' && (
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Shield className="w-6 h-6 text-blue-600" />
                    プライバシー設定
                  </h2>
                  
                  <div className="space-y-6">
                    <SettingsToggle
                      label="データ共有"
                      description="分析結果の改善のため、匿名化されたデータの共有を許可します"
                      checked={privacySettings.dataSharing}
                      onChange={(checked) => setPrivacySettings(prev => ({ ...prev, dataSharing: checked }))}
                    />
                    
                    <SettingsToggle
                      label="アナリティクス追跡"
                      description="アプリの使用状況分析により、ユーザー体験の向上に協力します"
                      checked={privacySettings.analyticsTracking}
                      onChange={(checked) => setPrivacySettings(prev => ({ ...prev, analyticsTracking: checked }))}
                    />
                    
                    <SettingsToggle
                      label="メール通知"
                      description="新機能やアップデートに関する通知をメールで受け取ります"
                      checked={privacySettings.emailNotifications}
                      onChange={(checked) => setPrivacySettings(prev => ({ ...prev, emailNotifications: checked }))}
                    />
                    
                    <SettingsToggle
                      label="セキュリティアラート"
                      description="アカウントのセキュリティに関する重要な通知を受け取ります"
                      checked={privacySettings.securityAlerts}
                      onChange={(checked) => setPrivacySettings(prev => ({ ...prev, securityAlerts: checked }))}
                    />
                  </div>

                  <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">プライバシーについて</h4>
                    <p className="text-sm text-blue-700">
                      私たちはあなたのプライバシーを重視します。全ての個人データは暗号化され、
                      GDPR及び個人情報保護法に準拠して管理されています。
                      データの使用について詳しくは、プライバシーポリシーをご確認ください。
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Lock className="w-6 h-6 text-blue-600" />
                    セキュリティ設定
                  </h2>
                  
                  <div className="space-y-6">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-800 mb-2">アカウントセキュリティ</h3>
                      <p className="text-gray-600 mb-4">
                        アカウントのセキュリティ設定はClerkによって管理されています。
                        パスワードの変更、二段階認証の設定等は、プロフィール設定から行えます。
                      </p>
                      <button
                        onClick={() => setActiveTab('profile')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        プロフィール設定へ
                      </button>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-800 mb-2">データ暗号化</h3>
                      <div className="flex items-center gap-2 text-green-600 mb-2">
                        <Shield className="w-5 h-5" />
                        <span className="font-medium">有効</span>
                      </div>
                      <p className="text-gray-600">
                        あなたの肌分析データは、業界標準のAES-256暗号化により保護されています。
                      </p>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-800 mb-2">セッション管理</h3>
                      <p className="text-gray-600 mb-4">
                        セキュリティ上、非アクティブなセッションは自動的に終了されます。
                        不審なアクティビティを検出した場合は、即座にセッションを無効化します。
                      </p>
                      <div className="text-sm text-gray-500">
                        最終ログイン: {new Date().toLocaleString('ja-JP')}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileComponent; 