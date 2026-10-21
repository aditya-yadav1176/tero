import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  Trash2,
  Search,
  AlertCircle,
  RefreshCw,
  Cloud,
  HardDrive,
  Download,
  Upload,
  CheckCircle2,
  Smartphone,
} from 'lucide-react';
import type { HistoryItem } from '../types';
import {
  fetchHistory,
  deleteHistoryItem,
  updateHistoryItem,
  importDataset,
  subscribeToHistoryUpdates,
} from '../services/storage';
import { DetailModal } from '../components/DetailModal';

export const HistoryScreen: React.FC = () => {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCloudStorage, setIsCloudStorage] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'corrected' | 'unreviewed'>('all');

  // Detail Modal
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  // Hidden file input for dataset import
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { items: loaded, isCloud } = await fetchHistory(50);
      setItems(loaded);
      setIsCloudStorage(isCloud);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Setup real-time cloud synchronization listener
  useEffect(() => {
    loadData();

    // Subscribe to real-time updates across devices when Firebase is active
    const unsubscribe = subscribeToHistoryUpdates((updatedItems, isCloud) => {
      setItems(updatedItems);
      setIsCloudStorage(isCloud);
      setIsLoading(false);
    }, 50);

    return () => unsubscribe();
  }, [loadData]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this recognition record?')) return;

    try {
      await deleteHistoryItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const handleUpdateRecord = async (
    id: string,
    updates: Partial<Pick<HistoryItem, 'corrected_text' | 'is_correct' | 'status' | 'split'>>
  ) => {
    await updateHistoryItem(id, updates);
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...updates } : it))
    );
    if (selectedItem?.id === id) {
      setSelectedItem((prev) => (prev ? { ...prev, ...updates } : null));
    }
    setActionSuccessMsg('Record updated successfully.');
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  const handleExportJSON = () => {
    if (items.length === 0) {
      alert('No records available to export.');
      return;
    }

    const payload = {
      project: 'Tero-Handwriting-Recognition',
      exported_at: new Date().toISOString(),
      count: items.length,
      storage_type: isCloudStorage ? 'firestore' : 'indexeddb',
      samples: items,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tero_history_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const count = await importDataset(parsed);
      setActionSuccessMsg(`Successfully imported ${count} records into IndexedDB!`);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to import JSON file');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Filtered list
  const filteredItems = items.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPred = item.predicted_text.toLowerCase().includes(q);
      const matchCorr = item.corrected_text?.toLowerCase().includes(q);
      return matchPred || matchCorr;
    }
    return true;
  });

  return (
    <div className="space-y-5 pb-20 sm:pb-8">
      {/* Header and Source Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-sm font-semibold text-navy-900">
            Recognition History
          </h2>
          <p className="text-xs text-stone-500">
            {isCloudStorage
              ? 'Synchronized across phone and laptop via Cloud Firestore (Spark free tier).'
              : 'Stored locally in browser IndexedDB (100% free & offline).'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Storage Mode Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border ${
              isCloudStorage
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-stone-100 text-stone-600 border-stone-200'
            }`}
          >
            {isCloudStorage ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cloud Sync Active</span>
              </>
            ) : (
              <>
                <HardDrive className="w-3.5 h-3.5 text-brand-600" />
                <span>IndexedDB (Local)</span>
              </>
            )}
          </div>

          {/* Export JSON Button */}
          <button
            onClick={handleExportJSON}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium transition-colors disabled:opacity-40"
            title="Export history records as JSON"
          >
            <Download className="w-3 h-3 text-stone-500" />
            <span>Export</span>
          </button>

          {/* Import JSON Button */}
          <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium transition-colors cursor-pointer">
            <Upload className="w-3 h-3 text-stone-500" />
            <span>Import</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors"
            title="Refresh history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {actionSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Search and Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search predicted or corrected text..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-200"
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white font-medium text-stone-700 focus:outline-hidden focus:border-brand-500"
          >
            <option value="all">All Records ({items.length})</option>
            <option value="verified">Verified Correct</option>
            <option value="corrected">User Corrected</option>
            <option value="unreviewed">Unreviewed</option>
          </select>
        </div>
      </div>

      {/* History Items List */}
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-stone-200">
          <RefreshCw className="w-6 h-6 animate-spin text-stone-400 mx-auto mb-2" />
          <p className="text-xs text-stone-500">Loading history records...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Failed to load history</span>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-stone-300">
          <Clock className="w-8 h-8 text-stone-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-navy-900 mb-1">
            No recognition attempts found
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'all'
              ? 'No records match your filter criteria. Try adjusting your search.'
              : 'Draw on the canvas on the Write screen and recognition results will automatically record here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const dateStr = new Date(item.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="group p-3.5 bg-white rounded-xl border border-stone-200 hover:border-stone-300 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                {/* Left: Thumbnail & Details */}
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Thumbnail / Device indicator */}
                  <div className="w-16 h-12 rounded-lg border border-stone-200 bg-stone-50 flex items-center justify-center overflow-hidden shrink-0 p-1">
                    {item.image_data ? (
                      <img
                        src={item.image_data}
                        alt="Handwriting thumbnail"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="text-center" title="Image stored on originating device">
                        <Smartphone className="w-4 h-4 text-stone-400 mx-auto" />
                        <span className="text-[9px] text-stone-400 leading-tight block">Other dev</span>
                      </div>
                    )}
                  </div>

                  {/* Texts: Predicted & Corrected separated */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-navy-900 truncate">
                        {item.predicted_text || '—'}
                      </span>
                      {item.corrected_text && item.corrected_text !== item.predicted_text && (
                        <span className="text-xs font-mono font-medium text-brand-600 bg-brand-50 px-1.5 py-0.2 rounded border border-brand-200 truncate">
                          &rarr; {item.corrected_text}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-stone-400 font-mono block mt-0.5">
                      {dateStr} &bull; {item.model_version.split('/')[1] || item.model_version} &bull; {item.split || 'train'}
                    </span>
                  </div>
                </div>

                {/* Right: Status Pill & Delete Button */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                      item.status === 'verified'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : item.status === 'corrected'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-stone-100 text-stone-600 border border-stone-200'
                    }`}
                  >
                    {item.status}
                  </span>

                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <DetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onSaveUpdate={handleUpdateRecord}
      />
    </div>
  );
};
