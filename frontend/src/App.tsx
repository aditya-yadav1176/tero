import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import type { TabType } from './components/Navigation';
import { WriteScreen } from './screens/WriteScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { TrainingScreen } from './screens/TrainingScreen';
import { HardwareModal } from './components/HardwareModal';
import { CloudInfoModal } from './components/CloudInfoModal';
import { checkBackendHealth } from './services/api';
import { checkFirebaseConfig } from './services/firebase';
import { fetchHistory } from './services/storage';
import type { BackendHealth } from './types';
import { AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('write');
  const [historyCount, setHistoryCount] = useState<number>(0);

  // Modals state
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false);
  const [stagedOledText, setStagedOledText] = useState<string | undefined>(undefined);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);

  // Backend Health state
  const [backendHealth, setBackendHealth] = useState<BackendHealth>({
    status: 'checking',
    model_loaded: false,
    model_name: 'Checking...',
    device: 'Unknown',
  });

  const pollHealth = useCallback(async () => {
    const health = await checkBackendHealth();
    setBackendHealth(health);
  }, []);

  const refreshHistoryCount = useCallback(async () => {
    try {
      const { items } = await fetchHistory(50);
      setHistoryCount(items.length);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    pollHealth();
    refreshHistoryCount();

    // Periodic health check
    const interval = setInterval(pollHealth, 12000);
    return () => clearInterval(interval);
  }, [pollHealth, refreshHistoryCount]);

  const handleOpenHardwareModal = (stagedText?: string) => {
    setStagedOledText(stagedText);
    setIsHardwareModalOpen(true);
  };

  const isCloudConfigured = checkFirebaseConfig().isConfigured;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-navy-800 flex flex-col font-sans selection:bg-brand-100 selection:text-brand-700">
      {/* Sticky Header */}
      <Header
        backendHealth={backendHealth}
        onOpenHardwareModal={() => handleOpenHardwareModal()}
        onOpenCloudInfoModal={() => setIsCloudModalOpen(true)}
        isCloudConfigured={isCloudConfigured}
      />

      {/* Navigation (Desktop Top Tabs & Mobile Bottom Bar) */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        historyCount={historyCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-5">
        {backendHealth.is_local_in_prod && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Vercel Deployment Notice: Recognition Backend Required</span>
              <p className="text-amber-800 text-[11px] mt-0.5 leading-relaxed">
                You are viewing the site on Vercel. Vercel hosts the React UI, but not the Python PyTorch recognition backend. To recognize handwriting online, deploy your FastAPI backend to a cloud host and set <code className="bg-white px-1 py-0.2 rounded border font-mono">VITE_API_BASE_URL</code> in Vercel settings. For local evaluation on your laptop, recognition connects to <code className="bg-white px-1 py-0.2 rounded border font-mono">127.0.0.1:8000</code>.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'write' && (
          <WriteScreen
            backendHealth={backendHealth}
            onOpenHardwareModal={handleOpenHardwareModal}
            onAttemptSaved={refreshHistoryCount}
          />
        )}

        {activeTab === 'history' && <HistoryScreen />}

        {activeTab === 'training' && (
          <TrainingScreen backendHealth={backendHealth} />
        )}
      </main>

      {/* Modals */}
      <HardwareModal
        isOpen={isHardwareModalOpen}
        onClose={() => setIsHardwareModalOpen(false)}
        stagedText={stagedOledText}
      />

      <CloudInfoModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
      />
    </div>
  );
};

export default App;
