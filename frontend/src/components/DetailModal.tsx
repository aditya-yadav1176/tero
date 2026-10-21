import React, { useState, useEffect } from 'react';
import { X, Clock, CheckCircle2, Cpu, Calendar, Edit3, Save, ThumbsUp, Layers, HardDrive } from 'lucide-react';
import type { HistoryItem, DatasetSplit } from '../types';

interface DetailModalProps {
  item: HistoryItem | null;
  onClose: () => void;
  onSaveUpdate?: (id: string, updates: Partial<Pick<HistoryItem, 'corrected_text' | 'is_correct' | 'status' | 'split'>>) => Promise<void>;
}

export const DetailModal: React.FC<DetailModalProps> = ({ item, onClose, onSaveUpdate }) => {
  if (!item) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [editedLabel, setEditedLabel] = useState(item.corrected_text || (item.is_correct ? item.predicted_text : ''));
  const [selectedSplit, setSelectedSplit] = useState<DatasetSplit>(item.split || 'train');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditedLabel(item.corrected_text || (item.is_correct ? item.predicted_text : ''));
    setSelectedSplit(item.split || 'train');
    setIsEditing(false);
  }, [item]);

  const handleSave = async (isCorrectChoice?: boolean) => {
    if (!onSaveUpdate) return;
    setIsSaving(true);
    try {
      const correct = isCorrectChoice !== undefined ? isCorrectChoice : (editedLabel.trim() === item.predicted_text);
      await onSaveUpdate(item.id, {
        corrected_text: correct ? undefined : editedLabel.trim(),
        is_correct: correct,
        status: correct ? 'verified' : 'corrected',
        split: selectedSplit,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update record:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const dateStr = new Date(item.timestamp).toLocaleString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Recognition Record Details
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-stone-600">
          {/* Image Display */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
              Handwriting Sample
            </label>
            <div className="w-full min-h-28 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-center overflow-hidden p-3">
              {item.image_data ? (
                <img
                  src={item.image_data}
                  alt="Handwriting stroke"
                  className="max-h-36 max-w-full object-contain rounded"
                />
              ) : (
                <div className="text-center p-2 space-y-1">
                  <HardDrive className="w-5 h-5 text-stone-400 mx-auto" />
                  <span className="font-semibold text-stone-700 block text-xs">
                    Image Stored on Originating Device
                  </span>
                  <p className="text-[11px] text-stone-500 leading-tight max-w-xs">
                    Handwriting image is preserved in IndexedDB on the device that created it. Text predictions, corrections, and labels are synchronized across all devices via Cloud Firestore.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Predictions & Corrections */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-[11px] font-medium text-stone-500 block mb-1">
                Original Model Prediction
              </span>
              <span className="font-mono text-base font-semibold text-navy-900 block truncate">
                {item.predicted_text || '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-stone-500">
                  Corrected Text
                </span>
                {!isEditing && onSaveUpdate && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-[10px] text-brand-600 hover:underline flex items-center gap-0.5"
                  >
                    <Edit3 className="w-2.5 h-2.5" /> Edit
                  </button>
                )}
              </div>

              {isEditing ? (
                <input
                  type="text"
                  value={editedLabel}
                  onChange={(e) => setEditedLabel(e.target.value)}
                  className="w-full px-2 py-1 text-sm font-mono font-semibold rounded border border-brand-400 bg-white focus:outline-hidden"
                />
              ) : (
                <span
                  className={`font-mono text-base font-semibold block truncate ${
                    item.corrected_text && item.corrected_text !== item.predicted_text
                      ? 'text-brand-600'
                      : item.is_correct === true
                      ? 'text-emerald-700'
                      : 'text-stone-700'
                  }`}
                >
                  {item.corrected_text || item.predicted_text || 'Unreviewed'}
                </span>
              )}
            </div>
          </div>

          {/* Inline Edit Controls */}
          {isEditing && (
            <div className="p-3 bg-stone-100 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-stone-600 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Dataset Partition:
                </span>
                <select
                  value={selectedSplit}
                  onChange={(e) => setSelectedSplit(e.target.value as DatasetSplit)}
                  className="px-2 py-0.5 text-xs rounded border border-stone-300 bg-white"
                >
                  <option value="train">Training Set (80%)</option>
                  <option value="test">Testing Set (20%)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleSave(true)}
                  disabled={isSaving}
                  className="flex-1 py-1.5 px-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <ThumbsUp className="w-3 h-3" /> Confirm Correct
                </button>
                <button
                  onClick={() => handleSave(false)}
                  disabled={isSaving}
                  className="flex-1 py-1.5 px-2 bg-brand-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <Save className="w-3 h-3" /> Save Label
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="py-1.5 px-2.5 bg-stone-200 text-stone-700 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Metadata details table */}
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2 font-mono text-[11px]">
            <div className="flex justify-between items-center border-b border-stone-200 pb-1.5">
              <span className="text-stone-500 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-stone-400" /> Review Status:
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                  item.status === 'verified'
                    ? 'bg-emerald-100 text-emerald-800'
                    : item.status === 'corrected'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-stone-200 text-stone-700'
                }`}
              >
                {item.status} ({item.split || 'train'})
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-stone-200 pb-1.5">
              <span className="text-stone-500 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-stone-400" /> Timestamp:
              </span>
              <span className="text-stone-700">{dateStr}</span>
            </div>

            <div className="flex justify-between items-center border-b border-stone-200 pb-1.5">
              <span className="text-stone-500 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-stone-400" /> Model:
              </span>
              <span className="text-stone-700 truncate max-w-[180px]" title={item.model_version}>
                {item.model_version}
              </span>
            </div>

            {item.inference_time_ms !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-stone-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-stone-400" /> Inference Latency:
                </span>
                <span className="text-stone-700">{item.inference_time_ms} ms</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-100 bg-stone-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-navy-900 text-white hover:bg-navy-800 transition-colors shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
