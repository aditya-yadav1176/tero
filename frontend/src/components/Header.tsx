import React from 'react';
import { WifiOff, AlertCircle } from 'lucide-react';
import type { BackendHealth } from '../types';

interface HeaderProps {
  backendHealth: BackendHealth;
  onOpenHardwareModal: () => void;
  onOpenCloudInfoModal: () => void;
  isCloudConfigured: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  backendHealth,
  onOpenHardwareModal,
  onOpenCloudInfoModal,
  isCloudConfigured,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#FAF9F6]/90 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* App Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-navy-900 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-sm">
            T
          </div>
          <div>
            <h1 className="text-base font-semibold text-navy-900 tracking-tight leading-none">
              Tero
            </h1>
            <p className="text-[11px] text-stone-500 font-mono mt-0.5">
              IoT Handwriting &bull; TrOCR
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2">
          {/* Storage Mode Pill */}
          <button
            onClick={onOpenCloudInfoModal}
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              isCloudConfigured
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
            }`}
            title="Click to view persistence & cloud sync status"
          >
            {isCloudConfigured ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Firestore Sync</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                <span>IndexedDB (Local)</span>
              </>
            )}
          </button>

          {/* Backend Status Pill */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              backendHealth.model_loaded
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : backendHealth.status === 'offline'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
            title={`Backend: ${backendHealth.status} | Model: ${backendHealth.model_name}`}
          >
            {backendHealth.model_loaded ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-mono text-[11px]">TrOCR Ready</span>
              </>
            ) : backendHealth.status === 'offline' ? (
              <>
                <AlertCircle className="w-3 h-3 text-rose-600" />
                <span className="font-mono text-[11px]">Backend Offline</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span className="font-mono text-[11px]">Loading Model</span>
              </>
            )}
          </div>

          {/* ESP32 Hardware Status Button */}
          <button
            onClick={onOpenHardwareModal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 transition-colors"
            title="ESP32 hardware details (click for status)"
          >
            <WifiOff className="w-3 h-3 text-stone-500" />
            <span className="font-mono text-[11px]">ESP32: Disconnected</span>
          </button>
        </div>
      </div>
    </header>
  );
};
