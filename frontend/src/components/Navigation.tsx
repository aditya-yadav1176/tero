import React from 'react';
import { PenTool, History as HistoryIcon, GraduationCap } from 'lucide-react';

export type TabType = 'write' | 'history' | 'training';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  historyCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  historyCount = 0,
}) => {
  const tabs = [
    {
      id: 'write' as TabType,
      label: 'Write',
      icon: PenTool,
      description: 'Draw & Recognize',
    },
    {
      id: 'history' as TabType,
      label: 'History',
      icon: HistoryIcon,
      badge: historyCount > 0 ? historyCount : undefined,
      description: 'Past Attempts',
    },
    {
      id: 'training' as TabType,
      label: 'Training & Testing',
      icon: GraduationCap,
      description: 'Evaluate & Dataset',
    },
  ];

  return (
    <>
      {/* Desktop Navigation Tabs */}
      <nav className="hidden sm:block max-w-4xl mx-auto px-4 pt-4">
        <div className="flex border-b border-stone-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                  isActive
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-stone-600 hover:text-navy-900 hover:border-stone-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-stone-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 px-3 py-1.5 shadow-lg">
        <div className="grid grid-cols-3 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'text-brand-600 bg-brand-50/60'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-brand-600' : 'text-stone-400'}`} />
                <span className="leading-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

